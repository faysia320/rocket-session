# 작업 이력: Claude Code 데스크톱 앱 기능 보완 (4가지 + 기반 작업)

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Claude Code 데스크톱 앱과의 기능 패리티를 위해 4가지 주요 기능을 추가했습니다.
기반 작업으로 tool_use/tool_result 히스토리 영속화와 대시보드 모바일 레이아웃 개선도 포함됩니다.

## 기능 목록

### 1. 컨텍스트 윈도우 모델별 시각화 (Feature 1)

모델별 context window 크기를 동적으로 표시합니다. 기존 200k 하드코딩을 제거하고 모델명 기반 매핑으로 대체합니다.

- `frontend/src/lib/modelContextMap.ts` - 모델→context window 매핑 유틸리티
- `frontend/src/features/chat/components/ContextWindowBar.tsx` - 동적 max + 모델명 표시
- `frontend/src/features/session/components/SessionStatsBar.tsx` - model prop 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - model prop 전달

### 2. Permission 신뢰 레벨 (Feature 2)

도구 사용 승인 시 "이번만 / 세션 동안 / 항상" 3가지 신뢰 수준을 선택할 수 있습니다.

- `backend/migrations/versions/20260222_0003_add_trusted_tools.py` - globally_trusted_tools 컬럼
- `backend/app/api/v1/endpoints/permissions.py` - 세션/글로벌 신뢰 도구 자동 승인
- `backend/app/api/v1/endpoints/ws.py` - trust_level 파싱
- `frontend/src/features/chat/components/PermissionDialog.tsx` - 4버튼 UI
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - trust_level 전송

### 3. 멀티 디렉토리 + Fallback 모델 (Feature 3)

Claude Code의 `--add-dir`와 `--fallback-model` CLI 플래그를 지원합니다.

- `backend/migrations/versions/20260222_0004_add_dirs_fallback.py` - 3개 테이블에 컬럼 추가
- `backend/app/services/claude_runner.py` - CLI 플래그 빌드
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 디렉토리 추가/삭제 UI + fallback 입력

### 4. 세션 포크/분기 (Feature 4)

기존 세션의 설정과 대화를 복사하여 새 세션을 생성합니다.

- `backend/migrations/versions/20260222_0005_add_fork_fields.py` - parent_session_id, forked_at_message_id
- `backend/app/repositories/message_repo.py` - copy_messages_to_session()
- `backend/app/services/session_manager.py` - fork() 메서드
- `backend/app/api/v1/endpoints/sessions.py` - POST /{session_id}/fork
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` - 포크 메뉴
- `frontend/src/features/chat/components/ChatPanel.tsx` - 포크 핸들러

### 5. 기반: Tool Use/Result 히스토리 영속화

tool_use와 tool_result 메시지를 DB에 저장하고 히스토리 복원 시 도구 호출 카드로 렌더링합니다.

- `backend/migrations/versions/20260222_0002_add_tool_message_columns.py` - message_type, tool_use_id 등
- `backend/app/models/message.py` - 4개 tool 컬럼 추가
- `backend/app/services/jsonl_watcher.py` - tool_use/tool_result 메시지 저장
- `backend/app/services/claude_runner.py` - tool_use/tool_result 메시지 저장
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - tool 메시지 복원 로직

### 6. 기반: 대시보드 모바일 반응형

모바일에서 Sessions / Git Monitor를 탭으로 전환합니다.

- `frontend/src/features/dashboard/components/DashboardGrid.tsx` - 탭 UI + 모바일 레이아웃
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 사이드바 토글 버튼

## 공통 변경 파일 (여러 기능에 걸침)

### Backend

- `backend/app/models/session.py` - additional_dirs, fallback_model, parent_session_id, forked_at_message_id
- `backend/app/models/global_settings.py` - globally_trusted_tools, additional_dirs, fallback_model
- `backend/app/models/template.py` - additional_dirs, fallback_model
- `backend/app/repositories/session_repo.py` - _session_to_dict에 새 필드 추가
- `backend/app/services/session_manager.py` - create/update/fork/to_info에 새 필드
- `backend/app/services/settings_service.py` - get/update에 새 필드
- `backend/app/api/v1/endpoints/sessions.py` - create/update/fork/delete 수정
- `backend/app/api/v1/endpoints/settings.py` - update에 새 필드 전달
- `backend/app/schemas/session.py` - 새 필드 + ForkSessionRequest
- `backend/app/schemas/settings.py` - 새 필드
- `backend/app/schemas/template.py` - 새 필드

### Frontend

- `frontend/src/types/session.ts` - additional_dirs, fallback_model, parent_session_id, forked_at_message_id
- `frontend/src/types/settings.ts` - globally_trusted_tools, additional_dirs, fallback_model
- `frontend/src/types/template.ts` - additional_dirs, fallback_model
- `frontend/src/lib/api/sessions.api.ts` - fork() + create options 확장
- `frontend/src/features/session/hooks/useSessions.ts` - create options 확장
- `frontend/src/features/chat/components/ChatHeader.tsx` - onFork prop

## 테스트 방법

1. Docker 이미지 재빌드 후 컨테이너 재시작
2. Alembic 마이그레이션 자동 적용 확인 (migrations 0002~0005)
3. 세션 생성 → 추가 디렉토리/Fallback 모델 설정 확인
4. Permission 모드 ON → 도구 사용 시 4버튼 승인 UI 확인
5. Context Window Bar에 모델명 + 동적 크기 표시 확인
6. 세션 메뉴 → "세션 포크" 클릭 → 새 세션 생성 + 메시지 복사 확인
