# 작업 이력: CommitDialog AI 커밋 워크플로우 선택 기능 추가

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

git-monitor의 CommitDialog에서 AI 커밋 시 Skill(/git-commit) 외에 워크플로우를 선택할 수 있는 Select 드롭다운을 추가했습니다. 기본값은 "Workflow 3"으로 자동 선택됩니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - 워크플로우 Select UI 및 분기 로직 추가
- `frontend/src/features/session/hooks/useSessions.ts` - useCreateSession 훅에 workflow_definition_id 타입 추가

## 상세 변경 내용

### 1. useCreateSession 타입 보강

- `mutationFn` params와 `createSession` callback의 options 타입에 `workflow_definition_id?: string` 추가
- sessionsApi.create에는 이미 존재하던 필드이나 훅 레벨에서 누락되어 있었음

### 2. CommitDialog 워크플로우 Select 추가

- Select 드롭다운 UI: "Skill: /git-commit" 옵션 + API에서 가져온 워크플로우 목록
- 기본값: useEffect로 워크플로우 목록 로드 후 "Workflow 3" 이름의 워크플로우를 자동 선택
- handleAiCommit 분기: Skill 선택 시 기존 동작 유지, 워크플로우 선택 시 workflow_definition_id 전달
- 버튼 비활성화: 워크플로우 목록 미로드 시 "세션 열기" 버튼 비활성화
- 설명 텍스트: 선택된 방식에 따라 동적으로 변경

## 테스트 방법

1. git-monitor 페이지에서 변경사항이 있는 워크스페이스의 Commit 버튼 클릭
2. AI 커밋 모드에서 Select가 "Workflow 3"으로 기본 선택되어 있는지 확인
3. "Skill: /git-commit" 선택 시 기존 동작(세션 생성 + /git-commit 스킬)이 유지되는지 확인
4. 워크플로우 선택 시 세션이 workflow_definition_id와 함께 생성되는지 확인
