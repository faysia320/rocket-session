"""Skills (슬래시 명령어) 조회 서비스.

.claude/commands/*.md 파일을 스캔하여 사용 가능한 Skills 목록을 반환합니다.
"""

import asyncio
import logging
from pathlib import Path

from app.schemas.filesystem import (
    SkillInfo,
    SkillListResponse,
)

logger = logging.getLogger(__name__)


class SkillsService:
    """Skills 목록 조회 서비스 (stateless)."""

    async def list_skills(self, path: str) -> SkillListResponse:
        """Skills 목록 조회 (.claude/commands/*.md)."""

        def _scan_skills(project_path: str) -> list[SkillInfo]:
            """동기 스킬 파일 탐색 (이벤트 루프 블로킹 방지용 헬퍼)."""
            results: list[SkillInfo] = []
            seen_names: set[str] = set()

            # 1. 프로젝트 스킬 스캔 ({path}/.claude/commands/)
            if project_path:
                try:
                    project_commands_path = (
                        Path(project_path).resolve() / ".claude" / "commands"
                    )
                    if (
                        project_commands_path.exists()
                        and project_commands_path.is_dir()
                    ):
                        for md_file in sorted(project_commands_path.glob("*.md")):
                            skill_name = md_file.stem
                            description = _extract_first_line(md_file)
                            results.append(
                                SkillInfo(
                                    name=skill_name,
                                    filename=md_file.name,
                                    description=description,
                                    scope="project",
                                )
                            )
                            seen_names.add(skill_name)
                except Exception:
                    pass  # 프로젝트 경로 에러는 무시

            # 2. 사용자 스킬 스캔 (~/.claude/commands/)
            try:
                user_commands_path = Path.home() / ".claude" / "commands"
                if user_commands_path.exists() and user_commands_path.is_dir():
                    for md_file in sorted(user_commands_path.glob("*.md")):
                        skill_name = md_file.stem
                        if skill_name in seen_names:
                            continue  # 프로젝트 스킬이 우선
                        description = _extract_first_line(md_file)
                        results.append(
                            SkillInfo(
                                name=skill_name,
                                filename=md_file.name,
                                description=description,
                                scope="user",
                            )
                        )
            except Exception:
                pass  # 사용자 경로 에러는 무시

            return results

        skills = await asyncio.to_thread(_scan_skills, path)
        return SkillListResponse(skills=skills)


def _extract_first_line(file_path: Path) -> str:
    """파일의 첫 비어있지 않은 줄을 추출."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    return stripped
    except Exception:
        pass
    return ""
