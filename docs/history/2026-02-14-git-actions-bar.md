# 작업 이력: Git Actions Bar 추가

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 ChatHeader에 Git 작업 버튼(Commit/PR/Rebase/워크트리 삭제)을 추가하여, 코드 변경사항이 있을 때 한 클릭으로 Git 작업을 트리거할 수 있게 했습니다. 또한 워크트리 삭제 API를 새로 구현하여, 워크트리 디렉토리와 연결된 브랜치를 함께 정리합니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/filesystem.py` - GitInfo에 `is_worktree` 필드 추가
- `backend/app/services/filesystem_service.py` - 워크트리 판별 로직 + `remove_worktree` 메서드 추가
- `backend/app/api/v1/endpoints/filesystem.py` - DELETE /api/fs/worktrees 엔드포인트 추가

### Frontend

- `frontend/src/types/filesystem.ts` - GitInfo 타입에 `is_worktree` 추가
- `frontend/src/features/chat/components/GitActionsBar.tsx` - 신규 컴포넌트
- `frontend/src/features/chat/components/ChatHeader.tsx` - GitActionsBar 통합
- `frontend/src/features/chat/components/ChatPanel.tsx` - gitInfo 전달 + 자동 갱신 + 워크트리 삭제 핸들러
- `frontend/src/lib/api/filesystem.api.ts` - removeWorktree API 함수 추가

## 상세 변경 내용

### 1. GitInfo is_worktree 필드

- `git rev-parse --git-dir` vs `--git-common-dir` 비교로 워크트리 여부 판별
- 워크트리에서는 git-dir이 `.git/worktrees/<name>` 형태로 git-common-dir과 다름

### 2. GitActionsBar 컴포넌트

- Commit 버튼: 미커밋 변경사항 있을 때 표시 (green), `/git-commit --no-history` 전송
- PR 버튼: 변경사항 또는 미푸시 커밋 있을 때 표시 (blue), PR 생성 프롬프트 전송
- Rebase 버튼: 워크트리이면서 변경사항/커밋 있을 때 표시 (amber), `/git-merge-rebase` 전송
- 워크트리 삭제 버튼: 워크트리일 때 항상 표시 (red), AlertDialog 확인 후 API 호출

### 3. 워크트리 삭제 API

- `DELETE /api/fs/worktrees?path=...&force=...` 엔드포인트
- 워크트리 삭제 후 연결된 브랜치도 자동 삭제 (메인 브랜치 보호)
- 프론트에서 워크트리 삭제 -> 세션 삭제 -> 홈 이동 + toast 알림

### 4. GitInfo 자동 갱신

- 세션 상태가 running -> idle로 전환 시 1.5초 후 gitInfo 쿼리 자동 invalidate
- 변경사항 상태에 따라 버튼이 동적으로 표시/숨김

## 관련 커밋

- 커밋 후 업데이트 예정

## 테스트 방법

1. Git 레포에서 세션 생성 -> ChatHeader에 버튼 표시 확인
2. 파일 수정 후 -> Commit/PR 버튼 표시 확인
3. 워크트리 세션 -> Rebase + 삭제 버튼 추가 표시 확인
4. 버튼 클릭 -> 프롬프트 전송 / 워크트리 삭제 동작 확인
