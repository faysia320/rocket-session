# 작업 이력: 디자인 토큰 전환 + useReducer 리팩토링 + 에러 응답 통일

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

자가 검진 잔여 작업 3가지를 구현했습니다:
1. 하드코딩 픽셀/크기 값을 Tailwind 디자인 토큰으로 일괄 전환
2. useClaudeSocket 훅을 useState에서 useReducer로 리팩토링
3. 백엔드 HTTPException 에러 응답을 키워드 인자 + 한국어로 통일

## 변경 파일 목록

### Frontend - 디자인 토큰 전환

- `frontend/tailwind.config.js` - 커스텀 fontSize 11개 등록 (2xs~5xl)
- 37개 컴포넌트 파일 - text-[10px]→text-2xs, text-[11px]→text-xs, text-[13px]→text-md, text-[12px]→text-sm 일괄 치환

### Frontend - useReducer 리팩토링

- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - 순수 리듀서 함수 (26개 액션 타입)
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - 리듀서 단위 테스트 (24개)
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 10개 useState → 1개 useReducer 전환

### Backend - 에러 응답 통일

- `backend/app/api/v1/endpoints/sessions.py` - 10건 HTTPException 키워드 인자 + 한국어
- `backend/app/api/v1/endpoints/files.py` - 9건 HTTPException 키워드 인자 + 한국어
- `backend/app/api/v1/endpoints/ws.py` - 3건 에러 메시지 한국어 통일

## 상세 변경 내용

### 1. Tailwind 커스텀 fontSize 등록 + 일괄 전환

tailwind.config.js에 디자인 토큰 기반 fontSize 스케일을 등록하고, 프론트엔드 전체에서 하드코딩 arbitrary value를 시맨틱 클래스로 전환했습니다:

- `text-[10px]` → `text-2xs` (0.625rem, ~50건)
- `text-[11px]` → `text-xs` (0.6875rem, ~35건)
- `text-[13px]` → `text-md` (0.8125rem, ~12건)
- `text-[12px]` → `text-sm` (0.75rem, 1건)

CSS 번들: 61.78KB → 61.73KB (-0.05KB, 중복 arbitrary value 제거 효과)

### 2. useClaudeSocket useReducer 전환

10개 독립 useState를 1개 useReducer로 통합하여 상태 관리를 개선했습니다:

- **새 파일**: `claudeSocketReducer.ts` - ClaudeSocketState 인터페이스, 26개 액션 타입, 순수 리듀서 함수
- **리팩토링**: `useClaudeSocket.ts` - 모든 setState 호출을 dispatch로 전환
- **반환 인터페이스 동일**: 소비자 코드(ChatPanel 등) 변경 없음
- **테스트**: 24개 순수함수 단위 테스트 작성 및 통과

### 3. 백엔드 에러 응답 통일

모든 HTTPException을 일관된 스타일로 통일했습니다:

- 위치 인자 (`HTTPException(404, "msg")`) → 키워드 인자 (`HTTPException(status_code=404, detail="msg")`)
- 영어 메시지 → 한국어 통일: `"Session not found"` → `"세션을 찾을 수 없습니다"`
- 프론트엔드 "Session not found" 참조도 한국어로 동기화

## 테스트 방법

```bash
# Frontend
cd frontend
npx tsc -p tsconfig.app.json --noEmit  # TypeScript 검사
pnpm build                              # 프로덕션 빌드
npx vitest run src/features/chat/hooks/claudeSocketReducer.test.ts  # 리듀서 테스트

# Backend
cd backend
uv run pytest tests/ -v                 # 백엔드 전체 테스트
```

## 검증 결과

- TypeScript 타입 검사: 통과
- 프론트엔드 빌드: 성공
- 리듀서 단위 테스트: 24/24 통과
- 백엔드 테스트: 166/166 통과
