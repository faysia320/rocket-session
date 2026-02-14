# 작업 이력: Docker 컨테이너 Git 인증 설정

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 컨테이너 내부에서 Claude Code CLI가 `git push` 등 원격 저장소 작업을 수행할 때 인증 실패가 발생하는 문제를 해결했습니다. GitHub PAT를 환경변수로 전달하고, 컨테이너 시작 시 Git credential helper를 자동 설정하는 entrypoint 스크립트를 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/entrypoint.sh` - (신규) 컨테이너 시작 시 Git 사용자 정보, credential store, safe directory 자동 설정
- `backend/Dockerfile` - entrypoint.sh 복사 및 ENTRYPOINT 지시어 추가

### Root

- `docker-compose.yml` - GIT_USER_NAME, GIT_USER_EMAIL, GITHUB_TOKEN 환경변수 전달 추가
- `.env.docker.example` - Git 설정 섹션 및 PAT 생성 안내 주석 추가

## 상세 변경 내용

### 1. entrypoint.sh 스크립트

- `GIT_USER_NAME` / `GIT_USER_EMAIL` 환경변수가 설정되면 `git config --global`로 사용자 정보 설정
- `GITHUB_TOKEN` 환경변수가 설정되면 `credential.helper store`로 HTTPS 인증 구성
- `.git-credentials` 파일 권한을 600으로 설정하여 보안 유지
- `safe.directory '*'`로 /projects 하위 모든 디렉토리 허용
- `exec "$@"`로 CMD에 정의된 uvicorn 서버 실행

### 2. Dockerfile 수정

- entrypoint.sh를 컨테이너 루트(/)에 복사 후 실행 권한 부여
- ENTRYPOINT를 entrypoint.sh로 설정하여 CMD 실행 전 Git 설정이 먼저 수행되도록 함

### 3. docker-compose.yml 수정

- backend 서비스의 environment에 Git 관련 3개 변수 추가
- .env.docker에서 값을 읽어 컨테이너로 전달

## 테스트 방법

1. `.env.docker`에 `GIT_USER_NAME`, `GIT_USER_EMAIL`, `GITHUB_TOKEN` 설정
2. `docker compose up --build -d`로 재빌드
3. 대시보드에서 세션 생성 후 `git push` 포함 작업 실행
4. 컨테이너 내부에서 직접 확인: `docker exec -it rocket-session-backend git config --global --list`

## 비고

- Windows 호스트의 Credential Manager는 Linux 컨테이너에서 접근 불가하므로, PAT 기반 HTTPS 인증을 사용
- GitHub Fine-grained PAT 권장 (Repository access + Contents Read/Write)
