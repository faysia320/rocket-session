# 작업 이력: 글로벌 설정 기능 + CLI 미활용 데이터 전체 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

두 가지 주요 작업을 수행했습니다:
1. **글로벌 설정 기능**: 세션별 반복 설정 대신 글로벌 기본값을 한 번에 관리하는 Settings API/UI 추가
2. **CLI 미활용 데이터 개선**: Claude CLI의 stream-json 출력에서 무시되던 데이터(is_error, 토큰, 모델명, thinking 블록)를 전부 활용하도록 개선

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - global_settings 테이블 + messages 컬럼 6개 마이그레이션
- `backend/app/api/dependencies.py` - SettingsService DI 프로바이더 추가
- `backend/app/api/v1/api.py` - settings 라우터 등록
- `backend/app/api/v1/endpoints/settings.py` - 글로벌 설정 CRUD API (신규)
- `backend/app/api/v1/endpoints/sessions.py` - 세션 생성 시 글로벌 기본값 적용
- `backend/app/api/v1/endpoints/ws.py` - 프롬프트 실행 시 글로벌 설정 병합
- `backend/app/schemas/settings.py` - 설정 스키마 (신규)
- `backend/app/services/settings_service.py` - SettingsService (신규)
- `backend/app/services/session_manager.py` - add_message에 is_error/토큰/모델 파라미터 추가
- `backend/app/services/claude_runner.py` - turn_state 리팩토링 + thinking/is_error/usage/model 추출
- `backend/tests/test_api_endpoints.py` - SettingsService DI 오버라이드 추가

### Frontend

- `frontend/src/types/message.ts` - Message 필드 + MessageType/WebSocketEventType 확장
- `frontend/src/types/settings.ts` - GlobalSettings 타입 (신규)
- `frontend/src/types/index.ts` - settings 타입 export 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - HistoryItem 확장 + thinking 핸들러 + permission reason
- `frontend/src/features/chat/components/MessageBubble.tsx` - ResultMessage 메타데이터 UI + ThinkingMessage + ToolUse 시간
- `frontend/src/features/settings/` - 글로벌 설정 UI (신규 디렉토리)
- `frontend/src/lib/api/settings.api.ts` - Settings API 함수 (신규)
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 글로벌 work_dir 기본값 적용
- `frontend/src/features/session/components/Sidebar.tsx` - Header 제거 + Footer에 설정/테마/분할뷰/접기 통합
- `frontend/src/components/ui/scroll-area.tsx` - Viewport flex 레이아웃 수정

## 상세 변경 내용

### 1. 글로벌 설정 기능

- `global_settings` 테이블로 work_dir, allowed_tools, system_prompt, timeout, mode, permission 기본값 관리
- Sidebar Footer에 Settings 버튼 추가, Dialog로 설정 편집
- 세션 생성/프롬프트 실행 시 글로벌 설정을 fallback으로 활용
- Sidebar Header 제거 → Footer에 모든 액션 버튼 통합 (공간 절약)

### 2. CLI 미활용 데이터 개선 (Phase 1~4)

- **Phase 1 (P0)**: `result.is_error` 처리 - 에러 응답이 정상 메시지로 저장되던 버그 수정, Error 배지 UI
- **Phase 2 (P1)**: 토큰/모델 저장 - `turn_state` dict 리팩토링, usage 객체에서 토큰 추출, 모델명 배지 표시
- **Phase 3 (P2)**: thinking 블록 파싱 + ThinkingMessage 컴포넌트 (Collapsible), permission_response.reason 표시
- **Phase 4 (P3)**: tool_use 실행 시간 표시, system 이벤트 fallback, WebSocketEventType에 raw/thinking 추가

## 테스트 결과

- 백엔드 pytest: 174개 전체 통과
- 프론트엔드 tsc --noEmit: 에러 없음
- 프론트엔드 pnpm build: 성공

## 비고

- DB 마이그레이션은 ALTER TABLE 방식으로 기존 DB와 하위 호환
- thinking 블록은 extended thinking 모드 사용 시에만 활성화됨
