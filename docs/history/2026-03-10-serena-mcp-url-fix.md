# 작업 이력: Serena MCP URL 설정 수정

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Serena MCP를 Docker 컨테이너화한 이후, MCP 연결 URL이 Docker 내부 네트워크에 맞지 않던 문제를 수정했습니다.

## 변경 파일 목록

### 설정

- `.mcp.json` - Serena URL을 Docker 서비스명 기반으로 변경

### Backend

- `backend/app/services/mcp_service.py` - URL 해석 regex에 `host.docker.internal` 패턴 추가

## 상세 변경 내용

### 1. `.mcp.json` URL 변경

- `http://localhost:9121/sse` → `http://serena:9121/sse`
- Serena가 Docker Compose 서비스로 이동했으므로, 같은 네트워크 내 서비스명으로 접근해야 함
- `localhost`는 자기 자신(backend 컨테이너)을 가리키므로 Serena에 도달 불가

### 2. `_resolve_url_for_docker_service()` regex 보강

- 기존: `localhost`, `127.0.0.1`만 매칭
- 변경: `host.docker.internal`도 매칭에 추가
- DB에 `host.docker.internal` URL이 저장된 경우에도 Docker 서비스명으로 올바르게 변환 가능

## 테스트 방법

1. Docker Compose로 serena 서비스 실행 확인
2. Claude Code에서 Serena MCP 도구 호출 정상 동작 확인

## 비고

- 이전 커밋 `4b5d8d0`에서 Serena Docker 컨테이너화 작업 수행
- 본 커밋은 그 후속 조치로 URL 설정을 Docker 네트워크에 맞게 보정
