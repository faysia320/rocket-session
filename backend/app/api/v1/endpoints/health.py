"""헬스체크 엔드포인트."""

import logging

from fastapi import APIRouter

from app.core.utils import utc_now_iso

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": utc_now_iso()}


@router.get("/health/detailed")
async def health_detailed():
    """상세 모니터링 엔드포인트: DB 풀, WebSocket, 프로세스, 메시지 큐 상태."""
    from app.api.dependencies import (
        get_database,
        get_session_manager,
        get_ws_manager,
    )

    result: dict = {"status": "ok", "timestamp": utc_now_iso()}

    # DB 연결 풀 상태
    try:
        db = get_database()
        pool = db.engine.pool
        result["db_pool"] = {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool._invalidate_time
            if hasattr(pool, "_invalidate_time")
            else 0,
        }
    except Exception as e:
        result["db_pool"] = {"error": str(e)}

    # WebSocket 서비스 메트릭
    try:
        ws_manager = get_ws_manager()
        result["websocket"] = ws_manager.get_metrics()
    except Exception as e:
        result["websocket"] = {"error": str(e)}

    # 프로세스 메트릭
    try:
        session_manager = get_session_manager()
        result["processes"] = session_manager._process_manager.get_metrics()
    except Exception as e:
        result["processes"] = {"error": str(e)}

    # 메시지 배치 큐 상태
    try:
        session_manager = get_session_manager()
        msg_queue = session_manager._message_queue
        result["message_queue"] = {
            "size": msg_queue.qsize() if msg_queue else 0,
            "maxsize": msg_queue.maxsize if msg_queue else 0,
        }
    except Exception as e:
        result["message_queue"] = {"error": str(e)}

    return result
