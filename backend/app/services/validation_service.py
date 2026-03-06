"""워크스페이스 검증 파이프라인 서비스.

AI-Native DDD 원칙: "규칙을 문서로 적지 마라. 코드로 강제하라."
워크스페이스별 lint/test/build 명령을 자동 실행하여 코드 품질을 하드하게 강제한다.
"""

import asyncio
import logging
import time

from app.repositories.workspace_repo import WorkspaceRepository
from app.schemas.workspace import (
    ValidationCommand,
    ValidationCommandResult,
    ValidationResult,
)
from app.services.base import DBService

logger = logging.getLogger(__name__)

MAX_OUTPUT_CHARS = 2000


class ValidationService(DBService):
    """워크스페이스 검증 명령 실행 서비스."""

    async def run_validation(
        self,
        workspace_id: str,
        trigger: str,
        work_dir: str,
    ) -> ValidationResult:
        """워크스페이스에 설정된 검증 명령을 실행한다.

        Args:
            workspace_id: 워크스페이스 ID
            trigger: 트리거 시점 (phase_complete, pre_commit, manual)
            work_dir: 명령을 실행할 디렉토리

        Returns:
            ValidationResult: 전체 검증 결과
        """
        commands = await self._get_commands(workspace_id, trigger)
        if not commands:
            return ValidationResult(passed=True, summary="검증 명령이 설정되지 않았습니다.")

        results: list[ValidationCommandResult] = []
        all_passed = True

        for cmd_config in commands:
            result = await self._run_command(cmd_config, work_dir)
            results.append(result)
            if not result.passed:
                all_passed = False

        summary = self._build_summary(results, all_passed)
        return ValidationResult(passed=all_passed, results=results, summary=summary)

    async def run_validation_by_commands(
        self,
        commands: list[ValidationCommand],
        work_dir: str,
    ) -> ValidationResult:
        """명시적으로 전달된 검증 명령을 실행한다 (DB 조회 없이)."""
        if not commands:
            return ValidationResult(passed=True, summary="검증 명령이 없습니다.")

        results: list[ValidationCommandResult] = []
        all_passed = True

        for cmd_config in commands:
            result = await self._run_command(cmd_config, work_dir)
            results.append(result)
            if not result.passed:
                all_passed = False

        summary = self._build_summary(results, all_passed)
        return ValidationResult(passed=all_passed, results=results, summary=summary)

    async def _get_commands(
        self, workspace_id: str, trigger: str
    ) -> list[ValidationCommand]:
        """워크스페이스에서 트리거에 매칭되는 검증 명령을 조회한다."""
        async with self._session_scope(WorkspaceRepository) as (_session, repo):
            ws = await repo.get_by_id(workspace_id)
            if not ws or not ws.validation_commands:
                return []

            commands: list[ValidationCommand] = []
            for raw in ws.validation_commands:
                cmd = ValidationCommand(**raw) if isinstance(raw, dict) else raw
                if trigger in cmd.run_on:
                    commands.append(cmd)
            return commands

    async def _run_command(
        self, cmd_config: ValidationCommand, work_dir: str
    ) -> ValidationCommandResult:
        """단일 검증 명령을 subprocess로 실행한다."""
        start = time.monotonic()
        proc: asyncio.subprocess.Process | None = None
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd_config.command,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=cmd_config.timeout_seconds,
            )
            exit_code = proc.returncode if proc.returncode is not None else -1
            duration_ms = int((time.monotonic() - start) * 1000)

            return ValidationCommandResult(
                name=cmd_config.name,
                command=cmd_config.command,
                passed=exit_code == 0,
                exit_code=exit_code,
                stdout=_truncate(stdout_bytes.decode("utf-8", errors="replace")),
                stderr=_truncate(stderr_bytes.decode("utf-8", errors="replace")),
                duration_ms=duration_ms,
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.monotonic() - start) * 1000)
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except ProcessLookupError:
                    pass
            return ValidationCommandResult(
                name=cmd_config.name,
                command=cmd_config.command,
                passed=False,
                exit_code=-1,
                stderr=f"타임아웃 ({cmd_config.timeout_seconds}초 초과)",
                duration_ms=duration_ms,
            )
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.warning(
                "검증 명령 실행 실패: %s (%s)", cmd_config.name, exc, exc_info=True
            )
            return ValidationCommandResult(
                name=cmd_config.name,
                command=cmd_config.command,
                passed=False,
                exit_code=-1,
                stderr=str(exc),
                duration_ms=duration_ms,
            )

    @staticmethod
    def _build_summary(
        results: list[ValidationCommandResult], all_passed: bool
    ) -> str:
        """Claude에 전달할 검증 결과 요약 텍스트를 생성한다."""
        if all_passed:
            names = ", ".join(r.name for r in results)
            return f"모든 검증 통과: {names}"

        lines = ["검증 실패:"]
        for r in results:
            status = "PASS" if r.passed else "FAIL"
            lines.append(f"  [{status}] {r.name} (exit={r.exit_code}, {r.duration_ms}ms)")
            if not r.passed and r.stderr:
                # 에러 출력의 마지막 10줄만
                err_lines = r.stderr.strip().splitlines()[-10:]
                for line in err_lines:
                    lines.append(f"    {line}")
            if not r.passed and r.stdout and not r.stderr:
                out_lines = r.stdout.strip().splitlines()[-10:]
                for line in out_lines:
                    lines.append(f"    {line}")
        return "\n".join(lines)


def _truncate(text: str) -> str:
    """출력 텍스트를 최대 길이로 잘라낸다."""
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + "\n... (truncated)"
    return text
