# 작업 이력: ContextSuggestionPanel 버그 수정 및 역할 명확화

- **날짜**: 2026-03-01
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base 시스템 종합 검토를 통해 발견된 ContextSuggestionPanel의 설계 불일치와 버그를 수정했습니다. 백엔드가 이미 매 프롬프트마다 Memory 내용을 system_prompt에 자동 주입하고 있으므로(ws.py:208-225), 프론트엔드 패널의 Memory 섹션을 읽기 전용으로 전환하고 파일 제안 키워드 매칭을 활성화했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/context/components/ContextSuggestionPanel.tsx` - Memory 섹션 읽기 전용 전환, sourceLabel "Serena" 추가, buildContextText에서 Memory 블록 제거
- `frontend/src/features/chat/components/ChatInput.tsx` - `onInputChange` 콜백 prop 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - `liveInput` 상태 추가, prompt 연결, onInputChange 전달

## 상세 변경 내용

### 1. Memory 섹션을 읽기 전용으로 전환

- **무엇을**: Memory 파일 체크박스(`selectedMemoryPaths`, `toggleMemory`)를 제거하고, "Auto-injected" 배지가 있는 정보 표시 UI로 변경
- **왜**: 백엔드 ws.py:208-225에서 매 프롬프트마다 `build_memory_context()`로 전체 Memory 내용을 `<knowledge_base>` 블록으로 system_prompt에 자동 주입하고 있으므로, 프론트엔드에서 중복 선택할 필요가 없음. 기존에는 선택해도 파일 이름만(내용 미포함) 전송되어 사실상 무의미했음
- **어떻게**: `selectedMemoryPaths` 상태와 `toggleMemory` 콜백 삭제, `buildContextText`에서 Memory 블록 제거, JSX에서 `<label>` + `<Checkbox>` → `<div>` + `Badge("Auto-injected")`로 변경

### 2. sourceLabel에 "Serena" 추가

- `serena_memory` 소스가 UI에 raw string "serena_memory"로 표시되던 버그를 "Serena"로 수정

### 3. 키워드 기반 파일 제안 활성화

- **무엇을**: ChatPanel에서 ContextSuggestionPanel로 전달하는 `prompt` prop을 `""` → `liveInput`(사용자 실시간 입력)으로 변경
- **왜**: `prompt=""`로 하드코딩되어 있어 백엔드 `suggest_files()`의 키워드 매칭(40% 가중치) 기능이 완전히 비활성 상태였음
- **어떻게**: ChatInput에 `onInputChange` 콜백 prop 추가 → ChatPanel의 `liveInput` 상태로 연결 → ContextSuggestionPanel의 `prompt` prop으로 전달. 기존 500ms debounce가 API 호출 빈도를 제어

### 4. .claude/rules/ 디렉토리 생성 (로컬 전용)

- 4소스 중 비활성이던 Rules 경로를 `.claude/rules/.gitkeep`으로 활성화
- `.gitignore`에 `/.claude`가 포함되어 있어 커밋 대상 아님

## 테스트 방법

1. `pnpm build` — TypeScript 에러 없이 빌드 성공
2. `uv run pytest backend/tests/test_claude_memory_service.py backend/tests/test_context_builder_service.py -v` — 47/47 통과
3. ESLint — 새로운 에러/경고 0건

## 비고

- 이번 변경은 프론트엔드 전용으로, 백엔드 API 인터페이스 변경 없음
- 백엔드의 KB 자동 주입(ws.py:208-225)은 기존 커밋 `cd8f7af`에서 이미 구현되어 정상 동작 중
