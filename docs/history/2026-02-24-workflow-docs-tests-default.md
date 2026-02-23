# 작업 이력: 워크플로우 시스템 문서/테스트 업데이트 및 기본값 변경

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 시스템(mode → workflow) 마이그레이션의 후속 작업으로,
문서(README/CLAUDE.md)를 워크플로우 체계에 맞게 업데이트하고,
테스트 코드를 mode에서 workflow 필드로 마이그레이션하며,
새 세션 생성 시 워크플로우를 기본 활성화하도록 변경했습니다.

## 변경 파일 목록

### 문서

- `README.md` - Plan Mode → Workflow 시스템 설명, 프로젝트 구조, API 경로, DB 스키마 업데이트
- `claude.md` - CLAUDE.md 개발 가이드 동기화 (구조, 기능 설명)

### Backend 테스트

- `backend/tests/test_api_endpoints.py` - mode → workflow_enabled 필드 테스트 마이그레이션
- `backend/tests/test_database.py` - Session ORM mode → workflow_enabled 테스트 마이그레이션
- `backend/tests/test_workflow_gate.py` - 워크플로우 승인 게이트 테스트 추가 (신규)

### Frontend

- `frontend/src/features/session/components/SessionSetupPanel.tsx` - workflowEnabled 기본값 true로 변경

## 상세 변경 내용

### 1. 문서 업데이트 (README.md, claude.md)

- Plan Mode 관련 설명을 Workflow 시스템으로 교체
- PlanResultCard → WorkflowPhaseCard, mode_change → workflow 이벤트 계열
- 프로젝트 구조에 workflow 관련 파일 추가 (workflow.py, session_artifact.py, artifact_repo.py 등)
- Workflow API 엔드포인트 섹션 추가
- DB 스키마에 session_artifacts, artifact_annotations 테이블 추가

### 2. 테스트 마이그레이션

- TestSessionModes → TestSessionWorkflow 클래스 이름 변경
- mode="normal" / mode="plan" 검증을 workflow_enabled 검증으로 교체
- 워크플로우 활성화 세션 생성 테스트 추가
- Session ORM 생성 시 mode → workflow_enabled 필드 사용
- artifact 테이블 정리 추가 (테스트 격리)

### 3. 워크플로우 기본 활성화

- SessionSetupPanel의 workflowEnabled 초기값을 false → true로 변경
- 새 세션 생성 시 워크플로우가 기본 활성화됨

## 테스트 방법

1. 백엔드 테스트: `cd backend && uv run pytest`
2. 프론트엔드 빌드: `cd frontend && pnpm build`
3. 새 세션 생성 시 워크플로우 토글이 기본 ON인지 확인
