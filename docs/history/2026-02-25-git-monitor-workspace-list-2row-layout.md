# 작업 이력: Git 모니터 워크스페이스 목록 2행 레이아웃 변경

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git 모니터 좌측 워크스페이스 패널의 각 아이템을 1행(Repo 이름) + 2행(Branch + Clean 여부) 2행 레이아웃으로 변경했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/git-monitor/components/GitMonitorRepoList.tsx` - RepoItem 컴포넌트 2행 레이아웃으로 변경

## 상세 변경 내용

### 1. RepoItem 2행 레이아웃 적용

- 기존 `flex items-center` 단일 행 → `flex flex-col` 2행 레이아웃으로 변경
- **1행**: 폴더 아이콘 + 워크스페이스 이름
- **2행**: Branch Badge + clean/dirty 상태 텍스트 (아이콘 정렬 맞춤 `pl-[18px]`)
- clean/dirty 상태에 텍스트 라벨 추가하여 가독성 향상
- Branch Badge max-width를 80px → 100px로 확대
- status가 ready가 아닌 경우(cloning, error, deleting)에도 텍스트 라벨 표시

## 테스트 방법

1. Git 모니터 페이지 접속
2. 좌측 워크스페이스 목록에서 각 아이템이 2행으로 표시되는지 확인
3. 1행에 Repo 이름, 2행에 Branch와 clean/dirty 상태가 표시되는지 확인
