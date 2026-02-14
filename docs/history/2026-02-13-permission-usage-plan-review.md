# 작업 이력: Permission 모드, Usage 추적, Plan Review Dialog

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

3가지 주요 기능을 추가:
1. **Permission 모드**: 위험한 도구(Bash, Write 등) 실행 전 사용자 승인 요청
2. **Usage 추적**: Claude API 사용량(블록 단위) 하단 푸터 표시
3. **Plan Review Dialog**: Plan 모드 결과를 전용 다이얼로그에서 마크다운 렌더링하여 검토

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - Permission MCP 서버 연동, result 이벤트에 mode 필드 추가
- `backend/app/services/session_manager.py` - permission_mode/permission_required_tools 지원
- `backend/app/services/permission_mcp_server.py` - (신규) Permission MCP 서버 스크립트
- `backend/app/services/usage_service.py` - (신규) Claude 사용량 조회 서비스
- `backend/app/core/database.py` - permission 관련 컬럼 마이그레이션
- `backend/app/core/config.py` - claude_plan 설정 추가
- `backend/app/schemas/session.py` - permission 필드 추가
- `backend/app/schemas/usage.py` - (신규) 사용량 스키마
- `backend/app/api/v1/api.py` - permissions, usage 라우터 등록
- `backend/app/api/v1/endpoints/sessions.py` - permission 필드 전달
- `backend/app/api/v1/endpoints/ws.py` - permission_respond 메시지 처리
- `backend/app/api/v1/endpoints/permissions.py` - (신규) Permission REST API
- `backend/app/api/v1/endpoints/usage.py` - (신규) Usage REST API
- `backend/app/api/dependencies.py` - UsageService DI 추가

### Frontend

- `frontend/src/features/chat/components/PlanReviewDialog.tsx` - (신규) Plan 검토 다이얼로그
- `frontend/src/features/chat/components/ModeIndicator.tsx` - (신규) 상단바 Plan 모드 인디케이터
- `frontend/src/features/chat/components/PermissionDialog.tsx` - (신규) 권한 요청 다이얼로그
- `frontend/src/features/chat/components/PlanApprovalButton.tsx` - (신규) Plan 실행/취소 인라인 버튼
- `frontend/src/features/chat/components/ChatPanel.tsx` - PlanReviewDialog/ModeIndicator 통합
- `frontend/src/features/chat/components/MessageBubble.tsx` - Plan 전체보기 아이콘, permission 메시지
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - permission/mode 이벤트 처리
- `frontend/src/features/session/components/SessionSettings.tsx` - Permission Mode 설정 UI
- `frontend/src/features/usage/` - (신규) 사용량 표시 컴포넌트
- `frontend/src/lib/api/usage.api.ts` - (신규) Usage API 클라이언트
- `frontend/src/routes/__root.tsx` - UsageFooter 추가
- `frontend/src/types/message.ts` - PermissionRequestData, mode/planExecuted 필드
- `frontend/src/types/session.ts` - permission 관련 타입
- `frontend/src/types/usage.ts` - (신규) 사용량 타입
- `frontend/src/types/index.ts` - 새 타입 barrel export
- `frontend/src/index.css` - .prose-plan 마크다운 스타일

## 상세 변경 내용

### 1. Permission 모드

- 세션 설정에서 Permission Mode를 활성화하고 승인 필요 도구를 선택 가능
- 활성화 시 Claude CLI에 MCP permission 서버를 연결하여 도구 실행 전 사용자 승인 요청
- WebSocket으로 permission_request/permission_response 이벤트 전달
- PermissionDialog 컴포넌트로 Allow/Deny UI 제공

### 2. Usage 추적

- UsageService가 Claude 사용량(블록 단위) 정보 조회
- 하단 UsageFooter 컴포넌트로 현재 사용량 표시
- REST API를 통해 사용량 데이터 제공

### 3. Plan Review Dialog

- Plan 모드 결과 도착 시 PlanReviewDialog 자동 오픈
- react-markdown + remark-gfm으로 풀 마크다운 렌더링
- Execute Plan / Revise / Close 3가지 액션 제공
- ModeIndicator로 상단바에 Plan 모드 상태 표시
- 인라인 Maximize2 아이콘으로 Dialog 재오픈 가능

## 테스트 방법

```bash
cd backend && uv run python -c "from app.main import app; print('OK')"
cd frontend && npx tsc -p tsconfig.app.json --noEmit
cd frontend && pnpm build
```

수동 테스트:
1. Permission Mode: 세션 설정에서 활성화 → 도구 실행 시 승인 다이얼로그 확인
2. Usage: 하단 푸터에서 사용량 표시 확인
3. Plan Review: Plan 모드로 프롬프트 전송 → Dialog 자동 표시 → 실행/수정/닫기 동작 확인
