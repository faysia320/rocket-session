# 코드 스타일 및 컨벤션

## 컴포넌트 작성 순서
```vue
<script setup lang="ts">
// 1. 외부 라이브러리 import
// 2. Vue import (computed, ref, toRefs, watch, onMounted)
// 3. 로컬 import
// 4. Props/Emits 타입 정의
// 5. Props는 toRefs로 반응성 유지
// 6. v-model 정의 (defineModel)
// 7. Store는 storeToRefs 사용
// 8. API는 TanStack Query 사용
// 9. Ref 네이밍: {elementName}Ref
</script>
```

## 네이밍 규칙
| 타입 | 패턴 | 예시 |
|------|------|------|
| 컴포넌트 파일 | `PascalCase.vue` | `UserCard.vue` |
| Composable | `useXxx.ts` | `useUser.ts` |
| Store | `xxxStore.ts` | `mainStore.ts` |
| 유틸리티 | `camelCase.ts` | `formatDate.ts` |
| 상수 | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| API 경로 | `kebab-case` | `/api/user-profile` |
| Ref 변수 | `{name}Ref` | `dialogRef`, `gridRef` |
| 핸들러 함수 | `{action}Handler` 또는 `on{Action}` | `clickHandler`, `onSubmit` |

## 금지 사항
- `any` 타입
- `@ts-ignore`, `@ts-expect-error`
- `console.log` (warn, error만 허용)
- `alert()`, `eval()`
- 빈 catch 블록
- `==` (`===` 사용)
- 매직 넘버 (상수로 정의)
- 중첩 삼항 연산자
- 패키지 간 직접 import (반드시 libraries 경유)

## 파일/함수 크기 제한
- 파일 ≤ 300 LOC
- 함수 ≤ 50 LOC
- 매개변수 ≤ 5
- 순환 복잡도 ≤ 10

## 언어 규칙
| 대상 | 언어 |
|------|------|
| 설명, 주석, 커밋 메시지 | 한국어 |
| 변수명, 함수명, 타입명 | 영어 |
| 사용자 노출 에러 메시지 | 한국어 |

## 커밋 메시지
```
feat: 새 기능
fix: 버그 수정
refactor: 리팩터링
docs: 문서
chore: 기타 (빌드, 설정 등)
```
