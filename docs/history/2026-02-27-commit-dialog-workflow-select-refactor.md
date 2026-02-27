# 작업 이력: CommitDialog AI 커밋 워크플로우 Select 역할 변경

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git 모달의 AI 커밋 기능에서 Workflow Select의 역할을 변경했습니다.
기존에는 "스킬 vs 워크플로우" 중 하나를 선택하는 구조였으나, 이제 워크플로우는 세션 생성 시 적용할 워크플로우만 선택하고 `/git-commit` 스킬은 항상 실행되도록 통합했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - AI 커밋 로직 통합 및 WorkflowDefinitionSelector 재사용

## 상세 변경 내용

### 1. Workflow Select 역할 변경

- 기존: `commitMethod` 상태로 `"__skill__"` (스킬 모드) vs 워크플로우 ID (워크플로우 모드) 분기
- 변경: `selectedWorkflow` 상태로 세션에 적용할 워크플로우만 선택, `/git-commit` 스킬은 항상 실행

### 2. 인라인 Select → WorkflowDefinitionSelector 컴포넌트 재사용

- 기존: 커스텀 인라인 Select (`__skill__` 옵션 + 워크플로우 목록)
- 변경: `WorkflowDefinitionSelector` 컴포넌트 재사용 (is_default 자동 선택, 정렬 등 내장)

### 3. handleAiCommit 로직 통합

- 기존: if/else 분기 (스킬이면 세션+스킬, 워크플로우이면 세션만)
- 변경: 항상 선택된 워크플로우로 세션 생성 + `setPendingPrompt("/git-commit")` 실행

### 4. imports 정리

- 제거: `Select` 관련 import 6개, `useWorkflowDefinitions`, `useEffect`
- 추가: `WorkflowDefinitionSelector`

## 관련 커밋

- 이력 문서 작성 시점에 커밋 전

## 비고

- 전체 프로젝트에 대한 코드 포맷팅(ruff/prettier) 변경도 함께 포함
