# 작업 이력: 프론트엔드 테스트 인프라 구축 + 백엔드/UI 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드에 vitest 테스트 인프라를 처음부터 구축하고 128개 테스트를 작성했습니다. 또한 백엔드 seq 카운터 복원, 이벤트 정리, ccusage 파싱 수정, 프론트엔드 UI 개선(UsageFooter 레이아웃, Sidebar 간소화)을 포함합니다.

## 변경 파일 목록

### Backend

- `backend/app/api/dependencies.py` - seq 카운터 복원 + 오래된 이벤트 정리 호출
- `backend/app/core/database.py` - get_max_seq_per_session, cleanup_old_events 메서드 추가
- `backend/app/schemas/usage.py` - burn_rate 타입 int -> float 수정
- `backend/app/services/usage_service.py` - ccusage blocks 파싱 키 수정 (data -> blocks)
- `backend/app/services/websocket_manager.py` - restore_seq_counters 메서드 추가
- `backend/tests/conftest.py` - 테스트 공용 fixture 전면 작성
- `backend/tests/test_*.py` (8개) - 백엔드 단위 테스트

### Frontend

- `frontend/vitest.config.ts` - Vitest 설정 (신규)
- `frontend/tsconfig.app.json` - vitest/globals types 추가
- `frontend/package.json` - vitest, testing-library 의존성 + test scripts
- `frontend/src/test/setup.ts` - 테스트 셋업 (신규)
- `frontend/src/test/mockWebSocket.ts` - MockWebSocket 클래스 (신규)
- `frontend/src/features/chat/hooks/useClaudeSocket.utils.ts` - 순수 함수 추출 (신규)
- `frontend/src/features/chat/utils/chatComputations.ts` - ChatPanel 계산 로직 추출 (신규)
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - utils 파일에서 import
- `frontend/src/features/chat/components/ChatPanel.tsx` - chatComputations에서 import
- `frontend/src/features/chat/components/MessageBubble.tsx` - default case [type] 디버그 표시
- `frontend/src/features/session/components/Sidebar.tsx` - Footer 간소화
- `frontend/src/features/usage/components/UsageFooter.tsx` - 레이아웃 개선 (좌우 분리, 브랜드명)
- `frontend/src/types/usage.ts` - account_id 필드 추가
- 테스트 파일 6개 (128 tests)

## 상세 변경 내용

### 1. 프론트엔드 테스트 인프라 (핵심)

- vitest + @testing-library/react + jsdom 환경 설정
- MockWebSocket 클래스로 WebSocket 시뮬레이션
- useClaudeSocket에서 순수 함수(getWsUrl, getBackoffDelay, generateMessageId) 추출
- ChatPanel에서 계산 로직(computeEstimateSize, computeMessageGaps, computeSearchMatches) 추출
- 6개 테스트 파일, 128개 테스트 전부 통과

### 2. 백엔드 안정성 개선

- 서버 재시작 시 DB에서 seq 카운터 복원 (이벤트 시퀀스 연속성 보장)
- 24시간 이전 이벤트 자동 정리
- ccusage blocks 응답의 키 이름 수정

### 3. 프론트엔드 UI 개선

- UsageFooter: 좌측에 브랜드명 + 활성 블록 정보, 우측에 계정/플랜/비용
- Sidebar Footer: 불필요한 텍스트 제거, ThemeToggle만 표시
- MessageBubble: 알 수 없는 타입에 [type] 디버그 표시

## 테스트 방법

```bash
cd frontend && pnpm test:run     # 128개 테스트 실행
cd frontend && npx tsc -p tsconfig.app.json --noEmit  # 타입 검사
cd frontend && pnpm build        # 빌드 검증
cd backend && uv run pytest      # 백엔드 테스트
```
