# 작업 이력: QA 검증 토스트 새로고침 시 반복 표시 버그 수정

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 QA 검증 실패 후 수정 요청(revision) 시, 새로고침할 때마다 `QA 검증: N건 실패` 토스트가 반복 표시되는 버그를 수정했습니다. 이벤트 재생 로직을 블랙리스트에서 화이트리스트 방식으로 전환하여 해결했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 이벤트 재생 화이트리스트 적용
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 반응형 오버플로우 처리 개선

### Config

- `.serena/project.yml` - Serena 설정 포맷 업데이트

## 상세 변경 내용

### 1. 토스트 반복 표시 버그 수정

**근본 원인**: 워크플로우 전체(research→implement→qa)가 하나의 턴(단일 `user_message` 이후)에서 실행되는데, `request_revision` 엔드포인트가 `runner.run()`을 호출할 때 `user_message` 이벤트를 broadcast하지 않음. 따라서 `get_current_turn_events()`가 이전 턴의 `workflow_qa_failed` 이벤트까지 포함하여 반환하고, 새로고침 시 이를 재생하면서 토스트가 반복 표시됨.

**수정 방법**: `current_turn_events` 재생 시 블랙리스트(3개 이벤트 스킵) → 화이트리스트(9개 이벤트만 허용)로 전환.

화이트리스트 항목: `assistant_text`, `thinking`, `tool_use`, `tool_result`, `result`, `file_change`, `permission_request`, `ask_user_question`, `stopped`

자동 제외 항목: `workflow_qa_failed`, `workflow_validation_failed`, `workflow_validation_max_retries`, `workflow_changed`, `workflow_auto_chain`, `error`, `system` 등

### 2. GlobalTopBar 반응형 개선

- 사용량 표시 영역과 우측 액션 영역에 `overflow-hidden` 추가
- 반응형 브레이크포인트를 `sm` → `md`로 조정하여 좁은 화면에서 레이아웃 깨짐 방지

## 테스트 방법

1. 워크플로우 실행 → QA 검증 실패 토스트 확인
2. "수정 요청" 클릭 → implement 단계 재진입
3. 페이지 새로고침 → 토스트 미표시 확인
4. `pnpm build` 통과 확인
