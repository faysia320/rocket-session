"""워크플로우 자동 추천 서비스.

사용자의 첫 번째 메시지를 분석하여 가장 적합한 워크플로우를 AI가 선택한다.
Claude CLI subprocess를 경량 모델로 호출하여 빠르게 판단한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

logger = logging.getLogger(__name__)

# AI 판단 타임아웃 (초)
_TIMEOUT_SECONDS = 10

# 워크플로우 판단용 시스템 프롬프트
_SYSTEM_PROMPT = """\
당신은 개발 워크플로우 선택 전문가입니다.
사용자의 요청을 분석하여, 제공되는 워크플로우 목록 중 가장 적합한 하나를 선택하세요.

선택 기준:
1. **비개발 요청은 "none"**: 단순 질문, 상태 확인, 설명 요청, 설정 확인 등
   코드 변경이 필요 없는 요청은 workflow_id를 "none"으로 응답하세요.
2. 각 워크플로우의 description과 단계 수(step_count)를 참고하세요.
3. 사용자 요청의 복잡도·목적에 가장 부합하는 워크플로우를 선택하세요.
4. 사용자가 특정 워크플로우 이름을 언급했다면 해당 워크플로우를 우선 선택하세요.
5. 판단이 어렵다면 단계 수가 가장 적은 워크플로우를 선택하세요.

"none" 예시: "이게 뭐야?", "MCP 연결 확인해줘", "이 코드 설명해줘", "어떤 파일이 있어?"

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{"workflow_id": "선택한_워크플로우_id 또는 none"}\
"""


class WorkflowRecommenderService:
    """첫 메시지 분석으로 적합한 워크플로우를 추천한다."""

    async def recommend(
        self,
        prompt: str,
        definitions: list,
    ) -> str | None:
        """프롬프트를 분석하여 workflow_definition_id를 반환한다.

        Args:
            prompt: 사용자의 첫 번째 메시지
            definitions: WorkflowDefinitionInfo 목록

        Returns:
            추천 workflow_definition_id, 실패/타임아웃 시 None
        """
        if not prompt or not definitions:
            return None

        # 워크플로우 목록을 간결하게 직렬화 (id, name, description, 단계 수만 포함)
        defs_summary = [
            {
                "id": d.id if hasattr(d, "id") else d.get("id"),
                "name": d.name if hasattr(d, "name") else d.get("name"),
                "description": (
                    d.description if hasattr(d, "description") else d.get("description")
                ),
                "step_count": (
                    len(d.steps) if hasattr(d, "steps") else len(d.get("steps", []))
                ),
            }
            for d in definitions
        ]

        user_content = (
            f"워크플로우 목록:\n{json.dumps(defs_summary, ensure_ascii=False)}\n\n"
            f"사용자 요청: {prompt}"
        )

        try:
            result = await asyncio.wait_for(
                self._call_claude(user_content),
                timeout=_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("워크플로우 추천 타임아웃 (%ds 초과)", _TIMEOUT_SECONDS)
            return None
        except Exception:
            logger.warning("워크플로우 추천 실패", exc_info=True)
            return None

        if result is None:
            return None

        # "none" 응답: 워크플로우 불필요 판단
        if result == "none":
            return "none"

        # 유효한 ID인지 검증
        valid_ids = {
            d.id if hasattr(d, "id") else d.get("id") for d in definitions
        }
        if result in valid_ids:
            return result

        logger.warning("추천된 워크플로우 ID가 목록에 없음: %s", result)
        return None

    async def _call_claude(self, user_content: str) -> str | None:
        """Claude CLI를 한 번 호출하여 workflow_id를 파싱하여 반환."""
        full_prompt = f"{_SYSTEM_PROMPT}\n\n{user_content}"

        proc = await asyncio.create_subprocess_exec(
            "claude",
            "-p", full_prompt,
            "--output-format", "json",
            "--model", "claude-haiku-4-5-20251001",
            "--permission-mode", "plan",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await proc.communicate()
        except asyncio.CancelledError:
            # 타임아웃 등으로 취소된 경우 subprocess 정리
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            raise

        if proc.returncode != 0:
            err_msg = stderr.decode("utf-8", errors="replace").strip()
            logger.warning("Claude CLI 오류 (returncode=%d): %s", proc.returncode, err_msg)
            return None

        raw = stdout.decode("utf-8", errors="replace").strip()
        return self._parse_workflow_id(raw)

    def _parse_workflow_id(self, raw: str) -> str | None:
        """Claude 출력에서 workflow_id를 추출한다."""
        if not raw:
            return None

        # Claude CLI --output-format json 응답 구조:
        # {"type": "result", "subtype": "success", "result": "...", ...}
        try:
            outer = json.loads(raw)
            result_text = outer.get("result") or outer.get("content") or ""
            if isinstance(result_text, list):
                # content 배열인 경우 텍스트 추출
                result_text = " ".join(
                    item.get("text", "") for item in result_text if isinstance(item, dict)
                )
        except (json.JSONDecodeError, AttributeError):
            result_text = raw

        # result_text에서 JSON 객체 추출 시도
        result_text = result_text.strip()
        # 코드블록 제거
        if result_text.startswith("```"):
            lines = result_text.splitlines()
            result_text = "\n".join(
                l for l in lines if not l.startswith("```")
            ).strip()

        try:
            parsed = json.loads(result_text)
            wid = parsed.get("workflow_id")
            if wid and isinstance(wid, str):
                return wid
        except (json.JSONDecodeError, AttributeError):
            pass

        # 정규식으로 fallback 추출
        match = re.search(r'"workflow_id"\s*:\s*"([^"]+)"', result_text)
        if match:
            return match.group(1)

        logger.warning("workflow_id 파싱 실패. 원본: %s", result_text[:200])
        return None
