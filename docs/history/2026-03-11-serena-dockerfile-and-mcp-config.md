# 작업 이력: Serena Dockerfile 경로 수정 및 .mcp.json 환경 분리

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Serena Dockerfile에서 editable 패키지 경로 문제를 수정하고, `.mcp.json`을 gitignore하여 호스트/Docker 환경별로 독립적인 MCP 설정을 사용하도록 분리했습니다.

## 변경 파일 목록

### Infrastructure

- `serena/Dockerfile` - .venv 내 .pth, .egg-link, direct_url.json 경로 치환 추가
- `.gitignore` - `.mcp.json` 추가
- `.mcp.json.example` - 호스트 환경용 예시 파일 신규 생성
- `.mcp.json` - Git 추적 제거 (로컬 파일 유지)

## 상세 변경 내용

### 1. Serena Dockerfile .pth 경로 수정

- 복사 후 `.venv/bin/*`의 shebang만 수정했으나 editable 패키지의 `.pth`, `.egg-link`, `direct_url.json` 파일도 원래 경로를 참조하여 `ModuleNotFoundError` 발생
- `find + sed`로 해당 파일들의 경로도 모두 `/workspaces/serena` → `/opt/serena`로 치환

### 2. .mcp.json 환경별 분리

- 호스트(Windows): `http://localhost:9121/sse` (직접 접근)
- Docker 내부: `http://serena:9121/sse` (서비스명 접근)
- `.mcp.json`을 gitignore하고 `.mcp.json.example`을 공유하여 환경별 설정 충돌 방지

## 관련 커밋

- `5b65dfd` - Fix: Serena 컨테이너 .venv 경로 충돌로 인한 구동 실패 수정 (이전)

## 비고

- `.mcp.json.example`을 복사하여 환경에 맞게 URL 수정 후 사용
