# 작업 이력: PR AI 리뷰 비동기 분리

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

PR AI 리뷰 생성 기능을 동기 REST 호출에서 비동기 2단계(요청 → 폴링) 패턴으로 분리하여,
프론트엔드 API 타임아웃(30초)으로 인한 "signal is aborted without reason" 오류를 해결했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/filesystem.py` - `PRReviewJobResponse`, `PRReviewStatusResponse` 스키마 추가
- `backend/app/services/filesystem_service.py` - `_ReviewJob` dataclass, 비동기 작업 생성/조회/실행/정리 메서드 추가
- `backend/app/api/v1/endpoints/filesystem.py` - POST 응답 변경 + GET 상태 조회 엔드포인트 추가

### Frontend

- `frontend/src/types/filesystem.ts` - `PRReviewJobResponse`, `PRReviewStatusResponse` 인터페이스 추가
- `frontend/src/types/index.ts` - barrel export 업데이트
- `frontend/src/lib/api/filesystem.api.ts` - `generatePRReview` 반환타입 변경 + `getPRReviewStatus` 추가
- `frontend/src/features/git-monitor/components/GitHubPRDetailView.tsx` - mutation → mutation + polling 패턴 전환

## 상세 변경 내용

### 1. 비동기 2단계 패턴 도입

**문제**: 프론트엔드 `ApiClient`의 기본 타임아웃(30초)이 백엔드 Claude CLI 실행 타임아웃(120초)보다 짧아,
30초 후 `AbortController`가 fetch를 중단하면서 "signal is aborted without reason" 오류 발생.

**해결**: 단일 동기 호출을 2단계로 분리:
- **Phase 1** (`POST /gh-pr-review`): `job_id`를 즉시 반환 (< 100ms)
- **Phase 2** (`GET /gh-pr-review-status/{job_id}`): 3초 간격 폴링으로 완료 확인

### 2. 백엔드 백그라운드 작업 관리

- `_ReviewJob` dataclass로 작업 상태 관리 (pending → completed/error)
- `asyncio.create_task()`로 백그라운드 실행
- 기존 `generate_pr_review()` 메서드를 그대로 활용 (하위 호환성)
- 1시간 TTL 기반 자동 정리 (`_cleanup_old_review_jobs`)

### 3. 프론트엔드 폴링 패턴

- `useMutation` (trigger) + `useQuery` (polling) + `useEffect` (상태 반영)
- `refetchInterval`이 `status === "pending"` 동안만 3초 폴링, 완료 시 자동 중지
- `isReviewLoading` 통합 로딩 상태로 UI 제어

## 관련 커밋

- (이 문서와 함께 커밋됨)

## 테스트 방법

1. PR 상세 → AI 리뷰 탭 → "AI 리뷰 생성" 클릭
2. 즉시 "리뷰 생성 중…" 표시 확인 (30초 이상 대기 시에도 오류 없음)
3. 완료 후 마크다운 리뷰 미리보기 정상 표시 확인
4. TypeScript 타입 검사: `npx tsc -p tsconfig.app.json --noEmit` 통과
5. 프로덕션 빌드: `pnpm build` 성공
