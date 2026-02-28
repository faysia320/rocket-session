# 작업 이력: React Compiler 도입

- **날짜**: 2026-02-28
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

React Compiler(babel-plugin-react-compiler 1.0.0)를 infer 모드로 도입하여 빌드 타임 자동 메모이제이션을 활성화했습니다. 사전 조건으로 MemoBlockEditor의 렌더 중 ref 쓰기 React Rules 위반을 수정하고, 5개 파일럿 컴포넌트에 `"use memo"` 디렉티브를, WebSocket 기반 복잡 hook 2개에 `"use no memo"` opt-out 디렉티브를 적용했습니다.

## 변경 파일 목록

### Frontend - 설정

- `frontend/package.json` - `babel-plugin-react-compiler` 1.0.0 devDependency 추가
- `frontend/package-lock.json` - lock 파일 동기화
- `frontend/vite.config.ts` - `react()` 플러그인에 babel-plugin-react-compiler 설정 추가
- `frontend/eslint.config.js` - React Compiler 관련 6개 ESLint 규칙 warn 활성화

### Frontend - React Rules 수정

- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - 렌더 중 ref 쓰기를 useEffect로 이동

### Frontend - 파일럿 opt-in (`"use memo"`)

- `frontend/src/components/ui/CodeBlock.tsx` - `"use memo"` 디렉티브 추가
- `frontend/src/features/session/components/SessionStatsBar.tsx` - `"use memo"` 디렉티브 추가
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - `"use memo"` 디렉티브 추가
- `frontend/src/features/usage/components/UsageFooter.tsx` - `"use memo"` 디렉티브 추가
- `frontend/src/features/files/components/DiffViewer.tsx` - `"use memo"` 디렉티브 추가

### Frontend - 복잡 hook opt-out (`"use no memo"`)

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - `"use no memo"` 디렉티브 추가
- `frontend/src/features/team/hooks/useTeamSocket.ts` - `"use no memo"` 디렉티브 추가

## 상세 변경 내용

### 1. MemoBlockEditor 렌더 중 ref 쓰기 수정 (Phase 0)

- 렌더 함수 본문에서 7개 ref에 직접 할당하던 코드를 `useEffect`로 이동
- React 19 Strict Mode 및 Compiler의 purity 규칙 호환성 확보
- `useEffect` import 추가

### 2. React Compiler 설치 및 설정 (Phase 1)

- `babel-plugin-react-compiler@1.0.0` 정확 버전 설치
- Vite의 `@vitejs/plugin-react` babel plugins 배열에 컴파일러 플러그인 추가
- ESLint 6개 규칙(purity, immutability, incompatible-library, set-state-in-effect, preserve-manual-memoization, static-components)을 `warn`으로 활성화

### 3. 파일럿 컴포넌트 opt-in (Phase 2)

- 5개 컴포넌트 함수 본문 첫 줄에 `"use memo"` 디렉티브 추가
- 기존 `memo()` 래퍼는 유지 (Compiler가 중복 감지하여 skip)

### 4. infer 모드 전환 및 opt-out (Phase 3)

- `compilationMode` 옵션 제거하여 기본 infer 모드로 전환
- WebSocket + RAF 배치 + 다수 ref 패턴의 useClaudeSocket, useTeamSocket에 `"use no memo"` 적용

## 검증 결과

- **빌드**: 성공 (17.21s, 기존 대비 +70% — Compiler Babel 분석 패스로 인한 예상된 증가)
- **테스트**: 151/151 전체 통과
- **린트**: 25 warnings, 0 errors
- **타입체크**: `tsc --noEmit` 통과

## 비고

- 빌드 시간 증가(~70%)는 Compiler의 정적 분석 패스로 인한 예상된 비용
- Phase 4(수동 메모이제이션 정리)는 2-4주 안정화 후 별도 진행 예정
- `@testing-library/dom` devDependency 누락도 함께 수정 (기존 이슈)
