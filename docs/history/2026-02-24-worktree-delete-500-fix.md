# 작업 이력: 워크트리 삭제 500 에러 수정

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크트리 세션에서 "워크트리 삭제" 버튼 클릭 시 발생하던 500 Internal Server Error를 수정했습니다.
근본 원인은 두 가지: (1) `git worktree remove` 실패 시 복구 전략 부재, (2) Claude 프로세스가 워크트리 디렉토리를 점유한 상태에서 삭제 시도.

## 변경 파일 목록

### Backend

- `backend/app/services/git_service.py` - `remove_claude_worktree` 폴백 정리 전략 추가
- `backend/app/api/v1/endpoints/filesystem.py` - OSError 예외 처리 추가

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - 세션 삭제 → 워크트리 삭제 순서 변경

## 상세 변경 내용

### 1. Backend: `remove_claude_worktree` 폴백 전략 (git_service.py)

- 워크트리 디렉토리 존재 여부를 사전 검증
- `git worktree remove` 실패 시 `shutil.rmtree`로 디렉토리 수동 삭제 + `git worktree prune`으로 메타데이터 정리
- 디렉토리가 이미 없는 경우 `git worktree prune`만 실행 (더 이상 RuntimeError 발생하지 않음)

### 2. Frontend: 삭제 순서 변경 (ChatPanel.tsx)

- 기존: `removeWorktree()` → `sessionsApi.delete()` (프로세스가 디렉토리를 잡고 있어 삭제 실패)
- 변경: `sessionsApi.delete()` → `removeWorktree()` (Claude 프로세스 종료 후 워크트리 삭제)

### 3. Backend: 예외 처리 보강 (filesystem.py)

- `RuntimeError`만 잡던 것을 `(RuntimeError, OSError)`로 확장하여 파일시스템 관련 예외도 적절히 처리

## 테스트 방법

1. 워크트리 세션에서 "워크트리 삭제" 버튼 클릭 → 정상 삭제 확인
2. 이미 삭제된 워크트리에 대해 삭제 요청 → 에러 없이 정리 완료
3. running 상태 세션에서 워크트리 삭제 → 세션 종료 후 정상 삭제
