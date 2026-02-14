# 작업 이력: Docker 환경 개선 + FilePanel 병합 + Git 커밋 버튼

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 환경에서 로컬 개발과 다르게 동작하는 문제점을 분석하고 6가지 개선사항을 적용했습니다. FilePanel에서 동일 파일의 중복 변경 이력을 하나로 병합하는 기능을 추가하고, 스크롤바 미표시 버그를 수정했습니다. Git commit 버튼이 옵션 없이 `/git-commit` 스킬만 실행하도록 변경했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - CORS 추가 origin, 업로드 디렉토리 설정 추가
- `backend/app/main.py` - CORS에 all_cors_origins 적용
- `backend/app/api/dependencies.py` - 시작 시 업로드 디렉토리 생성 보장
- `backend/app/api/v1/endpoints/files.py` - 업로드 경로를 settings 기반으로 변경
- `backend/app/services/filesystem_service.py` - root_dir 설정 실패 시 경고 로깅

### Frontend

- `frontend/nginx.conf` - proxy_buffering off, 에러 페이지 폴백
- `frontend/src/features/files/components/FilePanel.tsx` - 파일 변경 병합 + 스크롤바 수정
- `frontend/src/features/chat/components/GitActionsBar.tsx` - commit 버튼 옵션 제거

### 설정

- `docker-compose.yml` - Named Volume, UPLOAD_DIR, CORS_EXTRA_ORIGINS 환경변수
- `.env.docker.example` - CORS_EXTRA_ORIGINS 설명 추가

## 상세 변경 내용

### 1. Nginx 스트리밍 개선

- API/WS 프록시에 `proxy_buffering off` 추가하여 Claude 스트리밍 응답의 버퍼링 방지
- 502/504 에러 시 SPA index.html로 폴백하는 에러 페이지 설정

### 2. CORS 환경변수화

- `CORS_EXTRA_ORIGINS` 환경변수로 LAN 접속 시 추가 origin 허용 가능
- `all_cors_origins` 프로퍼티로 기본 + 추가 origin 병합

### 3. 파일 업로드 영속 볼륨

- 기존: `tempfile.gettempdir()` (컨테이너 재시작 시 삭제)
- 변경: `UPLOAD_DIR` 환경변수 + Docker Named Volume(`rocket-uploads`)
- `init_dependencies()`에서 업로드 디렉토리 생성 보장

### 4. 파일시스템 보안 경계 강화

- `FilesystemService.__init__`에서 `root_dir` 경로가 유효하지 않을 때 WARNING 로그 출력
- 파일시스템 경계 없이 전체 접근이 허용되는 상태를 명시적으로 알림

### 5. FilePanel 동일 파일 병합

- `mergeFileChanges()` 함수로 같은 파일 경로의 변경을 하나로 병합
- 사용된 모든 도구 배지 나열 + 수정 횟수 `×N` 표시
- 최근 변경 파일이 상단에 오도록 역순 정렬
- 헤더에 `5 files / 12 edits` 형태로 고유 파일 수와 총 편집 수 구분 표시
- ScrollArea에 `h-0` 추가하여 스크롤바 미표시 버그 수정

### 6. Git commit 버튼 간소화

- `"/git-commit --no-history"` → `"/git-commit"`으로 변경
- 옵션 없이 스킬 명령만 실행

## 테스트 방법

- Backend 테스트: `uv run pytest` (166개 통과)
- Frontend 타입 검사: `npx tsc -p tsconfig.app.json --noEmit` (에러 없음)
- Ruff 린트: 변경된 Python 파일 모두 통과

## 비고

- 비root 사용자 실행은 Claude CLI의 `~/.claude` 접근, git config, 볼륨 마운트 구조상 현재 적용 불가
- Claude CLI 버전 고정은 사용자 요청에 따라 제외
