"""ClaudeRunner와 JsonlWatcher가 공유하는 이벤트 처리 유틸리티.

CLI stream-json 이벤트를 파싱할 때 반복되는 로직을 추출하여
두 서비스 간 코드 중복을 제거합니다.
"""

from datetime import datetime, timezone
from pathlib import Path


def utc_now_iso() -> str:
    """현재 UTC 시각을 ISO 형식 문자열로 반환."""
    return datetime.now(timezone.utc).isoformat()


def normalize_file_path(file_path: str, work_dir: str) -> str:
    """파일 경로를 work_dir 기준 상대 경로로 정규화.

    CLI가 절대 경로를 반환하는 경우, work_dir 하위이면 상대 경로로 변환.
    """
    p = Path(file_path)
    if p.is_absolute():
        try:
            return str(p.resolve().relative_to(Path(work_dir).resolve()))
        except ValueError:
            return file_path
    return file_path


def extract_tool_result_output(block: dict, max_length: int = 5000) -> dict:
    """tool_result 블록에서 출력 텍스트를 추출하고 truncation 정보를 포함한 dict 반환.

    Args:
        block: tool_result content 블록 (content, is_error 필드 포함).
        max_length: 출력 텍스트 최대 길이 (초과 시 잘림 처리).

    Returns:
        output, is_error, is_truncated, full_length 키를 포함하는 dict.
    """
    raw_content = block.get("content", "")
    if isinstance(raw_content, list):
        output_text = "\n".join(
            item.get("text", "") for item in raw_content if item.get("type") == "text"
        )
    else:
        output_text = str(raw_content)
    full_length = len(output_text)
    truncated = full_length > max_length
    return {
        "output": output_text[:max_length],
        "is_error": block.get("is_error", False),
        "is_truncated": truncated,
        "full_length": full_length if truncated else None,
    }


def extract_result_data(event: dict, turn_state: dict) -> dict:
    """result 이벤트에서 공통 데이터를 추출.

    ClaudeRunner와 JsonlWatcher 모두에서 result 이벤트 처리 시
    동일한 필드를 동일한 방식으로 추출하므로 여기에 통합합니다.

    Args:
        event: CLI result 이벤트 dict.
        turn_state: 현재 턴의 공유 상태 (text, model 등).

    Returns:
        result_text, is_error, cost, duration_ms, session_id,
        input_tokens, output_tokens, cache_creation_tokens,
        cache_read_tokens, model 키를 포함하는 dict.
    """
    result_text = event.get("result") or ""
    if not result_text and turn_state.get("text"):
        result_text = turn_state["text"]

    usage = event.get("usage", {})
    return {
        "result_text": result_text,
        "is_error": event.get("is_error", False),
        "cost": event.get("cost_usd", event.get("cost", None)),
        "duration_ms": event.get("duration_ms", None),
        "session_id": event.get("session_id", None),
        "input_tokens": usage.get("input_tokens"),
        "output_tokens": usage.get("output_tokens"),
        "cache_creation_tokens": usage.get("cache_creation_input_tokens"),
        "cache_read_tokens": usage.get("cache_read_input_tokens"),
        "model": turn_state.get("model"),
    }
