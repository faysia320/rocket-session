"""도메인 예외 계층.

서비스/리포지토리 계층에서 발생시키고, 글로벌 핸들러가 HTTP 응답으로 변환합니다.
"""


class AppError(Exception):
    """도메인 예외 베이스. HTTP 상태 코드를 포함."""

    def __init__(
        self, message: str = "서버 내부 오류가 발생했습니다", status_code: int = 500
    ):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class NotFoundError(AppError):
    def __init__(self, message: str = "리소스를 찾을 수 없습니다"):
        super().__init__(message, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str = "이미 존재하는 리소스입니다"):
        super().__init__(message, status_code=409)


class ValidationError(AppError):
    def __init__(self, message: str = "잘못된 요청입니다"):
        super().__init__(message, status_code=400)


class ForbiddenError(AppError):
    def __init__(self, message: str = "접근 권한이 없습니다"):
        super().__init__(message, status_code=403)
