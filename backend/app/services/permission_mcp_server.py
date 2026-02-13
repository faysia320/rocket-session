#!/usr/bin/env python3
"""Permission MCP Server - Claude CLI의 --permission-prompt-tool 용 stdio MCP 서버.

외부 의존성 없이 stdlib만 사용합니다.
환경변수:
  PERMISSION_SESSION_ID: 현재 세션 ID
  PERMISSION_API_BASE: Backend API base URL (예: http://localhost:8101)
  PERMISSION_TIMEOUT: 응답 대기 타임아웃 (초, 기본 120)
"""

import json
import os
import sys
import urllib.request
import urllib.error


def read_message() -> dict | None:
    """stdin에서 JSON-RPC 메시지를 한 줄씩 읽습니다."""
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line.strip())


def write_message(msg: dict):
    """stdout으로 JSON-RPC 메시지를 씁니다."""
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def write_error(msg_id, code: int, message: str):
    """JSON-RPC 에러 응답을 씁니다."""
    write_message({
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": code, "message": message},
    })


def handle_initialize(msg: dict):
    """MCP initialize 핸들링."""
    write_message({
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
    })


def handle_tools_list(msg: dict):
    """사용 가능한 도구 목록 반환."""
    write_message({
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
    })


def handle_tool_call(msg: dict):
    """도구 호출 처리 - Backend에 permission 요청 후 응답 대기."""
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
    payload = json.dumps({
        "tool_name": request_tool,
        "tool_input": request_input,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout + 10) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        behavior = result.get("behavior", "deny")

        # Claude CLI는 permission-prompt-tool의 결과에서 JSON을 파싱
        # "allow" 또는 "deny" behavior를 반환
        permission_result = {
            "behavior": behavior,
        }

        write_message({
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(permission_result),
                    }
                ],
            },
        })

    except urllib.error.URLError as e:
        # 네트워크 오류 시 deny
        write_message({
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
        })
    except Exception as e:
        write_message({
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
        })


def main():
    """MCP 서버 메인 루프 (stdio JSON-RPC)."""
    while True:
        msg = read_message()
        if msg is None:
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


if __name__ == "__main__":
    main()
