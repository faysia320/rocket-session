# 작업 이력: Git 메뉴 개선

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: feature-git-menu

## 변경 요약

Git Monitor 페이지의 레이아웃을 개선하고, PR Review Drawer의 마크다운 렌더링을 수정하고, Claude Code 기반 AI PR Review 기능을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/filesystem.py` - PR Review 요청/응답 스키마 4개 추가
- `backend/app/services/filesystem_service.py` - Claude Code CLI 리뷰 생성 및 gh pr comment 게시 메서드 추가
- `backend/app/api/v1/endpoints/filesystem.py` - POST /gh-pr-review, /gh-pr-review-submit 엔드포인트 추가

### Frontend

- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - 상단 버튼 제거, 좌우 2분할 레이아웃
- `frontend/src/features/git-monitor/components/GitHubPRDetailView.tsx` - 마크다운 렌더링 수정, AI Review 탭 추가
- `frontend/src/types/filesystem.ts` - PRReviewResponse, PRReviewSubmitResponse 타입 추가
- `frontend/src/types/index.ts` - 새 타입 re-export
- `frontend/src/lib/api/filesystem.api.ts` - generatePRReview, submitPRReviewComment API 함수 추가

## 상세 변경 내용

### 1. 상단 우측 저장소 추가 버튼 제거

- GitMonitorPage 헤더의 "저장소 추가" Button 제거
- 좌측 RepoList의 `+` 버튼과 빈 상태의 "첫 저장소 추가" 버튼은 유지

### 2. Status와 Pull Requests 좌우 2분할 레이아웃

- 기존 3탭 구조([Status] [Commits] [PRs])에서 좌우 분할로 변경
- 좌측: [Status | Commits] 서브탭 (flex 50%)
- 우측: Pull Requests (flex 50%)
- 중앙에 border-r 구분선

### 3. PR Comments 마크다운 렌더링 수정

- Reviews/Comments 본문을 감싸던 `<div className="text-xs text-muted-foreground">` 래퍼 제거
- MarkdownRenderer에 `className="text-xs"` props로 직접 전달하여 prose-chat 스타일이 정상 적용되도록 수정

### 4. Claude Code 기반 AI PR Review 기능

- **백엔드 워크플로우**:
  1. PR 상세 정보(제목, 본문, 작성자 등) + diff를 수집
  2. Claude Code CLI(`claude -p --output-format text`)로 리뷰 생성 (최대 120초 타임아웃)
  3. diff가 50,000자를 초과하면 잘라냄 (토큰 제한 고려)
  4. `gh pr comment`로 GitHub에 코멘트 게시
- **프론트엔드 UI**:
  - PR 상세 Sheet에 AI Review 탭 추가 (Overview / Diff / AI Review)
  - "AI 리뷰 생성" 버튼 → 로딩 상태 → 마크다운 미리보기
  - "PR에 게시" 버튼 → gh pr comment으로 GitHub에 코멘트 게시
  - "복사" / "재생성" 보조 버튼 제공

## 테스트 방법

1. Git Monitor 페이지 접속하여 레이아웃 확인 (좌우 2분할)
2. PR 클릭 → Sheet 열기 → Comments/Reviews 마크다운 확인
3. AI Review 탭 → "AI 리뷰 생성" 클릭 → 미리보기 확인
4. "PR에 게시" 클릭 → GitHub에서 코멘트 확인

## 비고

- Claude Code CLI가 설치되어 있어야 AI Review 기능 사용 가능
- gh CLI 인증이 필요 (gh auth login)
