# 작업 이력: TurnState dict-style 접근을 dataclass 속성 접근으로 통일

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`TurnState`는 `claude_runner.py`에서 dataclass로 정의되어 있지만, `jsonl_watcher.py`와 `event_handler.py`에서는 dict 스타일(`turn_state["key"]`, `turn_state.get("key")`)로 접근하고 있어 런타임 에러가 발생하는 문제를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/jsonl_watcher.py` - dict 초기화 및 접근을 TurnState dataclass 속성 접근으로 변경 (13곳)
- `backend/app/services/event_handler.py` - dict 접근을 속성 접근으로 변경, TYPE_CHECKING import 추가 (4곳)

## 상세 변경 내용

### 1. jsonl_watcher.py (13곳 수정)

- `TurnState` import 추가
- `turn_state` 초기화를 `dict` 리터럴 → `TurnState()` dataclass 인스턴스로 변경
- 모든 dict 접근(`["key"]`, `.get("key")`) → 속성 접근(`.key`)으로 통일
- 메서드 시그니처 타입 힌트 `dict` → `TurnState` 업데이트 (3개 메서드)

### 2. event_handler.py (4곳 수정)

- `TYPE_CHECKING` 조건부 import로 순환 import 방지
- `extract_result_data` 시그니처 `dict` → `"TurnState"` 업데이트
- `turn_state.get("text")` / `turn_state["text"]` → `turn_state.text`
- `turn_state.get("model")` → `turn_state.model`

## 관련 커밋

- (이 문서와 함께 커밋됨)

## 테스트 방법

1. `cd backend && uv run python -c "from app.main import app; print('OK')"` → import 검증 통과
2. Docker 컨테이너 재빌드 후 세션 실행하여 스트리밍 동작 확인

## 비고

- `claude_runner.py`는 이미 올바른 속성 접근 방식을 사용 중이므로 변경 불필요
- `event_handler.py`에서 `TurnState`를 직접 import하면 순환 import 발생 → `TYPE_CHECKING` 가드 사용
