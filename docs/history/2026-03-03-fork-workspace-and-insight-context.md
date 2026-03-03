# 작업 이력: 세션 포크 workspace 버그 수정 + 인사이트 컨텍스트 주입

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. 세션 포크 시 원본 세션의 `workspace_id`가 복사되지 않던 버그를 수정했습니다.
2. 워크스페이스 인사이트를 세션 시스템 프롬프트에 자동 주입하는 기능을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/session_manager.py` - fork() 메서드에 workspace_id 복사 추가
- `backend/app/services/insight_service.py` - 인사이트 컨텍스트 빌드 + 캐시 + CRUD 캐시 무효화
- `backend/app/api/v1/endpoints/ws.py` - WebSocket 프롬프트 핸들러에 인사이트 컨텍스트 주입
- `backend/tests/conftest.py` - workspace_insights 테이블 truncate 추가
- `backend/tests/test_insight_context.py` - 인사이트 컨텍스트 빌드 단위 테스트 (신규)

## 상세 변경 내용

### 1. 세션 포크 workspace_id 버그 수정

- `SessionManager.fork()` 에서 Session 엔티티 생성 시 `workspace_id=source.get("workspace_id")` 1줄 추가
- 원본 세션의 워크스페이스 정보가 포크 세션에도 그대로 복사됨

### 2. 워크스페이스 인사이트 컨텍스트 자동 주입

- `InsightService.build_insight_context()` 메서드 추가: relevance_score 기반 필터링/정렬, 글자수 제한, 60초 TTL 캐시
- CRUD 메서드(create, update, delete, archive)에 캐시 무효화 로직 추가
- WebSocket `_handle_prompt` 에서 KB 컨텍스트 주입 직후 인사이트 컨텍스트를 `<workspace_insights>` 블록으로 주입

## 테스트 방법

1. 워크스페이스에 속한 세션 포크 → 포크 세션이 동일 워크스페이스에 표시되는지 확인
2. 워크스페이스에 인사이트 등록 후 세션 실행 → 시스템 프롬프트에 인사이트 블록 포함 확인

## 비고

- fork 전용 단위 테스트는 기존 코드베이스에 부재 (기존 이슈)
