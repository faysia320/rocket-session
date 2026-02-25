# 작업 이력: Git Monitor ScrollArea 적용 및 FilePanel 트리 뷰

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor의 워크스페이스 목록, Status 패널, Commits 패널에 Radix UI ScrollArea를 적용하여 디자인 시스템 일관성을 확보했습니다. FilePanel에 트리 뷰 모드를 추가하고, BranchSelect의 default 브랜치 Badge 스타일을 변경했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/files/components/FilePanel.tsx` - 트리 뷰 모드 추가 (목록/트리 전환, VS Code compact folders 패턴)
- `frontend/src/features/git-monitor/components/BranchSelect.tsx` - default 브랜치 Badge variant outline → secondary 변경
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - Status/Commits 패널에 ScrollArea 적용
- `frontend/src/features/git-monitor/components/GitMonitorRepoList.tsx` - 워크스페이스 목록에 ScrollArea 적용

## 상세 변경 내용

### 1. FilePanel 트리 뷰 모드

- 파일 변경 목록에 목록(List)/트리(Tree) 뷰 모드 전환 버튼 추가
- `buildFileTree()` 함수로 파일 경로를 트리 구조로 변환
- VS Code 스타일의 단일 자식 디렉토리 체인 압축 (compact folders)
- 디렉토리 우선 + 알파벳순 정렬
- 트리 노드별 Collapsible diff 뷰 지원

### 2. BranchSelect default 브랜치 Badge

- `variant="outline"` → `variant="secondary"`로 변경하여 가시성 개선

### 3. Git Monitor ScrollArea 적용

- 워크스페이스 목록: `overflow-auto` div → `ScrollArea` 컴포넌트
- Status 패널: `overflow-auto` div → `ScrollArea` + 내부 패딩 div
- Commits 패널: 동일 패턴 적용
- 프로젝트 내 다른 15개 파일과 동일한 Radix UI 스크롤바 패턴 적용

## 관련 커밋

- `Feat: Add FilePanel 트리 뷰 모드`
- `Design: BranchSelect default 브랜치 Badge 스타일 변경`
- `Design: Git Monitor 패널에 ScrollArea 적용`

## 검증 방법

- `npx tsc -p tsconfig.app.json --noEmit` 타입 검사 통과
- 각 패널에 Radix UI 스타일 스크롤바 표시 확인
