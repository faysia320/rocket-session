"""애플리케이션 전반에 사용되는 상수 정의.

매직 넘버와 반복 문자열을 한 곳에서 관리합니다.
"""

# ---------------------------------------------------------------------------
# Tool sets
# ---------------------------------------------------------------------------

#: 읽기 전용 도구 (워크플로우 research 단계 및 비워크플로우 세션)
READONLY_TOOLS = "Read,Glob,Grep,WebFetch,WebSearch,TodoRead"

#: 전체 도구 기본값 (Settings env 기본값)
DEFAULT_ALL_TOOLS = (
    "Read,Write,Edit,MultiEdit,Bash,Glob,Grep,WebFetch,WebSearch,TodoRead,TodoWrite"
)

# ---------------------------------------------------------------------------
# Cache TTLs (seconds)
# ---------------------------------------------------------------------------

#: Usage API 캐시 TTL (초)
USAGE_CACHE_TTL: float = 120.0

#: Usage API 에러 응답 캐시 TTL (초)
USAGE_CACHE_ERROR_TTL: float = 30.0

#: Usage API 429 Rate Limit 캐시 TTL (초) - Retry-After 없을 때 기본값
USAGE_CACHE_RATE_LIMIT_TTL: float = 120.0

#: Git 정보 캐시 TTL (초)
GIT_CACHE_TTL: float = 10.0

# ---------------------------------------------------------------------------
# Timeouts (seconds)
# ---------------------------------------------------------------------------

#: Usage API HTTP 요청 타임아웃 (초)
USAGE_HTTP_TIMEOUT: float = 10.0

#: Permission 응답 대기 타임아웃 (초)
PERMISSION_WAIT_TIMEOUT: int = 120

#: WebSocket ping 전송 타임아웃 (초)
WS_PING_TIMEOUT: float = 5.0

#: WebSocket 메시지 전송 타임아웃 (초)
WS_SEND_TIMEOUT: float = 3.0

#: 프로세스 종료 대기 타임아웃 (초) - kill 후 wait
PROCESS_KILL_WAIT_TIMEOUT: float = 5.0

#: Runner task graceful shutdown 대기 (초)
RUNNER_TASK_GRACEFUL_TIMEOUT: float = 3.0

# ---------------------------------------------------------------------------
# Buffer / Limit sizes
# ---------------------------------------------------------------------------

#: WebSocket 이벤트 인메모리 버퍼 최대 크기
WS_EVENT_BUFFER_SIZE: int = 1000

#: WebSocket 이벤트 DB 큐 최대 크기
WS_EVENT_QUEUE_SIZE: int = 10000

#: Git 정보 LRU 캐시 최대 항목 수
GIT_CACHE_MAX_SIZE: int = 100

# ---------------------------------------------------------------------------
# Intervals (seconds)
# ---------------------------------------------------------------------------

#: WebSocket 배치 writer 플러시 간격 (초)
WS_BATCH_FLUSH_INTERVAL: float = 0.5

#: WebSocket heartbeat ping 간격 (초)
WS_HEARTBEAT_INTERVAL: float = 30.0

#: JSONL 파일 폴링 간격 (초)
JSONL_POLL_INTERVAL: float = 1.0

#: JSONL 감시 idle 타임아웃 (초) - 새 데이터 없으면 감시 종료
JSONL_IDLE_TIMEOUT: float = 120.0

#: JSONL 활성 파일 판단 기준 (초) - 파일 수정 시간이 이 시간 이내면 활성
JSONL_ACTIVE_THRESHOLD: float = 300.0
