"""헬스체크 엔드포인트."""

from fastapi import APIRouter

from app.core.utils import utc_now_iso

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": utc_now_iso()}
