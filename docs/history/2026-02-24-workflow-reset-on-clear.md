# 작업 이력: Clear 시 워크플로우 리셋 + UI 레이아웃 조정

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

대화 기록 초기화(Clear) 시 워크플로우 상태를 Research 초기 상태로 리셋하고 아티팩트를 삭제하는 기능을 추가했습니다. 또한 ChatPanel의 ActivityStatusBar와 SessionStatsBar 위치를 재조정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - Clear 핸들러에 워크플로우 리셋 로직 추가
- `backend/app/repositories/artifact_repo.py` - `delete_by_session()` 메서드 추가
- `backend/app/services/session_manager.py` - `workflow_original_prompt` _UNSET 센티넬 처리
- `backend/app/services/workflow_service.py` - `reset_workflow()` 메서드 추가

### Frontend

- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - Clear 시 워크플로우 상태 리셋
- `frontend/src/features/chat/components/ChatPanel.tsx` - ActivityStatusBar/SessionStatsBar 위치 변경
- `frontend/src/features/chat/components/ChatInput.tsx` - Textarea padding 미세 조정

### Docs

- `claude.md` - Frontend TypeScript 검사 유의사항 추가

## 상세 변경 내용

### 1. Clear 시 워크플로우 리셋 (Backend)

- `_handle_clear()`에서 워크플로우 활성 세션일 경우 `workflow_service.reset_workflow()` 호출
- `reset_workflow()`: 아티팩트+주석 삭제 후 워크플로우 상태를 research/in_progress로 초기화
- `artifact_repo.delete_by_session()`: 세션의 모든 아티팩트와 주석을 일괄 삭제
- `session_manager.update_settings()`: `workflow_original_prompt`를 _UNSET 센티넬로 변경하여 None 값도 DB에 반영 가능

### 2. Clear 시 워크플로우 리셋 (Frontend)

- `claudeSocketReducer`의 CLEAR_HISTORY 액션에서 워크플로우 활성 시 sessionInfo의 phase/status를 research/in_progress로 리셋
- 서버 응답을 기다리지 않고 즉시 UI에 반영하여 사용자 경험 개선

### 3. ChatPanel 레이아웃 조정

- ActivityStatusBar를 ChatInput 위로 이동 (활성 상태를 입력 필드 바로 위에서 확인)
- SessionStatsBar를 ChatInput 아래로 이동 (통계 정보는 하단 배치)
- ChatInput Textarea의 padding을 py-[5px] → py-[6px]로 미세 조정

## 관련 커밋

- `Fix: Clear 시 워크플로우 상태 리셋 + 아티팩트 삭제`
- `Design: ChatPanel 레이아웃 조정 - ActivityStatusBar/SessionStatsBar 위치 변경`
- `Docs: CLAUDE.md에 Frontend TS 검사 유의사항 추가`

## 비고

- `workflow_original_prompt` 파라미터는 기존에 None 체크로 필터링되어 Clear 후에도 이전 프롬프트가 남는 버그가 있었음 → _UNSET 센티넬 패턴으로 수정
