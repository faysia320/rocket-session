# 작업 이력: WebSocket 재연결 + Docker 전체 세팅

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

WebSocket 연결 끊김 시 놓친 이벤트를 복구하는 이벤트 버퍼링/재연결 시스템을 구현하고,
프로젝트를 Docker 환경에서 구동할 수 있도록 전체 Docker 구성을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - events 테이블 스키마 + CRUD 메서드 추가
- `backend/app/services/websocket_manager.py` - broadcast_event (seq 부여 + 버퍼링 + DB 저장), 재연결 이벤트 조회
- `backend/app/api/dependencies.py` - ws_manager에 DB 인스턴스 주입
- `backend/app/api/v1/endpoints/ws.py` - last_seq 쿼리 파라미터, 재연결 시 missed_events 전송
- `backend/app/api/v1/endpoints/permissions.py` - broadcast -> broadcast_event 전환
- `backend/app/services/claude_runner.py` - broadcast -> broadcast_event 전환 (전체)
- `backend/Dockerfile` - Python + Node.js + uv + Claude CLI 이미지
- `backend/.dockerignore` - 빌드 컨텍스트 최적화

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - lastSeq 추적, 재연결 시 놓친 이벤트 요청/복구
- `frontend/src/types/message.ts` - seq 필드, missed_events 타입 추가
- `frontend/Dockerfile` - pnpm 멀티스테이지 빌드 + nginx
- `frontend/nginx.conf` - SPA 라우팅 + API/WS 리버스 프록시
- `frontend/.dockerignore` - node_modules/dist 제외

### 프로젝트 루트

- `docker-compose.yml` - 올바른 포트/볼륨/헬스체크 구성으로 재작성
- `.dockerignore` - 루트 빌드 컨텍스트 최적화
- `.env.docker.example` - Docker 환경변수 템플릿
- `.gitignore` - .env.docker 패턴 추가

## 상세 변경 내용

### 1. WebSocket 이벤트 버퍼링 시스템

- 모든 broadcast를 broadcast_event로 전환하여 seq 번호 자동 부여
- 인메모리 deque 버퍼 (최대 1000개) + SQLite events 테이블 이중 저장
- 재연결 시 last_seq 파라미터로 놓친 이벤트 조회/전송
- 프론트엔드에서 missed_events를 순서대로 재처리하여 상태 복구

### 2. Docker 전체 구성

- Backend: Python 3.11-slim + Node.js 22 + uv + Claude Code CLI
- Frontend: pnpm 멀티스테이지 빌드 -> nginx alpine 서빙
- nginx: SPA 라우팅 + /api/, /ws/ 리버스 프록시 + 보안 헤더
- docker-compose: 헬스체크, Claude 인증 마운트(ro), 프로젝트 디렉토리 마운트
- 이미지 크기: backend 874MB, frontend 80MB

## 테스트 방법

### WebSocket 재연결
1. 세션에서 Claude 실행 중 네트워크 일시 차단
2. 네트워크 복구 후 자동 재연결 확인
3. 재연결 후 놓친 메시지가 복구되는지 확인

### Docker
```bash
cp .env.docker.example .env.docker
# .env.docker 편집
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
# http://localhost:8100 접속
```
