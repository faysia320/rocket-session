# 작업 이력: npm/npx CLI 배포 패키지

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Rocket Session을 `npx github:faysia320/rocket-session` 한 줄로 Docker 빌드/실행할 수 있는 CLI 패키지를 구현했습니다. 외부 의존성 없이(zero dependencies) Node.js 내장 모듈만 사용하며, LLM 자동화를 위한 비대화형 모드와 JSON 출력을 지원합니다.

## 변경 파일 목록

### CLI (신규)

- `package.json` - 루트 npm 패키지 정의 (bin, files, engines)
- `bin/cli.mjs` - CLI 엔트리포인트 (#!/usr/bin/env node)
- `cli/index.mjs` - 명령어 라우터 (argv 파싱 → 핸들러 위임)
- `cli/lib/logger.mjs` - 콘솔 출력 (색상, 진행 단계, JSON 모드)
- `cli/lib/paths.mjs` - 경로 해석 (패키지 루트, 데이터 디렉토리)
- `cli/lib/preflight.mjs` - Docker/Compose/포트 사전 검사
- `cli/lib/env.mjs` - .env 파일 생성/파싱/병합
- `cli/lib/docker.mjs` - Docker Compose 명령어 래퍼 + 헬스체크
- `cli/templates/docker-compose.yml` - Compose 템플릿 (__PACKAGE_ROOT__ 치환)
- `cli/commands/start.mjs` - Docker 빌드 + 서비스 시작
- `cli/commands/stop.mjs` - 서비스 중지
- `cli/commands/status.mjs` - 상태 확인
- `cli/commands/logs.mjs` - 로그 출력
- `cli/commands/init.mjs` - 대화형 설정 생성
- `cli/commands/config.mjs` - 설정 조회/변경

### 배포 설정 (신규)

- `.npmignore` - npm 배포 제외 파일 (개발 파일, 환경변수, __pycache__)
- `backend/.npmignore` - Python __pycache__ 제외

## 상세 변경 내용

### 1. CLI 명령어 체계

- `start` - Docker 빌드 + 서비스 시작 (핵심 명령어)
- `stop` - 서비스 중지
- `status` - 상태 확인 (--json 지원)
- `logs` - 서비스 로그 (-f, --tail, --service)
- `init` - 대화형 설정 파일 생성
- `config` - 설정 조회/변경 (list, set, path)

### 2. 비대화형 모드 (LLM 자동화)

- 필수 플래그가 모두 지정되면 프롬프트 없이 실행
- `--json` 플래그로 구조화된 JSON 출력
- Claude Code에서 한 줄로 실행 가능

### 3. Docker Compose 템플릿

- `__PACKAGE_ROOT__`를 npm 패키지 절대경로로 치환
- `--env-file`로 사용자 설정 주입
- 데이터는 `~/.rocket-session/data/`에 영속 저장

### 4. 사전 검사 (preflight)

- Docker/Compose V2/데몬 실행 확인
- Claude 인증 디렉토리/프로젝트 디렉토리 존재 확인
- 포트 충돌 감지

## 테스트 방법

```bash
# CLI 동작 확인
node bin/cli.mjs --version     # 0.1.0
node bin/cli.mjs --help        # 도움말
node bin/cli.mjs status --json # {"status":"not_initialized"}

# 패키지 크기 확인
npm pack --dry-run             # 766KB / 1.8MB / 237 파일

# GitHub 저장소에서 직접 실행
npx github:faysia320/rocket-session start --projects-dir ~/workspace
```

## 비고

- 패키지 크기: 766KB (tarball) / 1.8MB (unpacked) / 237 파일
- zero dependencies: Node.js 내장 모듈만 사용
- 배포 방식: GitHub 저장소에서 직접 설치 (`npx github:faysia320/rocket-session`)
