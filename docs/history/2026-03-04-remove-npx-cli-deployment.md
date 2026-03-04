# 작업 이력: npx CLI 배포 코드 제거

- **날짜**: 2026-03-04
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

배포 방식을 npm 패키지(`npx @faysia320/rocket-session`) → Git checkout 기반으로 전환하기 위해, npx 배포 전용 코드/설정을 모두 제거하고 README 설치 가이드를 Git clone 방식으로 교체했습니다.

## 변경 파일 목록

### 삭제 (19 파일)

- `bin/cli.mjs` - npx 실행 진입점 (shebang)
- `cli/index.mjs` - CLI 명령어 라우터
- `cli/commands/init.mjs` - 설정 초기화 (대화형/비대화형)
- `cli/commands/start.mjs` - Docker 빌드 + 서비스 시작
- `cli/commands/stop.mjs` - 서비스 중지
- `cli/commands/status.mjs` - 상태 확인
- `cli/commands/logs.mjs` - 로그 출력
- `cli/commands/config.mjs` - 설정 관리
- `cli/lib/docker.mjs` - Docker Compose 래퍼
- `cli/lib/env.mjs` - .env 파일 생성/관리
- `cli/lib/logger.mjs` - ANSI 콘솔 출력
- `cli/lib/paths.mjs` - 경로 해석 (getPackageRoot 등)
- `cli/lib/preflight.mjs` - Docker 사전 검사
- `cli/templates/docker-compose.yml` - CLI용 최소 Docker Compose 템플릿
- `package.json` - 루트 npm 패키지 정의 (@faysia320/rocket-session)
- `.npmignore` - npm publish 제외 파일 목록
- `frontend/package-lock.json` - legacy npm lock 파일 (pnpm 전용 프로젝트)
- `docs/history/2026-02-19-npm-cli-package.md` - CLI 패키지 구현 이력
- `docs/history/2026-03-03-npm-publish-preparation.md` - npm publish 준비 이력

### 수정 (2 파일)

- `README.md` - 설치 가이드를 npx → Git clone + docker compose 방식으로 교체, 프로젝트 구조에서 cli/ 항목 제거
- `claude.md` - 디렉토리 구조 테이블에서 cli/ 행 제거

## 상세 변경 내용

### 1. npx CLI 시스템 전체 삭제

- `bin/` 디렉토리: npx 실행 시 호출되는 shebang 진입점
- `cli/` 디렉토리: 6개 명령어(init, start, stop, status, logs, config) + 5개 유틸리티 라이브러리(docker, env, logger, paths, preflight) + Docker Compose 템플릿
- 루트 `package.json`: npm 패키지 메타데이터 (bin, files, scripts, publishConfig 등)
- `.npmignore`: npm publish 시 제외 파일 정의

### 2. README.md 설치 가이드 교체

- npx 명령어 기반 설치 → `git clone` + `cp .env.docker.example .env.docker` + `docker compose up -d` 방식으로 교체
- AI 자동화 설치 섹션 (--json 플래그) 제거
- CLI 명령어 테이블 제거
- 서비스 관리 명령어를 docker compose 직접 명령으로 교체
- 프로젝트 구조 트리에서 cli/ 항목 제거

### 3. claude.md 정리

- 디렉토리 구조 테이블에서 `| cli/ | Node.js CLI | commands → lib |` 행 제거

## 영향 범위

- `frontend/package.json`, `backend/pyproject.toml`은 독립적이므로 빌드에 영향 없음
- 루트 `docker-compose.yml` (개발용)은 cli/templates/ 와 무관하므로 영향 없음
- 기존 Docker 기반 배포 워크플로우에 변경 없음

## 테스트 방법

1. `pnpm build` (frontend) — 빌드 성공 확인
2. 삭제된 파일 존재하지 않음 확인
3. README.md에 npx 참조 없음 확인
