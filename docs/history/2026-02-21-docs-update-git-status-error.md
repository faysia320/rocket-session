# 작업 이력: 문서 최신화 + Git status 에러 처리

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프로젝트 문서(README.md, CLAUDE.md)를 PostgreSQL 마이그레이션 이후 실제 상태에 맞게 전면 최신화하고, Git Monitor의 git status 명령에 에러/타임아웃 처리를 추가했습니다.

## 변경 파일 목록

### 문서

- `README.md` — 아키텍처, 기술 스택, 주요 기능, 프로젝트 구조, API, DB 스키마 최신화
- `claude.md` (CLAUDE.md) — 전 섹션 최신화 (기술 스택, 구조, 아키텍처, 환경 설정, DB 스키마, 체크리스트)

### Backend

- `backend/app/schemas/filesystem.py` — GitStatusResponse에 error 필드 추가
- `backend/app/services/filesystem_service.py` — git status 에러/타임아웃 처리, update-index 사전 갱신, 대형 결과 경고 로깅

### Frontend

- `frontend/src/types/filesystem.ts` — GitStatusResponse에 error 필드 추가
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` — 에러 상태 UI 표시 (Badge + Tooltip)

## 상세 변경 내용

### 1. 문서 최신화 (README.md, CLAUDE.md)

- SQLite → PostgreSQL + SQLAlchemy ORM + Alembic 반영
- 새 기능 10개 추가: MCP 서버, 세션 템플릿, 태그, 분석 대시보드, 명령 팔레트, 알림, Git 모니터, 전문 검색, 글로벌 설정, JSONL 감시
- Repository 패턴, 신규 모델/서비스/엔드포인트 반영
- 환경 변수 업데이트 (DATABASE_URL, UPLOAD_DIR, CORS_ORIGINS)
- DB 스키마: 4개 테이블 → 9개 테이블 (global_settings, mcp_servers, tags, session_tags, session_templates 추가)
- 명령어 참조에 Alembic 명령 추가
- 체크리스트에 ORM 모델/Repository 단계 추가

### 2. Git status 에러 처리

- `update-index --refresh -q` 사전 실행으로 WSL2/cross-platform stale 타임스탬프 방지
- git status 실패 시 에러 메시지를 GitStatusResponse.error 필드로 반환
- 타임아웃 30초 설정
- 100개 초과 파일 또는 5초 초과 시 경고 로깅
- 프론트엔드에서 에러 시 빨간 "오류" 배지 + 툴팁 표시

## 관련 커밋

- `Docs: README.md, CLAUDE.md 프로젝트 현행화`
- `Fix: Git status 에러/타임아웃 처리 추가`

## 비고

- backend/README.md, frontend/README.md는 프로젝트에 별도로 존재하지 않으며, 루트 문서가 전체를 커버
