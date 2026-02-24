# 작업 이력: 코드 품질 개선 Phase 4.1, 6.1, 7, 8, 9, 10

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

이전 세션에서 구현한 Phase 0-6에 이어, 나머지 6개 Phase를 구현했습니다. SessionManager/FilesystemService God Class 분해, ServiceRegistry DI 패턴 도입, DateTime 마이그레이션, WorkflowService 테스트, FE/BE 기타 개선을 포함합니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/services/session_process_manager.py` - SessionManager에서 인메모리 프로세스 관리 추출
- `backend/app/services/git_service.py` - FilesystemService에서 Git 관리 추출 (621줄)
- `backend/app/services/github_service.py` - FilesystemService에서 GitHub CLI 추출 (433줄)
- `backend/app/services/skills_service.py` - FilesystemService에서 Skills 스캔 추출 (90줄)
- `backend/migrations/versions/20260224_0010_convert_timestamps_to_datetime.py` - Alembic 마이그레이션
- `backend/tests/test_workflow_service.py` - WorkflowService 통합 테스트 51개

### Backend (수정)

- `backend/app/api/dependencies.py` - ServiceRegistry 도입 + 3개 신규 서비스 등록
- `backend/app/services/session_manager.py` - SessionProcessManager 위임 + DateTime
- `backend/app/services/filesystem_service.py` - 1149줄 → 110줄 (디렉토리만)
- `backend/app/services/websocket_manager.py` - pending_broadcasts 추적 + DateTime
- `backend/app/models/*.py` (11개) - Text 타임스탬프 → DateTime(timezone=True)
- `backend/app/schemas/*.py` (7개) - str → datetime 타입
- `backend/app/services/*.py` (14개) - datetime 객체 직접 사용
- `backend/app/repositories/*.py` (3개) - DateTime 쿼리 적용
- `backend/app/api/v1/endpoints/filesystem.py` - 서비스 분리에 따른 DI 변경
- `backend/Dockerfile` - 멀티스테이지 빌드 + claude-code@2.1.51 고정

### Frontend

- `frontend/src/lib/api/client.ts` - ApiError 클래스 (HTTP status 노출)
- `frontend/src/features/chat/components/ChatPanel.tsx` - ArtifactViewer ErrorBoundary
- `frontend/src/features/files/components/FileViewer.tsx` - DiffViewer ErrorBoundary
- `frontend/src/features/files/components/FilePanel.tsx` - DiffViewer ErrorBoundary
- `frontend/src/features/git-monitor/components/*.tsx` (3개) - DiffViewer ErrorBoundary

### Docs

- `CLAUDE.md` - 아티팩트 스키마 문서 수정 (String→Integer)

## 상세 변경 내용

### Phase 4.1: SessionManager God Class 분해

- `SessionProcessManager` 추출: `_processes`, `_runner_tasks` dict + kill/set/get/clear 메서드
- SessionManager는 facade로서 ProcessManager에 위임 (공개 API 변경 없음)

### Phase 6.1: FilesystemService 분할

- `GitService` (621줄): Git 작업 (status, log, diff, worktree, cache, lock)
- `GitHubService` (433줄): GitHub CLI + PR 리뷰 (GitService DI)
- `SkillsService` (90줄): 슬래시 명령어 스캔 (stateless)
- `FilesystemService` (110줄): 디렉토리 탐색만 남김
- 엔드포인트/DI/테스트 전체 업데이트

### Phase 7: ServiceRegistry DI 개선

- `ServiceRegistry` 클래스: 모든 서비스 속성 + `_require()` + `initialize()` + `shutdown()`
- 기존 `get_*()` 함수는 하위 호환 래퍼로 유지

### Phase 8: DateTime 마이그레이션

- 11개 ORM 모델의 Text 타임스탬프 → `DateTime(timezone=True)`
- 14개 서비스: DB 저장 시 `datetime` 객체 직접 사용
- WS 페이로드: 기존 `.isoformat()` 유지 (이중 패턴)
- Alembic 마이그레이션: `postgresql_using` 캐스트

### Phase 9: 테스트 커버리지

- WorkflowService 51개 통합 테스트 (전체 통과)
- 아티팩트 CRUD, phase 전환, 주석, 에러 케이스, 전체 라이프사이클

### Phase 10: 기타 개선

- `ApiError` 클래스: HTTP 상태 코드 노출
- ErrorBoundary: DiffViewer 6곳 + ArtifactViewer 1곳 래핑
- Dockerfile 멀티스테이지 빌드 (builder → runtime, gcc/libpq-dev 제거)
- claude-code 버전 고정 (`@2.1.51`)
- fire-and-forget broadcast task 추적 (`_pending_broadcasts` set)
- CLAUDE.md 아티팩트 스키마 문서 수정

## 관련 커밋

- `4e80a69` - Refactor: SessionManager God Class 분해 + ServiceRegistry DI 개선
- `ff53c0f` - Refactor: FilesystemService 분할 — GitService, GitHubService, SkillsService 추출
- `22a36bd` - Refactor: Text 타임스탬프 → DateTime(timezone=True) 마이그레이션
- `019cc8d` - Test: WorkflowService 통합 테스트 51개 추가
- `7e185b7` - Refactor: FE/BE 기타 개선 — ApiError, ErrorBoundary, Dockerfile, CLAUDE.md

## 비고

- Phase 8 마이그레이션은 Docker 컨테이너 재시작 시 Alembic이 자동 적용
- 외부 API/JSONL 파싱 타임스탬프는 변경하지 않음 (외부 데이터)
