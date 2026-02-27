"""구조화 로깅 설정 (structlog).

JSON 구조화 로깅을 설정하여 운영 가시성을 높입니다.
Docker 로그 수집 시 JSON 파싱이 가능합니다 (ELK, CloudWatch 등).
"""

import logging
import sys

import structlog


def setup_logging(json_format: bool = True, log_level: str = "INFO") -> None:
    """structlog + stdlib logging 통합 설정.

    Args:
        json_format: True이면 JSON 출력 (프로덕션), False이면 콘솔 출력 (개발)
        log_level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR)
    """
    # structlog 프로세서 체인
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if json_format:
        # 프로덕션: JSON 출력
        renderer = structlog.processors.JSONRenderer(ensure_ascii=False)
    else:
        # 개발: 컬러 콘솔 출력
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # stdlib logging 포맷터 설정
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # 외부 라이브러리 로그 레벨 조정
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """structlog 로거를 반환합니다."""
    return structlog.get_logger(name)
