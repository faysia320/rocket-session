# 작업 이력: 비워크플로우 세션 읽기전용 모드 + 워크플로우 전환 기능

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우가 활성화되지 않은 세션은 읽기전용(분석/검색만 가능)으로 제한하고, 사용자가 ChatHeader 버튼 또는 배너를 통해 워크플로우 모드로 전환할 수 있는 기능을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - 비워크플로우 세션에 읽기전용 도구 제한 분기 추가
- `backend/app/api/v1/endpoints/ws.py` - 비워크플로우 세션 allowed_tools 강제 오버라이드

### Frontend

- `frontend/src/features/chat/components/ChatHeader.tsx` - 워크플로우 전환 버튼 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 전환 핸들러 연결 + 읽기전용 안내 배너

## 상세 변경 내용

### 1. 비워크플로우 세션 읽기전용 도구 제한

`claude_runner.py`의 `_build_command()` 메서드에 `workflow_enabled=false`인 세션 분기를 추가하여 `--permission-mode plan` + 읽기전용 도구(Read, Glob, Grep, WebFetch, WebSearch, TodoRead)만 허용하도록 변경.

`ws.py`의 `_handle_prompt()` 함수에서 비워크플로우 세션의 `allowed_tools`를 요청/세션/글로벌 설정과 무관하게 읽기전용으로 강제 오버라이드.

### 2. ChatHeader 워크플로우 전환 버튼

`workflow_enabled=false`인 세션에서만 표시되는 "워크플로우 전환" 버튼을 ChatHeader 우측 버튼 영역에 추가. GitPullRequestArrow 아이콘 사용, primary 색상 스타일링.

### 3. ChatPanel 전환 핸들러 + 읽기전용 배너

`useStartWorkflow` 뮤테이션 훅을 사용하여 워크플로우 시작 API 호출. 성공 시 세션 쿼리 무효화 + 토스트 알림. ChatInput 위에 "읽기전용 모드 — 분석/검색만 가능합니다" 배너와 인라인 워크플로우 전환 버튼 표시.

## 테스트 방법

1. 새 세션을 `workflow_enabled=false`로 생성
2. 프롬프트 입력 시 읽기전용 도구만 사용되는지 확인
3. ChatHeader의 "워크플로우 전환" 버튼 클릭 → 워크플로우 모드로 전환 확인
4. 전환 후 Research 단계부터 정상 동작하는지 확인

## 비고

- `workflow_service.py`의 `start_workflow()`는 이미 `workflow_enabled=True`를 설정하고 있어 변경 불필요
- DB 스키마/마이그레이션 변경 없음 (기존 `workflow_enabled` 컬럼 활용)
