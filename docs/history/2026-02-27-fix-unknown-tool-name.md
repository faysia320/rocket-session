# 작업 이력: Tool 메시지 "unknown" 표시 문제 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Claude Code CLI의 `assistant` 이벤트 내 `tool_use` 블록에서 `name` 필드가 누락되거나 비어있을 때,
채팅 UI에서 도구 이름이 "unknown"으로 표시되는 문제를 수정했습니다.
공통 헬퍼 함수로 여러 대체 필드명을 방어적으로 파싱하고, 불완전한 블록은 스킵하며 진단 로깅을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/event_handler.py` - `extract_tool_use_info()` 헬퍼 함수 추가
- `backend/app/services/claude_runner.py` - TurnState에 `seen_tool_use_ids` 추가, 방어적 파싱 + 중복 방지 + 로깅, 파일 경로 fallback 개선
- `backend/app/services/jsonl_watcher.py` - tool_use 파싱 방어적 개선 + 로깅, 파일 경로 fallback 개선

### Frontend

- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - fallback 텍스트 "unknown" → "Tool"
- `frontend/src/features/chat/components/MessageBubble.tsx` - fallback 텍스트 "unknown" → "event"

## 상세 변경 내용

### 1. 공통 헬퍼 함수 (`extract_tool_use_info`)

- `name`/`tool`/`tool_name`, `input`/`arguments`/`parameters` 등 여러 대체 필드명을 시도
- CLI 버전 업데이트로 필드명이 변경되더라도 방어적으로 대응

### 2. 불완전한 블록 스킵 + 진단 로깅

- `tool_name`이 비어있으면 WARNING 로그에 블록 전체를 덤프하고 해당 블록 스킵
- 후속 완전한 블록이 도착하면 정상 처리

### 3. 중복 tool_use_id 방지

- `TurnState.seen_tool_use_ids` set으로 동일 tool_use_id 재처리 방지
- CLI가 incremental하게 같은 블록을 여러 번 전송해도 한 번만 처리

### 4. 파일 경로 fallback 개선

- `tool_input.get("file_path", tool_input.get("path", "unknown"))` 패턴을
  `tool_input.get("file_path") or tool_input.get("path") or ""` 로 변경
- falsy 값(`""`, `None`)도 올바르게 fallback 처리

### 5. 프론트엔드 fallback 텍스트 개선

- 히스토리 복원 시 도구 이름 fallback: "unknown" → "Tool"
- 이벤트 타입 fallback: "unknown" → "event"

## 테스트 방법

1. Docker 이미지 재빌드 + 컨테이너 재시작
2. 새 세션에서 도구를 사용하는 프롬프트 실행 (예: "이 프로젝트 구조를 알려줘")
3. tool 메시지에 도구 이름(Read, Glob 등)이 정상 표시되는지 확인
4. 컨테이너 로그(`docker logs`)에서 "tool_use 블록에 name 누락" 경고로 근본 원인 파악
5. 세션 새로고침 후 히스토리 복원 시에도 도구 이름 정상 표시 확인

## 비고

- 근본 원인 추정: CLI가 `assistant` 이벤트를 incremental하게 전송하여 첫 블록에 name이 없을 수 있음
- 진단 로깅으로 실제 원인을 추적한 후, 필요 시 추가 최적화 가능
