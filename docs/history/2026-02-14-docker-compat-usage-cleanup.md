# 작업 이력: Docker 환경 호환성 수정 + 계정 정보 표시 제거

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 환경에서 Git 기능이 동작하지 않는 문제를 수정하고, Claude CLI 세션 resume을 위해 볼륨 마운트 권한을 변경했습니다.
또한 자동으로 얻을 수 없는 계정 ID/플랜 표시를 전체 스택에서 제거했습니다.

## 변경 파일 목록

### Docker

- `backend/Dockerfile` - `git` 패키지 설치 추가
- `docker-compose.yml` - `~/.claude` 볼륨 마운트에서 `:ro` 제거
- `.env.docker.example` - 불필요한 `CLAUDE_PLAN`, `CLAUDE_ACCOUNT_ID` 제거

### Backend

- `backend/app/core/config.py` - `claude_plan`, `claude_account_id` 설정 제거
- `backend/app/schemas/usage.py` - `UsageInfo`에서 `plan`, `account_id` 필드 제거
- `backend/app/services/usage_service.py` - 응답 생성 시 plan/account_id 할당 제거
- `backend/.env.example` - `CLAUDE_ACCOUNT_ID` 항목 제거

### Frontend

- `frontend/src/types/usage.ts` - `UsageInfo` 인터페이스에서 `plan`, `account_id` 제거
- `frontend/src/features/usage/components/UsageFooter.tsx` - Crown 아이콘, 플랜 뱃지, 계정 ID UI 제거

## 상세 변경 내용

### 1. Docker 환경 Git 미설치 수정

- `python:3.11-slim` 이미지에 `git`이 포함되어 있지 않아 모든 Git 기능(정보 조회, 워크트리, 브랜치 등)이 실패
- `apt-get install`에 `git` 패키지 추가

### 2. Claude CLI 세션 resume을 위한 볼륨 권한 변경

- `~/.claude` 디렉토리가 read-only(`:ro`)로 마운트되어 CLI 세션 데이터 기록 불가
- `--resume` 기능과 세션 이어하기를 위해 읽기-쓰기로 변경

### 3. 계정 ID/플랜 표시 제거

- `CLAUDE_PLAN`과 `CLAUDE_ACCOUNT_ID`는 Claude Code hooks, CLI, 로컬 설정 파일 어디에서도 자동으로 얻을 수 없음
- 순수 표시용 메타데이터로, ccusage 사용량 조회와 무관
- 환경변수 설정 부담을 줄이기 위해 전체 스택에서 제거
- 푸터에는 Rocket Session 브랜드 + 블록 타이머/번레이트 + 5h/wk 사용량만 표시

## 테스트 방법

```bash
# Backend import 검증
cd backend && uv run python -c "from app.main import app; print('OK')"

# Frontend 타입 검사
cd frontend && npx tsc -p tsconfig.app.json --noEmit

# Frontend 빌드
cd frontend && pnpm build

# Docker 빌드 확인
docker compose build
```

## 비고

- 계정 정보가 필요해지면 Claude API에서 직접 조회하는 방식으로 재구현 가능
- Docker 환경에서 `git --version`으로 설치 확인 가능
