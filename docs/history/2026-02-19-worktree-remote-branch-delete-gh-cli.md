# 작업 이력: 워크트리 삭제 시 원격 브랜치 삭제 + gh CLI 사전 설치

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크트리 삭제 시 로컬 브랜치만 삭제되던 문제를 해결하여 원격 브랜치(origin)도 함께 삭제되도록 개선했습니다. 또한 Docker 컨테이너에 gh CLI를 사전 설치하여 Claude Code 세션에서 매번 재설치하는 오버헤드를 제거했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/filesystem_service.py` - `remove_worktree()` 메서드에 원격 브랜치 삭제 로직 추가
- `backend/Dockerfile` - gh CLI 공식 apt 저장소 등록 및 설치 추가
- `backend/entrypoint.sh` - `GH_TOKEN` 환경변수 export 추가 (gh CLI 인증)

### Frontend

- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - 삭제 확인 다이얼로그에 원격 브랜치 삭제 안내 추가

## 상세 변경 내용

### 1. 원격 브랜치 삭제 로직 (filesystem_service.py)

- `git ls-remote --heads origin <branch>`로 원격 브랜치 존재 여부 확인 (timeout 15초)
- 존재하면 `git push origin --delete <branch>` 실행 (timeout 30초)
- 보호 브랜치(main, master, develop, dev)는 원격 삭제 차단
- 실패 시 `logger.warning`만 기록하고 계속 진행 (워크트리/로컬 브랜치 삭제는 이미 완료)

### 2. Dockerfile gh CLI 설치

- GitHub CLI 공식 apt 저장소(cli.github.com/packages) GPG 키 등록
- `apt-get install -y gh`로 설치
- 기존 Node.js 설치 RUN 블록에 통합하여 레이어 최소화

### 3. entrypoint.sh GH_TOKEN 설정

- `GITHUB_TOKEN` 환경변수가 있을 때 `export GH_TOKEN="${GITHUB_TOKEN}"` 추가
- gh CLI는 `GH_TOKEN` 환경변수를 공식 인증 방식으로 지원

### 4. 확인 다이얼로그 문구 업데이트

- "원격 브랜치(origin)도 함께 삭제됩니다" 안내 문구 추가

## 테스트 방법

1. Backend 테스트: `uv run pytest` (166 passed)
2. Frontend 타입 검사: `npx tsc -p tsconfig.app.json --noEmit` (통과)
3. Docker 재빌드: `docker compose build backend`
4. 수동 테스트: 워크트리 생성 → 원격 push → 워크트리 삭제 → GitHub에서 브랜치 삭제 확인

## 비고

- 원격 브랜치 삭제는 best-effort 방식으로, 실패해도 전체 워크트리 삭제 작업은 성공으로 처리됩니다
- `GITHUB_TOKEN`이 설정되지 않은 환경에서는 원격 삭제가 실패하지만 로컬 삭제는 정상 동작합니다
