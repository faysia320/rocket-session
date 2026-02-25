# 작업 이력: Import Local 세션 워크스페이스 매핑 개선

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 아키텍처 변경으로 호스트 프로젝트 폴더를 볼륨 마운트하지 않고 워크스페이스 시스템(/workspaces/)을 사용하게 되면서, Import Local 시 JSONL 메타데이터의 호스트 경로(cwd)가 컨테이너에 존재하지 않는 문제를 해결했습니다. 스캔 시 워크스페이스 자동 매칭, import 시 워크스페이스 local_path를 work_dir로 사용하도록 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/local_session.py` - WorkspaceMatch 모델 추가, LocalSessionMeta/ImportLocalSessionRequest 필드 확장
- `backend/app/api/v1/endpoints/local_sessions.py` - 스캔 시 워크스페이스 자동 매칭, import 시 워크스페이스 검증 및 경로 오버라이드
- `backend/app/services/local_session_scanner.py` - import_session에 workspace_id, work_dir_override 파라미터 추가

### Frontend

- `frontend/src/types/local-session.ts` - WorkspaceMatch 인터페이스 추가, 타입 확장
- `frontend/src/types/index.ts` - WorkspaceMatch export 추가
- `frontend/src/features/session/components/ImportLocalDialog.tsx` - 워크스페이스 매칭 Badge/Select UI 추가

## 상세 변경 내용

### 1. Backend 스키마 확장

- `WorkspaceMatch` Pydantic 모델 추가 (workspace_id, workspace_name, local_path)
- `LocalSessionMeta`에 `matched_workspace: WorkspaceMatch | None` 필드 추가
- `ImportLocalSessionRequest`에 `workspace_id: str | None` 필드 추가

### 2. 스캔 엔드포인트 워크스페이스 자동 매칭

- `_extract_repo_name()`: cwd 경로의 마지막 세그먼트(레포명) 추출 (Windows/Unix 경로 모두 지원)
- `_match_workspace()`: 레포명과 워크스페이스 name을 case-insensitive 비교
- scan 응답에 매칭된 워크스페이스 정보 포함 (cwd별 캐시로 중복 조회 방지)

### 3. Import 엔드포인트 워크스페이스 경로 적용

- `workspace_id` 지정 시: 워크스페이스 존재/ready 상태 검증 → `local_path`를 `work_dir`로 사용
- `workspace_id` 미지정 시: 기존대로 `meta.cwd` 사용

### 4. Frontend UI 개선

- Dialog open 시 세션 스캔 + 워크스페이스 목록을 병렬 fetch
- 그룹 헤더에 `WorkspaceBadge` 컴포넌트 추가:
  - 자동 매칭 성공: 녹색 Badge (워크스페이스명 + local_path 툴팁)
  - 매칭 실패: Select 드롭다운 (수동 워크스페이스 선택)
- Import 시 workspace_id 우선순위: 수동 선택 > 자동 매칭 > 미지정

## 테스트 방법

1. 워크스페이스가 ready 상태인 환경에서 Import Local 다이얼로그 열기
2. 자동 매칭된 그룹에 녹색 Badge 표시 확인
3. 매칭 안 된 그룹에 Select 드롭다운 표시 확인
4. Import 후 세션의 work_dir가 워크스페이스 local_path로 설정되었는지 확인
