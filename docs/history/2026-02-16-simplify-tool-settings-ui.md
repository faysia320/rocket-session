# 작업 이력: 도구 설정 UI 간소화 및 MAX BUDGET/TURNS 제거

- **날짜**: 2026-02-16
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ALLOWED TOOLS 설정을 "모든 도구 기본 허용 + DISALLOWED TOOLS로 금지 관리" 방식으로 간소화하고, 실사용 빈도가 낮은 MAX TURNS / MAX BUDGET (USD) 옵션을 모든 UI에서 제거했습니다. 백엔드 스키마/로직은 하위 호환성을 위해 유지합니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - `claude_allowed_tools` 기본값을 전체 11개 도구로 변경 (안전망)

### Frontend

- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - ALLOWED TOOLS를 모든 도구 체크 + disabled 처리, MAX TURNS/BUDGET 섹션 제거
- `frontend/src/features/session/components/SessionSettings.tsx` - ALLOWED TOOLS / MAX TURNS / MAX BUDGET 섹션 완전 제거
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - ALLOWED TOOLS 섹션 완전 제거, 관련 state/import/타입 정리
- `frontend/src/lib/api/sessions.api.ts` - `create()` options 타입에서 `allowed_tools` 제거
- `frontend/src/features/session/hooks/useSessions.ts` - `useCreateSession` 훅 타입에서 `allowed_tools` 제거

## 상세 변경 내용

### 1. 글로벌 설정 - ALLOWED TOOLS 읽기 전용화

- 모든 `AVAILABLE_TOOLS`가 체크된 상태로 `disabled` 처리
- 설명 문구를 "모든 도구가 기본적으로 허용됩니다. 특정 도구를 금지하려면 DISALLOWED TOOLS에서 선택하세요."로 변경
- 저장 시 항상 `AVAILABLE_TOOLS.join(",")` 전송

### 2. 세션 설정 / 세션 생성 - ALLOWED TOOLS 제거

- 세션 설정 팝오버에서 ALLOWED TOOLS 체크박스 그리드 제거
- 세션 생성 패널에서 ALLOWED TOOLS 체크박스 그리드 제거
- DISALLOWED TOOLS는 유지 (세션별 도구 금지 관리용)

### 3. MAX TURNS / MAX BUDGET 제거

- 글로벌 설정, 세션 설정 양쪽에서 UI 섹션 완전 제거
- 관련 state 변수(`maxTurns`, `maxBudget`, `selectedTools`) 정리

### 4. 백엔드 기본값 변경

- `config.py`의 `claude_allowed_tools` 기본값을 `"Read,Write,Edit,Bash"` → 전체 11개 도구로 변경
- 글로벌 설정이 저장되기 전(최초 실행 시)에도 모든 도구가 허용되도록 안전망 역할

## 테스트 방법

1. 글로벌 설정 열기 → ALLOWED TOOLS가 모든 도구 체크 + 클릭 불가(disabled) 확인
2. 글로벌 설정 저장 → Network 탭에서 `allowed_tools` 값이 전체 도구 문자열인지 확인
3. 세션 설정 열기 → ALLOWED TOOLS / MAX TURNS / MAX BUDGET 섹션이 없는지 확인
4. 새 세션 생성 → ALLOWED TOOLS 섹션이 없는지 확인
5. DISALLOWED TOOLS는 정상 작동하는지 확인

## 비고

- 백엔드 스키마(`allowed_tools`, `max_turns`, `max_budget_usd` 필드)는 DB 호환성을 위해 유지
- `--allowedTools`, `--max-turns`, `--max-budget-usd` CLI 플래그 전달 로직도 유지 (향후 복구 가능)
- TypeScript 타입 검사 + Vite 빌드 통과 확인
