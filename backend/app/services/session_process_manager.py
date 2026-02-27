"""세션 프로세스 생명주기 관리 (인메모리)."""

import asyncio
import logging

logger = logging.getLogger(__name__)


class SessionProcessManager:
    """Claude CLI 프로세스 및 runner task 관리 (인메모리).

    DB에 저장할 수 없는 프로세스 핸들과 asyncio.Task를 관리합니다.
    서버 재시작 시 모든 참조가 사라집니다.
    """

    def __init__(self) -> None:
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._runner_tasks: dict[str, asyncio.Task] = {}

    async def kill_process(self, session_id: str) -> None:
        """실행 중인 Claude CLI 프로세스 및 runner task를 안전하게 종료."""
        # runner task 취소 (stdout reader) — cancel 후 완료 대기
        runner_task = self._runner_tasks.get(session_id)
        if runner_task and not runner_task.done():
            runner_task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(runner_task), timeout=3)
            except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                pass
        self._runner_tasks.pop(session_id, None)

        # 프로세스 종료
        process = self._processes.get(session_id)
        if process and process.returncode is None:
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
            except Exception:
                logger.warning(
                    "세션 %s 프로세스 종료 중 오류", session_id, exc_info=True
                )
        self._processes.pop(session_id, None)

    def set_process(self, session_id: str, process: asyncio.subprocess.Process) -> None:
        self._processes[session_id] = process

    def get_process(self, session_id: str) -> asyncio.subprocess.Process | None:
        return self._processes.get(session_id)

    def clear_process(self, session_id: str) -> None:
        self._processes.pop(session_id, None)

    def set_runner_task(self, session_id: str, task: asyncio.Task) -> None:
        """runner task 등록."""
        self._runner_tasks[session_id] = task

    def get_runner_task(self, session_id: str) -> asyncio.Task | None:
        """runner task 조회. 완료된 task는 자동 정리."""
        task = self._runner_tasks.get(session_id)
        if task and task.done():
            self._runner_tasks.pop(session_id, None)
            return None
        return task

    def clear_runner_task(self, session_id: str) -> None:
        """runner task 참조 제거."""
        self._runner_tasks.pop(session_id, None)

    def clear_runner_task_if_match(self, session_id: str, task: asyncio.Task) -> None:
        """현재 등록된 task와 동일한 경우에만 정리 (레이스컨디션 방지)."""
        current = self._runner_tasks.get(session_id)
        if current is task:
            del self._runner_tasks[session_id]

    @property
    def active_session_ids(self) -> list[str]:
        """프로세스가 실행 중인 세션 ID 목록."""
        return list(self._processes.keys())

    def get_metrics(self) -> dict:
        """프로세스 관리 메트릭 반환."""
        return {
            "active": len(self._processes),
            "runner_tasks": len(self._runner_tasks),
            "session_ids": list(self._processes.keys()),
        }
