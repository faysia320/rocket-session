# 작업 이력: Serena 컨테이너 .venv 에러 수정

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Serena 컨테이너가 `.venv/bin/activate: No such file or directory` 에러로 구동 실패하는 문제를 수정했습니다.
커스텀 Dockerfile을 통해 Serena 설치를 `/opt/serena`로 복사하여 Named Volume 마운트와의 충돌을 방지합니다.

## 변경 파일 목록

### Infrastructure

- `serena/Dockerfile` - 커스텀 Dockerfile 신규 생성 (Serena 설치를 /opt/serena로 복사)
- `docker-compose.yml` - serena 서비스를 커스텀 빌드로 전환, command 단순화

## 상세 변경 내용

### 1. 근본 원인

- `rocket-workspaces` Named Volume이 `/workspaces`에 마운트되면서 Serena 이미지의 `/workspaces/serena/.venv/`를 덮어씀
- `uv run --directory /app`의 `/app`은 Serena 이미지에 존재하지 않는 경로

### 2. 커스텀 Dockerfile 생성 (`serena/Dockerfile`)

- 베이스 이미지에서 `/workspaces/serena`를 `/opt/serena`로 복사
- PATH에 `.venv/bin` 추가
- ENTRYPOINT에서 venv 활성화 + exec으로 PID 1 전달

### 3. docker-compose.yml 수정

- `image: ghcr.io/oraios/serena:latest` → `build: ./serena` (커스텀 Dockerfile)
- `uv run --directory /app serena-mcp-server` → `serena-mcp-server` (ENTRYPOINT가 venv 활성화 처리)

## 테스트 방법

1. `docker-compose build serena` — 이미지 빌드 성공 확인
2. `docker-compose up -d serena` — 컨테이너 정상 시작 확인
3. `docker logs rocket-session-serena` — `.venv` 에러 없이 SSE 서버 시작 확인
4. `docker-compose ps` — serena 서비스 healthy 상태 확인
