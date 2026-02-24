# 작업 이력: Docker Frontend 자동설치 + ChatInput 정렬 + Worktree Git 메뉴 수정

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 컨테이너 시작 시 Frontend node_modules 자동 설치 기능 추가, ChatInput 입력창 세로축 중앙 정렬 수정, Worktree 세션에서 Git 드롭다운 메뉴가 보이지 않는 문제 수정.

## 변경 파일 목록

### 인프라 (Docker)

- `.env.docker.example` - `FRONTEND_DIR` 환경변수 추가
- `backend/Dockerfile` - pnpm 글로벌 설치 추가
- `backend/entrypoint.sh` - 컨테이너 시작 시 frontend node_modules 자동 설치 로직
- `docker-compose.yml` - `FRONTEND_DIR` 환경변수 전달

### Frontend

- `frontend/src/features/chat/components/ChatInput.tsx` - Textarea 세로 중앙 정렬
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - worktree 세션 게이트 순서 변경
- `frontend/src/features/chat/components/ChatPanel.tsx` - 워크트리 전환 시 git-info 캐시 무효화

## 상세 변경 내용

### 1. Docker Frontend node_modules 자동 설치

- `FRONTEND_DIR` 환경변수로 frontend 경로 지정 시 컨테이너 시작 시 `pnpm install --frozen-lockfile` 자동 실행
- node_modules가 이미 있으면 건너뜀
- Dockerfile에 pnpm 글로벌 설치 추가

### 2. ChatInput 입력창 세로축 중앙 정렬

- Textarea의 `py-[6px]`(12px) + `leading-[20px]`(20px) = 32px가 `min-h-9`(36px)와 불일치하여 텍스트가 위로 치우침
- `py-[6px]` → `py-2`(8px)로 변경하여 8+20+8=36px = min-h-9 정확히 일치

### 3. Worktree 세션 Git 드롭다운 메뉴 수정

- `isWorktreeSession` 판정을 `gitInfo?.is_git_repo` 체크보다 먼저 수행
- worktree 세션이면 gitInfo 로딩/실패와 무관하게 Rebase & Merge, 워크트리 삭제 메뉴 표시
- `gitInfo.ahead` → `gitInfo?.ahead ?? 0`으로 null-safe 처리
- 워크트리 전환 성공 후 `git-info` 쿼리 캐시 무효화 추가

## 테스트 방법

1. TypeScript 타입 검사: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
2. Worktree 세션 열기 → Git 드롭다운에 Rebase & Merge, 워크트리 삭제 표시 확인
3. 일반 세션에서 "워크트리로 전환" → 전환 후 Git 드롭다운에 worktree 메뉴 표시 확인
