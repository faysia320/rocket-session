# 작업 이력: AskUserQuestion 대기 질문 DB 영속 저장

- **날짜**: 2026-02-28
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

AskUserQuestion 대기 질문을 인메모리 dict에서 인메모리 캐시 + DB(sessions.pending_question JSONB) 이중 구조로 전환하여, 서버 재시작 후에도 세션 진입 시 질문 카드가 복원되도록 했습니다. jsonl_watcher에서 누락된 set_pending_question 호출도 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/migrations/versions/20260228_0027_add_pending_question.py` - sessions 테이블에 pending_question JSONB 컬럼 추가 마이그레이션
- `backend/app/models/session.py` - Session ORM 모델에 pending_question 필드 추가
- `backend/app/repositories/session_repo.py` - set_pending_question, get_pending_question 메서드 추가
- `backend/app/services/pending_questions.py` - async + 인메모리 캐시/DB 이중 구조로 리라이트
- `backend/app/services/claude_runner.py` - set_pending_question 호출에 await 추가
- `backend/app/services/jsonl_watcher.py` - 누락된 set_pending_question 호출 추가
- `backend/app/api/v1/endpoints/ws.py` - clear/get_pending_question 호출에 await 추가
- `backend/app/api/v1/endpoints/sessions.py` - clear_pending_question 호출에 await 추가
- `backend/app/api/dependencies.py` - DB 초기화 후 init_pending_questions 호출 추가
- `backend/app/main.py` - clear_all_pending_questions → clear_all_cache로 변경

## 상세 변경 내용

### 1. DB 영속 저장 레이어 추가

- sessions 테이블에 `pending_question` JSONB nullable 컬럼 추가
- SessionRepository에 set/get 메서드 추가
- 값 구조: `{"session_id": "...", "questions": [...], "tool_use_id": "...", "timestamp": "..."}`

### 2. pending_questions.py 리라이트

- 모든 함수를 async로 변환
- 인메모리 캐시 + DB 동시 저장 (이중 구조)
- get: 캐시 우선 → 캐시 miss 시 DB 폴백 + 캐시 워밍
- clear: 캐시 + DB 동시 클리어
- DB 실패 시 로깅만 하고 인메모리로 폴백 (graceful degradation)
- 서버 종료 시 인메모리만 정리 (DB 유지 → 재시작 복구)

### 3. jsonl_watcher 버그 수정

- AskUserQuestion 감지 시 broadcast_event만 하고 set_pending_question 호출이 없던 버그 수정
- import된 로컬 세션에서도 대기 질문이 영속 저장되도록 함

### 4. 호출부 await 추가

- claude_runner, ws, sessions 등 기존 동기 호출부에 await 추가
- dependencies.py에서 앱 시작 시 DB 인스턴스 주입

## 테스트 방법

1. `cd backend && uv run alembic upgrade head` 로 마이그레이션 적용
2. 세션에서 AskUserQuestion 트리거
3. 다른 세션으로 이동 → 원래 세션으로 복귀 → 질문 카드 표시 확인
4. Docker 컨테이너 재시작 → 세션 진입 시 질문 카드 복원 확인

## 비고

- 프론트엔드 변경 없음 (기존 pending_interactions.ask_user_question 복원 로직이 이미 정상 동작)
- 전체 테스트 343개 통과 확인
