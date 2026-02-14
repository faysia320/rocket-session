# 작업 이력: JsonlWatcher 코드 리뷰 수정

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

JsonlWatcher 서비스의 코드 리뷰 결과 발견된 심각 2건 + 중간 5건의 이슈를 수정했습니다.
(심각 1건은 이미 구현되어 있어 수정 불필요)

## 변경 파일 목록

### Backend

- `backend/app/services/jsonl_watcher.py` - 7개 이슈 수정
- `backend/app/api/dependencies.py` - shutdown 예외 처리 추가

## 상세 변경 내용

### 심각 (Severity: High)

#### 1. result 이벤트에 `mode` 필드 누락

- ClaudeRunner는 result 이벤트에 `"mode"` 필드를 포함하지만, JsonlWatcher는 누락
- DB에서 세션의 현재 mode를 조회하여 result_event에 포함하도록 수정

#### 2. 파일 truncate 시 offset 미처리

- `current_size < file_size`일 때 `file_size = current_size`만 설정
- offset이 리셋되지 않아 새 데이터를 놓칠 수 있었음
- `file_size = 0`으로 리셋하여 처음부터 다시 읽도록 수정

#### 3. turn_state 리셋 누락 (수정 불필요)

- 이미 `_handle_result_event()` 끝에서 리셋 코드가 구현되어 있음

### 중간 (Severity: Medium)

#### 4. `path.stat()` FileNotFoundError 미처리

- `path.exists()` 체크 후 `path.stat()` 사이 race condition 가능
- try/except FileNotFoundError로 감싸서 안전하게 처리

#### 5. JSON 파싱 실패 시 로깅 없음

- `json.JSONDecodeError`를 잡지만 로깅하지 않아 디버깅 어려움
- `logger.warning()`으로 파싱 실패 정보 기록

#### 6. 상태 전환 검증 부족

- 감시 시작 시 무조건 RUNNING, 종료 시 무조건 IDLE로 전환
- ERROR 상태를 덮어쓸 수 있었음
- IDLE→RUNNING, RUNNING→IDLE 전환만 허용하도록 조건 추가

#### 7. `_read_new_lines()` UTF-8 에러 처리

- 멀티바이트 문자 중간에서 seek할 경우 `UnicodeDecodeError` 가능
- `errors="replace"` 파라미터 추가

#### 8. shutdown 예외 처리

- `shutdown_dependencies()`에서 `stop_all()` 실패 시 앱 종료 지연 가능
- try/except로 감싸서 안전하게 처리

## 검증

- `uv run python -c "from app.main import app; print('OK')"` - 통과
- `npx tsc -p tsconfig.app.json --noEmit` - 통과
- `pnpm build` - 통과
