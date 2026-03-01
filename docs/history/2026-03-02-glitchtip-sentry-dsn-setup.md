# 작업 이력: GlitchTip Sentry DSN 연동 설정

- **날짜**: 2026-03-02
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

GlitchTip 에러 추적 서비스에 Backend/Frontend를 연동하기 위해 Sentry DSN 환경변수를 Docker 설정에 추가했다.

## 변경 파일 목록

- `docker-compose.yml` - Backend SENTRY_DSN 환경변수, Frontend build args 추가
- `frontend/Dockerfile` - Vite 빌드 시 SENTRY DSN 주입을 위한 ARG/ENV 추가

## 상세 변경 내용

### 1. Backend DSN 설정 (docker-compose.yml)

- `SENTRY_DSN`: Docker 내부 네트워크 주소(`glitchtip-web:8080`) 사용
- `SENTRY_ENVIRONMENT`: production 설정
- 기존 `app/core/sentry.py`의 `setup_sentry()`가 자동으로 초기화

### 2. Frontend DSN 설정 (Dockerfile + docker-compose.yml)

- Dockerfile에 `ARG VITE_SENTRY_DSN`, `ARG VITE_SENTRY_ENVIRONMENT` 추가
- docker-compose.yml에서 build args로 브라우저용 DSN(`localhost:8200`) 전달
- Vite 빌드 시 `import.meta.env.VITE_SENTRY_DSN`으로 번들에 포함

## 비고

- Backend는 Docker 내부 네트워크(`glitchtip-web:8080`)로 통신
- Frontend는 브라우저에서 전송하므로 호스트 주소(`localhost:8200`) 사용
