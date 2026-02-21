# 작업 이력: Git Monitor 커밋 버튼 Race Condition 수정

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor에서 커밋 버튼 클릭 시 새 세션이 아닌 기존 세션에서 `/git-commit` 명령이 실행되는 Race Condition 버그를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/store/useSessionStore.ts` - `pendingPromptSessionId` 필드 추가, `setPendingPrompt`에 대상 세션 ID 파라미터 추가
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` - `createSession` 성공 후에 세션 ID와 함께 `setPendingPrompt` 호출하도록 순서 변경

## 상세 변경 내용

### 1. 버그 원인 분석

기존 흐름:
1. `setPendingPrompt("/git-commit")` 동기 실행 → Zustand 전역 상태 즉시 업데이트
2. `createSession(path)` 비동기 실행 → API 요청 시작
3. 현재 마운트된 ChatPanel(기존 세션)이 `connected=true` + `pendingPrompt` 변경 감지
4. 기존 세션의 useEffect가 먼저 트리거되어 잘못된 세션으로 프롬프트 전송

### 2. 수정 내용

- `pendingPromptSessionId` 필드를 Zustand store에 추가하여 프롬프트 대상 세션을 명시
- `setPendingPrompt`를 `createSession` 성공 후에 호출하여 실제 생성된 세션 ID와 함께 전달
- ChatPanel의 useEffect에서 `pendingPromptSessionId === sessionId` 조건을 추가하여 대상 세션의 ChatPanel만 프롬프트 소비

## 테스트 방법

1. Git Monitor에 저장소 추가
2. 변경사항이 있는 상태에서 커밋 버튼 클릭
3. 새 세션이 생성되고 해당 세션에서 `/git-commit` 명령이 실행되는지 확인
4. Split View 모드에서도 동일하게 올바른 세션에서 실행되는지 확인
