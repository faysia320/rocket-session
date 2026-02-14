# 작업 이력: CLI 기능 이식 9개 기능

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Claude Code CLI의 핵심 누락 기능 9개를 웹 대시보드에 이식했습니다. 백엔드 DB/스키마/서비스/API 수정과 프론트엔드 타입/컴포넌트/훅 생성을 포함합니다.

## 구현된 기능 목록

| # | 기능 | 설명 |
|---|------|------|
| 1 | 컨텍스트 윈도우 시각화 | 200K 토큰 대비 사용률 프로그레스 바 |
| 2 | 모델 선택 드롭다운 | Opus/Sonnet/Haiku 모델 선택 |
| 3 | `--max-turns` 지원 | 에이전트 턴 최대 횟수 제한 |
| 4 | `--max-budget-usd` 지원 | 세션당 최대 비용 한도 |
| 5 | 데스크톱 알림 | 작업 완료 시 브라우저 알림 |
| 6 | 메시지 재전송 | 사용자 메시지 Re-send 버튼 |
| 7 | `--append-system-prompt` | 시스템 프롬프트 모드 (대체/추가) |
| 8 | `--disallowedTools` | 도구 사용 금지 목록 |
| 9 | 세션 검색/필터 | 이름 검색 + 상태 필터 |

## 변경 파일 목록

### Backend (9개 파일)

- `backend/app/core/database.py` - 마이그레이션 10줄 + create/update/global 메서드에 5개 필드 추가
- `backend/app/schemas/session.py` - CreateSessionRequest, UpdateSessionRequest, SessionInfo에 5개 필드
- `backend/app/schemas/settings.py` - GlobalSettingsResponse, UpdateGlobalSettingsRequest에 5개 필드
- `backend/app/services/session_manager.py` - create, update_settings, to_info에 5개 필드
- `backend/app/services/settings_service.py` - update에 5개 파라미터
- `backend/app/services/claude_runner.py` - _build_command에 model/max_turns/max_budget_usd/system_prompt_mode/disallowed_tools CLI 플래그
- `backend/app/api/v1/endpoints/sessions.py` - create/update에 5개 필드 전달
- `backend/app/api/v1/endpoints/settings.py` - update에 5개 필드 전달
- `backend/app/api/v1/endpoints/ws.py` - merged_session 병합에 5개 필드 추가

### Frontend (15개 파일, 신규 4개)

- `frontend/src/types/session.ts` - SessionInfo, Create/UpdateSessionRequest에 5개 필드
- `frontend/src/types/settings.ts` - GlobalSettings에 5개 필드
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - tokenUsage state + 누적 로직
- `frontend/src/features/chat/components/ContextWindowBar.tsx` **(신규)** - 컨텍스트 윈도우 프로그레스 바
- `frontend/src/features/chat/components/ModelSelector.tsx` **(신규)** - 모델 선택 드롭다운
- `frontend/src/components/ui/select.tsx` **(신규)** - shadcn/ui Select 컴포넌트
- `frontend/src/features/chat/hooks/useDesktopNotification.ts` **(신규)** - 데스크톱 알림 훅
- `frontend/src/features/chat/components/ChatHeader.tsx` - ContextWindowBar + ModelSelector 통합
- `frontend/src/features/chat/components/ChatPanel.tsx` - tokenUsage/model/알림/재전송 통합
- `frontend/src/features/chat/components/MessageBubble.tsx` - Re-send 버튼
- `frontend/src/features/session/components/Sidebar.tsx` - 검색/필터 + 알림 토글
- `frontend/src/features/session/components/SessionSettings.tsx` - 5개 설정 섹션 추가
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - 5개 설정 섹션 추가
- `frontend/package.json` - @radix-ui/react-select 의존성
- `frontend/pnpm-lock.yaml` - lockfile 업데이트

## 상세 변경 내용

### 1. 백엔드 DB + 스키마 + 서비스 (기능 2,3,4,7,8 통합)

5개 기능의 백엔드 변경을 한번에 처리. sessions/global_settings 테이블에 model, max_turns, max_budget_usd, system_prompt_mode, disallowed_tools 컬럼 추가. DB → Schema → Service → Runner → API 전 레이어 관통.

ClaudeRunner의 `_build_command`에서:
- model: 세션 > env 우선순위
- system_prompt_mode: 'append'이면 `--append-system-prompt` 플래그 사용
- max_turns, max_budget_usd: 양수일 때만 CLI 플래그 추가
- disallowed_tools: `--disallowedTools` 플래그로 전달

### 2. 컨텍스트 윈도우 시각화 (기능 1)

useClaudeSocket에 tokenUsage state 추가. result 이벤트 수신 시 토큰 누적, session_state 복원 시 히스토리에서 합산. ContextWindowBar 컴포넌트로 200K 토큰 대비 input_tokens 사용률 시각화 (0-74%: info, 75-89%: warning, 90%+: destructive).

### 3. 모델 선택 + 설정 UI (기능 2,3,4,7,8)

ModelSelector 컴포넌트로 ChatHeader에서 실시간 모델 변경. SessionSettings/GlobalSettingsDialog에 MODEL, MAX TURNS, MAX BUDGET, SYSTEM PROMPT MODE, DISALLOWED TOOLS 5개 섹션 추가.

### 4. 데스크톱 알림 + 메시지 재전송 + 세션 검색/필터 (기능 5,6,9)

useDesktopNotification 훅으로 localStorage 기반 알림 상태 관리. ChatPanel에서 running → idle 전환 시 알림 발송. MessageBubble에 Re-send 버튼. Sidebar에 이름/경로 검색 + 상태 필터(All/Running/Idle/Error) + 알림 토글 버튼.

## 테스트 방법

```bash
# 백엔드 임포트 검증
cd backend && uv run python -c "from app.main import app; print('OK')"

# 프론트엔드 타입 검사
cd frontend && npx tsc -p tsconfig.app.json --noEmit

# 프론트엔드 빌드
cd frontend && pnpm build
```

## 비고

- 코드 리뷰에서 발견된 useDesktopNotification의 toggle 함수 의존성 이슈 수정 완료
- ModelSelector의 에러 핸들링은 기존 패턴(sessionsApi.update().catch(() => {}))과 일관성 유지
