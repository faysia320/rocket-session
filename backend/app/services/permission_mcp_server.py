#!/usr/bin/env python3
"""Permission MCP Server - Claude CLI의 --permission-prompt-tool 용 stdio MCP 서버.

외부 의존성 없이 stdlib만 사용합니다.
환경변수:
  PERMISSION_SESSION_ID: 현재 세션 ID
  PERMISSION_API_BASE: Backend API base URL (예: http://localhost:8101)
  PERMISSION_TIMEOUT: 응답 대기 타임아웃 (초, 기본 120)
"""

import json
import logging
import os
import sys
import threading
import urllib.error
import urllib.request

# stderr로 로깅 (stdout은 MCP stdio 프로토콜에 사용됨)
logging.basicConfig(
    stream=sys.stderr,
    level=logging.DEBUG,
    format="[PermissionMCP] %(levelname)s %(message)s",
)
logger = logging.getLogger("permission_mcp")


def read_message() -> dict | None:
    """stdin에서 JSON-RPC 메시지를 한 줄씩 읽습니다."""
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line.strip())
    except (json.JSONDecodeError, OSError) as e:
        logger.error("메시지 읽기 실패: %s", e)
        return None


def write_message(msg: dict):
    """stdout으로 JSON-RPC 메시지를 씁니다."""
    try:
        sys.stdout.write(json.dumps(msg) + "\n")
        sys.stdout.flush()
    except OSError as e:
        logger.error("메시지 쓰기 실패: %s", e)


def write_error(msg_id, code: int, message: str):
    """JSON-RPC 에러 응답을 씁니다."""
    write_message(
        {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": code, "message": message},
        }
    )


def handle_initialize(msg: dict):
    """MCP initialize 핸들링."""
    write_message(
        {
            "jsonrpc": "2.0",
            "id": msg.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {
                    "name": "permission-prompt",
                    "version": "1.0.0",
                },
            },
        }
    )


def handle_tools_list(msg: dict):
    """사용 가능한 도구 목록 반환."""
    write_message(
        {
            "jsonrpc": "2.0",
            "id": msg.get("id"),
            "result": {
                "tools": [
                    {
                        "name": "handle_request",
                        "description": "Handle a permission prompt request from Claude CLI",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "tool_name": {
                                    "type": "string",
                                    "description": "Name of the tool requesting permission",
                                },
                                "input": {
                                    "type": "object",
                                    "description": "Tool input parameters",
                                },
                            },
                            "required": ["tool_name", "input"],
                        },
                    }
                ]
            },
        }
    )


def _make_deny_response(msg_id) -> dict:
    """deny 동작의 JSON-RPC 응답을 생성합니다."""
    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "result": {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({"behavior": "deny"}),
                }
            ],
        },
    }


def _do_http_request(url: str, payload: bytes, timeout: int) -> dict | None:
    """HTTP POST 요청을 수행합니다. 실패 시 None 반환."""
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        logger.error("HTTP 요청 실패 (URLError): %s → %s", url, e)
        return None
    except TimeoutError:
        logger.error("HTTP 요청 타임아웃: %s (%d초)", url, timeout)
        return None
    except Exception as e:
        logger.error("HTTP 요청 예외: %s → %s", url, e)
        return None


def handle_tool_call(msg: dict):
    """도구 호출 처리 - Backend에 permission 요청 후 응답 대기.

    HTTP 요청을 별도 스레드에서 실행하여, stdin이 닫히는 경우(프로세스 종료)
    main 루프가 감지하고 빠져나올 수 있도록 합니다.
    """
    msg_id = msg.get("id")
    params = msg.get("params", {})
    tool_name_called = params.get("name", "")
    arguments = params.get("arguments", {})

    if tool_name_called != "handle_request":
        write_error(msg_id, -32601, f"Unknown tool: {tool_name_called}")
        return

    session_id = os.environ.get("PERMISSION_SESSION_ID", "")
    api_base = os.environ.get("PERMISSION_API_BASE", "http://localhost:8101")
    timeout = int(os.environ.get("PERMISSION_TIMEOUT", "120"))

    if not session_id:
        write_error(msg_id, -32000, "PERMISSION_SESSION_ID not set")
        return

    request_tool = arguments.get("tool_name", "unknown")
    request_input = arguments.get("input", {})

    # Backend에 permission request POST
    url = f"{api_base}/api/permissions/{session_id}/request"
    payload = json.dumps(
        {
            "tool_name": request_tool,
            "tool_input": request_input,
        }
    ).encode("utf-8")

    logger.info("Permission 요청: tool=%s, session=%s", request_tool, session_id)

    # HTTP 요청을 별도 스레드에서 실행 (메인 스레드 블로킹 방지)
    result_holder: list[dict | None] = [None]

    def do_request():
        result_holder[0] = _do_http_request(url, payload, timeout + 10)

    thread = threading.Thread(target=do_request, daemon=True)
    thread.start()
    # timeout + 15초 여유: HTTP 타임아웃(timeout+10) 보다 약간 길게 대기
    thread.join(timeout=timeout + 15)

    if thread.is_alive():
        # 스레드가 여전히 실행 중 = HTTP 요청이 timeout+15초 내에 완료 안 됨
        logger.error("Permission 요청 스레드 타임아웃 (%d초)", timeout + 15)
        write_message(_make_deny_response(msg_id))
        return

    result = result_holder[0]
    if result is None:
        logger.warning("Permission 요청 실패 → deny 반환")
        write_message(_make_deny_response(msg_id))
        return

    behavior = result.get("behavior", "deny")
    logger.info("Permission 응답: behavior=%s", behavior)

    write_message(
        {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps({"behavior": behavior}),
                    }
                ],
            },
        }
    )


def main():
    """MCP 서버 메인 루프 (stdio JSON-RPC)."""
    logger.info("Permission MCP 서버 시작")
    while True:
        msg = read_message()
        if msg is None:
            logger.info("stdin EOF — 종료")
            break

        method = msg.get("method", "")

        if method == "initialize":
            handle_initialize(msg)
        elif method == "notifications/initialized":
            # 클라이언트 확인 - 응답 불필요
            pass
        elif method == "tools/list":
            handle_tools_list(msg)
        elif method == "tools/call":
            handle_tool_call(msg)
        else:
            # 알 수 없는 메서드는 무시하거나 에러 반환
            if msg.get("id") is not None:
                write_error(msg.get("id"), -32601, f"Method not found: {method}")

    logger.info("Permission MCP 서버 종료")


if __name__ == "__main__":
    main()
