# 작업 이력: Prettier + ESLint 설정 및 코드 포맷팅

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드 코드베이스에 Prettier와 ESLint를 도입하여 코드 포맷팅 및 린트 검사 체계를 구축했습니다. 전체 소스 파일에 Prettier 포맷을 적용하고, ESLint 에러를 수정했습니다.

## 변경 파일 목록

### Frontend - 설정 파일 (신규)

- `frontend/.prettierrc.json` - Prettier 설정 (2칸 들여쓰기, 쌍따옴표, 세미콜론, trailing comma)
- `frontend/.prettierignore` - Prettier 제외 패턴 (node_modules, dist, routeTree.gen.ts)
- `frontend/eslint.config.js` - ESLint flat config (typescript-eslint, react-hooks, react-refresh)

### Frontend - 패키지

- `frontend/package.json` - devDependencies 및 스크립트 추가
- `frontend/pnpm-lock.yaml` - 락파일 업데이트

### Frontend - ESLint 에러 수정

- `frontend/src/features/chat/components/ContextWindowBar.tsx` - 조건부 Hook 호출 수정 (rules-of-hooks)
- `frontend/src/lib/utils.test.ts` - 상수 표현식 수정 (no-constant-binary-expression)
- `frontend/src/store/useSessionStore.ts` - 미사용 변수 prefix 추가

### Frontend - Prettier 포맷팅

- `frontend/src/**/*.{ts,tsx}` - 전체 소스 파일 Prettier 포맷 적용 (약 150개 파일)

## 상세 변경 내용

### 1. Prettier 설정

- 2칸 들여쓰기, 쌍따옴표, 세미콜론 있음, trailing comma (all)
- printWidth: 100, endOfLine: lf
- routeTree.gen.ts 자동 생성 파일 제외

### 2. ESLint 설정

- ESLint v10 flat config 형식 사용
- typescript-eslint recommended 규칙 적용
- react-hooks, react-refresh 플러그인 추가
- React Compiler 전용 규칙 비활성화 (set-state-in-effect, preserve-manual-memoization, incompatible-library, static-components, immutability, purity)
- TanStack Router routes 및 shadcn/ui 컴포넌트에 대해 react-refresh/only-export-components 규칙 제외
- eslint-config-prettier로 Prettier와 충돌 방지

### 3. ESLint 에러 수정

- `ContextWindowBar.tsx`: `useMemo`를 early return 이전으로 이동하여 조건부 Hook 호출 해결
- `utils.test.ts`: `false && "hidden"` 상수 표현식을 변수로 분리
- `useSessionStore.ts`: 마이그레이션 코드의 미사용 구조분해 변수에 `_` prefix 추가

### 4. 추가된 npm 스크립트

| 스크립트 | 명령어 |
|----------|--------|
| `pnpm format` | Prettier 포맷 적용 |
| `pnpm format:check` | Prettier 포맷 검증 |
| `pnpm lint` | ESLint 검사 |
| `pnpm lint:fix` | ESLint 자동 수정 |

## 최종 검증 결과

- Prettier: All matched files use Prettier code style
- ESLint: 0 errors, 53 warnings (주로 no-explicit-any)
- TypeScript: 타입 에러 없음
- 빌드: 성공

## 비고

- `eslint-plugin-react-hooks` v7은 React Compiler 규칙을 포함하며, 이 프로젝트는 React Compiler를 사용하지 않으므로 해당 규칙들을 비활성화함
- 남은 53개 경고 중 51개는 `@typescript-eslint/no-explicit-any`로, 점진적으로 타입을 개선하면 해소 가능
