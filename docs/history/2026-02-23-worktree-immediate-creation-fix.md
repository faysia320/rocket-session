# 워크트리 전환 시 즉시 생성 버그 수정

## 날짜: 2026-02-23

## 배경

`claude -w` 플래그 마이그레이션 후, "워크트리로 전환" 버튼을 눌러도 실제 워크트리가 생성되지 않는 버그 발견.
기존 구현은 DB에 `worktree_name`만 저장하고, 다음 Claude CLI 실행 시 `-w` 플래그로 워크트리가 지연 생성되는 방식이었으나,
사용자 기대는 버튼 클릭 시점에 즉시 워크트리가 생성되는 것.

## 변경 내용

### Backend (`sessions.py`)

- `create_session` 엔드포인트: `worktree_name` 설정 시 `fs.create_claude_worktree()` 즉시 호출
- `convert_session_to_worktree` 엔드포인트: DB 업데이트 전에 `fs.create_claude_worktree()` 실행
- `FilesystemService` 의존성 주입 추가

### Frontend (`ChatPanel.tsx`)

- `handleConvertToWorktree`에 `reconnect()` 호출 복원 (WebSocket 상태 갱신)
- 토스트 메시지를 `워크트리로 전환되었습니다. (worktree-${name})`으로 변경

## 기술 세부사항

- `create_claude_worktree()`는 `git worktree add -b worktree-<name> <path>` 실행
- 워크트리 경로: `<repo>/.claude/worktrees/<name>/`
- 이미 존재하는 워크트리는 중복 생성하지 않고 경로만 반환
- 생성 실패 시 HTTP 400 에러 반환
