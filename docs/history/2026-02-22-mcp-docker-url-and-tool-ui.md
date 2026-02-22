# 작업 이력: MCP Docker URL 자동변환 + MCP 도구 UI 표시 개선

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 환경에서 MCP SSE 서버의 localhost URL이 동작하지 않는 문제를 해결하고, 대시보드에서 MCP 도구 호출을 시각적으로 구분할 수 있도록 UI를 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/mcp_service.py` - Docker localhost 자동변환 로직 추가

### Frontend

- `frontend/src/features/chat/components/toolMessageUtils.ts` - MCP 이름 파싱, 아이콘/색상 매핑
- `frontend/src/features/chat/components/MessageBubble.tsx` - MCP Provider 뱃지, Summary 개선

## 상세 변경 내용

### 1. Docker localhost → host.docker.internal 자동변환

- Docker 컨테이너 내에서 `/.dockerenv` 파일 존재를 감지하여 실행 환경 판별
- `build_mcp_config()` 호출 시 SSE URL의 `localhost`/`127.0.0.1`을 `host.docker.internal`로 자동 변환
- DB 원본 데이터는 유지하고, CLI에 전달하는 임시 config에만 적용
- 사용자가 대시보드 MCP 관리 UI에서 `localhost` URL로 등록해도 Docker 환경에서 자동 보정

### 2. MCP 도구 UI 표시 개선

- `parseMcpToolName()`: `mcp__serena__file_search` → `{provider: "serena", toolName: "file_search"}` 파싱
- Provider별 아이콘 매핑 (serena→Search, github→GitBranch, playwright→Globe, context7→FileText, 기타→Plug)
- MCP 도구 전용 보라색(`text-violet-400`) 색상 적용
- MCP Provider 뱃지 (보라색 배지 + 도구명) 표시
- `getToolSummary()`에서 MCP 도구의 query/path 파라미터 자동 추출

## 테스트 방법

1. Docker 환경에서 MCP SSE 서버를 `localhost` URL로 등록
2. 세션 생성 후 MCP 도구 사용 시 정상 연결 확인
3. 대시보드에서 MCP 도구 호출 시 보라색 Provider 뱃지 표시 확인
