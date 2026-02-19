# 작업 이력: 세션별 MCP 서버 관리 기능

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

글로벌 MCP 서버 풀을 관리하고, 세션별로 사용할 MCP 서버를 선택하여 Claude CLI의 `--mcp-config`로 전달하는 기능을 구현했습니다. `~/.claude/settings.json`에서 자동 import도 지원합니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/schemas/mcp.py` - MCP 서버 Pydantic 스키마 (CRUD + 시스템 서버)
- `backend/app/services/mcp_service.py` - MCP 서버 CRUD, 시스템 import, config 빌드 서비스
- `backend/app/api/v1/endpoints/mcp.py` - MCP REST API 8개 엔드포인트

### Backend (수정)

- `backend/app/core/database.py` - `mcp_servers` 테이블 CREATE, 세션/글로벌에 `mcp_server_ids` 컬럼 마이그레이션, MCP CRUD 메서드 7개
- `backend/app/schemas/session.py` - `mcp_server_ids` 필드 추가 (Create/Update/Info)
- `backend/app/schemas/settings.py` - `mcp_server_ids` 필드 추가
- `backend/app/services/claude_runner.py` - `_setup_permission_mcp` → `_build_permission_mcp_dict` 리팩터링, `_setup_mcp_config` 통합 메서드 추가
- `backend/app/services/session_manager.py` - `mcp_server_ids` JSON 파싱/전달
- `backend/app/services/settings_service.py` - `mcp_server_ids` 지원
- `backend/app/api/dependencies.py` - `McpService` 싱글턴 DI
- `backend/app/api/v1/api.py` - MCP 라우터 등록
- `backend/app/api/v1/endpoints/sessions.py` - `mcp_server_ids` 파라미터 전달
- `backend/app/api/v1/endpoints/settings.py` - `mcp_server_ids` 파라미터 전달
- `backend/app/api/v1/endpoints/ws.py` - `mcp_service` 주입, `mcp_server_ids` 병합

### Frontend (신규)

- `frontend/src/types/mcp.ts` - MCP 타입 정의 (McpServerInfo, SystemMcpServer 등)
- `frontend/src/lib/api/mcp.api.ts` - MCP REST 클라이언트
- `frontend/src/features/mcp/hooks/useMcpServers.ts` - TanStack Query 훅 7개
- `frontend/src/features/mcp/components/McpServerForm.tsx` - 서버 등록/수정 폼 (stdio/SSE/Streamable HTTP)
- `frontend/src/features/mcp/components/McpServerList.tsx` - 서버 목록 (활성화 토글, 편집/삭제)
- `frontend/src/features/mcp/components/McpServerManager.tsx` - 서버 관리 (추가 + 시스템 import)
- `frontend/src/features/mcp/components/McpServerSelector.tsx` - 세션별 서버 선택 체크박스

### Frontend (수정)

- `frontend/src/types/session.ts` - `mcp_server_ids` 필드 추가
- `frontend/src/types/settings.ts` - `mcp_server_ids` 필드 추가
- `frontend/src/types/index.ts` - MCP 타입 barrel export
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - McpServerManager 섹션 삽입
- `frontend/src/features/session/components/SessionSettings.tsx` - McpServerSelector 삽입, loadSession/handleSave에 mcp_server_ids 연결

## 상세 변경 내용

### 1. 백엔드 데이터 모델

- `mcp_servers` 테이블: id, name(UNIQUE), transport_type, command, args(JSON), url, headers(JSON), env(JSON), enabled, source, timestamps
- `sessions` 테이블에 `mcp_server_ids TEXT` 컬럼 (JSON 배열)
- `global_settings` 테이블에 `mcp_server_ids TEXT` 컬럼 (JSON 배열)

### 2. MCP 서비스

- CRUD: create/read/update/delete with JSON 직렬화/역직렬화
- `read_system_servers()`: `~/.claude/settings.json`의 `mcpServers` 파싱
- `import_from_system()`: 시스템 서버를 `source="system"`으로 DB 저장
- `build_mcp_config()`: 선택된 MCP 서버 + Permission MCP를 병합한 config dict 반환

### 3. Claude CLI 통합

- `_setup_permission_mcp` → `_build_permission_mcp_dict`로 리팩터링 (파일 기록 없이 dict 반환)
- `_setup_mcp_config`: 사용자 MCP + Permission MCP를 병합하여 단일 `--mcp-config` 임시 파일 생성
- `run()` 메서드에 `mcp_service` 파라미터 추가, WS에서 주입

### 4. 프론트엔드 UI

- 글로벌 설정: McpServerManager (서버 풀 관리 + 시스템 import)
- 세션 설정: McpServerSelector (체크박스로 서버 선택)
- MCP 서버 폼: 3가지 transport (stdio/SSE/Streamable HTTP) 지원, Key-Value 편집기

## 테스트 방법

1. 글로벌 설정 → MCP SERVERS 섹션에서 "가져오기" → ~/.claude/settings.json의 서버 import
2. "추가" → stdio/SSE/Streamable HTTP 중 선택하여 새 MCP 서버 등록
3. 세션 설정 → MCP SERVERS 체크박스에서 사용할 서버 선택
4. 세션에서 프롬프트 전송 시 `--mcp-config`에 선택된 서버가 포함되는지 확인
5. Permission Mode + MCP 서버 동시 사용 시 병합 동작 확인

## 검증 결과

- TypeScript 타입 검사: EXIT 0 (에러 없음)
- Vite 프로덕션 빌드: 성공 (26.33초)
- Backend pytest: 166 passed, 0 failed
