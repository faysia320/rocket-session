# Design System 가이드라인

> **AI Agent 참고**: 이 문서는 스타일링 작업 시 필수 참조 문서입니다.
> 새 컴포넌트 작성이나 스타일 수정 전에 반드시 확인하세요.

---

## 핵심 원칙 (PRINCIPLES)

### 1. 4px 그리드 시스템
모든 간격과 크기는 **4의 배수**를 사용합니다.

```
허용: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48...
금지: 5, 7, 9, 11, 13, 15, 17, 22, 25...
```

**Tailwind 매핑:**
| 픽셀 | Tailwind | 예시 |
|------|----------|------|
| 4px | `1` | `p-1`, `gap-1` |
| 8px | `2` | `p-2`, `gap-2` |
| 12px | `3` | `p-3`, `gap-3` |
| 16px | `4` | `p-4`, `gap-4` |
| 20px | `5` | `p-5`, `gap-5` |
| 24px | `6` | `p-6`, `gap-6` |
| 28px | `7` | `h-7` (28px) |
| 32px | `8` | `p-8`, `gap-8` |
| 36px | `9` | `h-9` (36px) |
| 40px | `10` | `h-10` (40px) |

### 2. 시맨틱 네이밍 (의미 기반)
색상은 **역할/의미**로 지정하고, 구체적인 색상명은 사용하지 않습니다.

```tsx
// ❌ 금지: 색상 이름 직접 사용
className="bg-blue-500 text-white"
className="bg-red-500"
className="bg-[#3b82f6]"

// ✅ 권장: 시맨틱 색상 사용
className="bg-primary text-primary-foreground"
className="bg-destructive text-destructive-foreground"
className="bg-muted text-muted-foreground"
```

### 3. 테마 독립성
하드코딩된 색상은 라이트/다크 모드 전환 시 깨집니다.
CSS 변수를 사용하면 자동으로 테마에 맞게 전환됩니다.

```tsx
// ❌ 테마 전환 시 문제 발생
className="bg-white dark:bg-gray-900"
className="text-black dark:text-white"

// ✅ 자동 테마 전환
className="bg-background text-foreground"
className="bg-card text-card-foreground"
```

### 4. Z-Index 레이어 계층
UI 레이어는 정해진 계층을 따릅니다.

```
base(0) < raised(10) < dropdown(50) < overlay(50) < modal(60) < popover(70) < tooltip(80) < toast(90)
```

### 5. 예외 허용 기준

| 상황 | 허용 여부 | 조건 |
|-----|----------|------|
| 레이아웃 전용 너비 (`w-[500px]`) | ✅ 허용 | 컴포넌트 JSDoc에 문서화 |
| 1회성 미세조정 (`py-[7px]`) | ❌ 지양 | 가까운 4px 그리드 값 사용 |
| 외부 라이브러리 스타일 오버라이드 | ✅ 허용 | 주석으로 사유 명시 |
| 키보드 힌트 등 초소형 텍스트 (`text-[10px]`) | ✅ 허용 | 컴포넌트 JSDoc에 문서화 |

---

## 빠른 참조 (QUICK REFERENCE)

### 시맨틱 색상 클래스

| 용도 | 배경 | 텍스트 | 테두리 |
|-----|------|-------|-------|
| 기본 | `bg-background` | `text-foreground` | `border-border` |
| 카드 | `bg-card` | `text-card-foreground` | `border-border` |
| 팝오버 | `bg-popover` | `text-popover-foreground` | `border-border` |
| 강조 (primary) | `bg-primary` | `text-primary-foreground` | `border-primary` |
| 보조 | `bg-muted` | `text-muted-foreground` | `border-input` |
| 위험 | `bg-destructive` | `text-destructive-foreground` | `border-destructive` |
| 호버 | `bg-accent` | `text-accent-foreground` | - |

### Tailwind 플러그인 유틸리티

```tsx
// Z-Index (직접 사용)
className="z-dropdown"   // 50
className="z-overlay"    // 50
className="z-modal"      // 60
className="z-popover"    // 70
className="z-tooltip"    // 80

// Shadow
className="shadow-card"      // 카드용 그림자
className="shadow-dropdown"  // 드롭다운용 그림자
className="shadow-modal"     // 모달용 그림자
className="shadow-tooltip"   // 툴팁용 그림자

// Input Height
className="h-input-sm"  // 28px
className="h-input-md"  // 36px
className="h-input-lg"  // 44px

// Icon Size
className="icon-xs"  // 12px
className="icon-sm"  // 14px
className="icon-md"  // 16px
className="icon-lg"  // 20px

// Status Colors (환경 표시용)
className="bg-status-dev"      // 개발
className="bg-status-staging"  // 스테이징
className="bg-status-prod"     // 운영
```

### 컴포넌트 높이 기준

| 컴포넌트 | Small | Default | Large |
|---------|-------|---------|-------|
| Button | `h-7` (28px) | `h-9` (36px) | `h-10` (40px) |
| Input | `h-7` (28px) | `h-9` (36px) | `h-10` (40px) |
| Badge | `h-5` (20px) | `h-6` (24px) | `h-7` (28px) |
| TopMenuBar | - | `h-10` (40px) | - |
| StatusBar | - | `h-6` (24px) | - |

### Button Size 선택 가이드

Button 컴포넌트의 `size` prop은 상대적 이름(`sm`, `icon-md`)을 사용하므로 실제 픽셀 크기와 권장 사용처를 참고하세요.

#### 텍스트 버튼 (텍스트 + 아이콘)

| Size | 높이 | 아이콘 | 권장 사용처 |
|------|------|--------|------------|
| `xs` | 20px | 12px | 극소 버튼 (거의 사용 안 함) |
| `sm` | 28px | 14px | 툴바 액션 버튼 (EditorToolbar의 실행/취소/포맷) |
| `default` | 36px | 16px | 일반 버튼 (AlertDialog, 폼 submit) |
| `lg` | 44px | 20px | 주요 CTA 버튼 |

#### 아이콘 전용 버튼 (정사각형)

| Size | 크기 | 아이콘 | 권장 사용처 |
|------|------|--------|------------|
| `icon-xs` | 20x20 | 12px | 탭 닫기, 태그 삭제 등 극소 아이콘 |
| `icon-sm` | 24x24 | 14px | 탭바/패널 헤더의 작은 액션 (새 탭 추가) |
| `icon-md` | 28x28 | 16px | 결과 패널 툴바 (복사, 내보내기, 지우기) |
| `icon` | 36x36 | 16px | 일반 아이콘 버튼 |

#### 선택 기준 의사결정 트리

```
텍스트가 있는가?
├── Yes → 툴바/헤더인가?
│         ├── Yes → size="sm" (28px)
│         └── No → size="default" (36px) 또는 lg (44px for CTA)
└── No (아이콘만) → 버튼이 어디에 위치하는가?
                    ├── 탭/태그 닫기 (매우 작음) → size="icon-xs" (20x20)
                    ├── 탭바/패널 헤더 (작음) → size="icon-sm" (24x24)
                    ├── 툴바 액션 (중간) → size="icon-md" (28x28)
                    └── 일반 버튼 → size="icon" (36x36)
```

### Badge Size & Variant 가이드

Badge 컴포넌트는 상태, 태그, 타입 표시 등에 사용됩니다.

#### Variant 선택

| Variant | 용도 | 색상 |
|---------|------|------|
| `default` | 기본 태그 | Primary |
| `secondary` | 보조 태그 | Secondary |
| `destructive` | 오류/삭제 상태 | Red |
| `outline` | 외곽선만 | Foreground |
| `success` | 성공 상태 | Green |
| `warning` | 경고 상태 | Yellow |
| `string` | 문자열 타입 표시 | Emerald |
| `number` | 숫자 타입 표시 | Blue |

#### Size 선택

| Size | 크기 | 용도 |
|------|------|------|
| `sm` | 작은 패딩, 10px 텍스트 | 태그 목록, 좁은 공간 |
| `default` | 표준 패딩, 11px 텍스트 | 일반 뱃지 |
| `lg` | 큰 패딩, 12px 텍스트 | 강조 뱃지 |
| `icon` | 20x20 원형, 10px 텍스트 | 타입 아이콘 (S/N) |

#### Type Badge 사용 예시

매개변수 타입 표시 등에서 `string`/`number` variant와 `icon` size를 조합하여 사용합니다.

```tsx
import { Badge } from '@/components/ui/badge';

// 문자열 타입 뱃지 (에메랄드 그린)
<Badge variant="string" size="icon" title="문자열 (String)">S</Badge>

// 숫자 타입 뱃지 (블루)
<Badge variant="number" size="icon" title="숫자 (Number)">N</Badge>
```

CSS 변수 참조: `design-system/css/variables.css`의 `--badge-type-*` 변수

### 레이아웃 컴포넌트 (Stack, Flex)

요소 배치 시 `div` + Tailwind 대신 레이아웃 컴포넌트를 사용합니다.

```tsx
import { Stack } from '@/components/ui/stack';
import { Flex } from '@/components/ui/flex';

// ❌ 기존 방식: div + Tailwind
<div className="flex flex-col gap-4">
  <Button>버튼 1</Button>
  <Button>버튼 2</Button>
</div>

// ✅ 권장 방식: Stack 컴포넌트
<Stack gap={4}>
  <Button>버튼 1</Button>
  <Button>버튼 2</Button>
</Stack>
```

**Stack vs Flex:**

| 컴포넌트 | 기본 방향 | 용도 |
|---------|----------|------|
| `Stack` | vertical (세로) | 목록, 폼 필드, 카드 내용 |
| `Flex` | horizontal (가로) | 버튼 그룹, 헤더, 인라인 배치 |

**Stack 사용 예시:**

```tsx
// 수직 배치 (기본)
<Stack gap={4}>
  <Input placeholder="이름" />
  <Input placeholder="이메일" />
  <Button>제출</Button>
</Stack>

// 수평 배치
<Stack direction="horizontal" gap={2} align="center">
  <Badge>태그 1</Badge>
  <Badge>태그 2</Badge>
</Stack>
```

**Flex 사용 예시:**

```tsx
// 버튼 그룹
<Flex gap={2}>
  <Button variant="outline">취소</Button>
  <Button>저장</Button>
</Flex>

// 양쪽 정렬
<Flex justify="between" align="center">
  <span>총 3개</span>
  <Button size="sm">더보기</Button>
</Flex>

// 확장 + 고정
<Flex gap={2}>
  <Input className="flex-1" />
  <Button>검색</Button>
</Flex>
```

**Gap 값 (4px 그리드):**

| gap | 픽셀 | 사용처 |
|-----|------|-------|
| 1 | 4px | 아이콘-텍스트 |
| 2 | 8px | 버튼 그룹, 태그 |
| 3 | 12px | 폼 필드 (compact) |
| 4 | 16px | 폼 필드 (기본) |
| 6 | 24px | 섹션 내부 |
| 8 | 32px | 섹션 간격 |

---

## 변환 가이드 (MIGRATION)

### 하드코딩 → 디자인 토큰

| 하드코딩 값 | 변환 후 |
|------------|--------|
| `z-50` | `z-overlay` 또는 `z-dropdown` |
| `z-[60]` | `z-modal` |
| `z-[999]` | `z-toast` 또는 적절한 레이어 |
| `shadow-md` | `shadow-dropdown` |
| `shadow-lg` | `shadow-modal` |
| `shadow-xl` | `shadow-modal` |
| `bg-[#FEE2E2]` (연한 빨강) | `bg-destructive/10` |
| `text-[#7F1D1D]` (진한 빨강) | `text-destructive` |
| `hover:text-[#f87171]` | `hover:text-destructive` |
| `h-[36px]` | `h-9` |
| `h-[28px]` | `h-7` |
| `h-[22px]` | `h-6` (가장 가까운 4px 그리드) |
| `py-[7px]` | `py-2` (8px) |

### 스크롤바 색상

```tsx
// ❌ 하드코딩 (테마 비대응)
className="bg-black/20 hover:bg-black/40 dark:bg-white/20"

// ✅ 시맨틱 (테마 자동 대응)
className="bg-muted-foreground/20 hover:bg-muted-foreground/40"
```

---

## 의사결정 트리 (DECISION TREE)

### 색상 선택

```
새로운 색상이 필요한가?
├─ 브랜드/강조색 → bg-primary, text-primary-foreground
├─ 배경색 → bg-background, bg-card, bg-muted
├─ 텍스트 → text-foreground, text-muted-foreground
├─ 위험/삭제 → bg-destructive, text-destructive
├─ 성공 → variant="success" (Badge, Alert)
├─ 경고 → variant="warning" (Badge, Alert)
└─ 환경 표시 → bg-status-dev, bg-status-staging, bg-status-prod
```

### 크기/간격 선택

```
크기 값이 필요한가?
├─ 4의 배수인가?
│   ├─ Yes → Tailwind 클래스 사용 (h-9, p-4, gap-2)
│   └─ No → 가장 가까운 4의 배수로 조정
├─ 컴포넌트 높이인가?
│   └─ h-input-sm/md/lg 또는 h-7/h-9/h-10 사용
└─ 레이아웃 전용 너비인가?
    └─ w-[Npx] 허용 + JSDoc 문서화
```

### Z-Index 선택

```
어떤 UI 요소인가?
├─ 드롭다운/메뉴 → z-dropdown (50)
├─ 오버레이 배경 → z-overlay (50)
├─ 모달/다이얼로그 → z-modal (60)
├─ 팝오버 → z-popover (70)
├─ 툴팁 → z-tooltip (80)
├─ 토스트 알림 → z-toast (90)
└─ 일반 콘텐츠 → z-index 불필요 또는 z-base (0)
```

---

## 파일 구조 (FILE STRUCTURE)

```
frontend/design-system/
├── css/
│   └── variables.css      # CSS 변수 정의 (import in index.css)
├── tokens/
│   ├── index.ts           # 모든 토큰 re-export
│   ├── colors.ts          # 색상 토큰
│   ├── typography.ts      # 폰트 크기, 줄 높이
│   ├── spacing.ts         # 간격 (4px 그리드)
│   ├── radius.ts          # 테두리 반경
│   ├── shadows.ts         # 그림자
│   ├── transitions.ts     # 트랜지션
│   ├── zIndex.ts          # Z-Index 레이어
│   ├── iconSize.ts        # 아이콘 크기
│   └── breakpoints.ts     # 반응형 브레이크포인트
├── utils/
│   └── index.ts           # CSS 변수 헬퍼 함수
├── tailwind/
│   └── plugin.js          # Tailwind 플러그인 (유틸리티 클래스)
├── eslint/
│   ├── index.js           # ESLint 플러그인
│   └── rules/             # 커스텀 ESLint 규칙
└── GUIDELINES.md          # 이 문서
```

### Import 경로

```typescript
// 토큰 사용
import { space, fontSize, zIndex } from '@design-system/tokens';

// 유틸리티 함수
import { cssVar, zIndexVar, spaceVar } from '@design-system/utils';
```

---

## 컴포넌트 JSDoc 템플릿

새 컴포넌트 작성 시 다음 형식의 JSDoc을 포함하세요:

```tsx
/**
 * ComponentName Component
 *
 * Design System References:
 * - Z-Index: z-modal (60)
 * - Shadow: shadow-modal
 * - Height: h-10 (40px)
 * - Colors: Uses semantic tokens (bg-card, text-foreground)
 * - Note: w-[500px] is layout-specific width for panel design
 */
```

---

## ESLint 규칙

활성화된 디자인 시스템 ESLint 규칙:

| 규칙 | 레벨 | 설명 |
|-----|------|------|
| `design-system/no-hardcoded-pixels` | warn | `h-[36px]` 같은 하드코딩 픽셀 탐지 |
| `design-system/no-hardcoded-colors` | warn | `bg-[#3b82f6]` 같은 하드코딩 색상 탐지 |
| `design-system/prefer-design-tokens` | warn | `z-50` 대신 `z-modal` 사용 권장 |

---

## Feature 개발 시 토큰 접근 규칙 (TOKEN ACCESS)

Feature 컴포넌트에서 디자인 시스템 접근은 **계층적 우선순위**를 따릅니다.

### 접근 우선순위

| 우선순위 | 접근 방식 | 예시 | 권장도 |
|---------|----------|------|-------|
| 1 | UI 컴포넌트 | `<Button>`, `<Input>`, `<Badge>` | ✅ 최우선 |
| 2 | Tailwind 시맨틱 클래스 | `bg-primary`, `z-modal`, `shadow-dropdown` | ✅ 권장 |
| 3 | CSS 변수 직접 참조 | `h-[var(--input-height-md)]` | ⚠️ 제한적 허용 |
| 4 | TypeScript 토큰 import | `import { space } from '@design-system/tokens'` | ⚠️ 지양 |
| 5 | 하드코딩 값 | `bg-[#3b82f6]`, `h-[36px]` | ❌ 금지 |

### 상세 가이드

```tsx
// ✅ 레벨 1: UI 컴포넌트 사용 (최우선)
<Button variant="outline" size="sm">저장</Button>
<Input inputSize="sm" placeholder="검색..." />
<Badge variant="success">완료</Badge>

// ✅ 레벨 2: Tailwind 시맨틱 클래스 (권장)
<div className="bg-card border-border rounded-md p-4">
<div className="z-modal shadow-modal">
<span className="text-muted-foreground">

// ⚠️ 레벨 3: CSS 변수 직접 참조 (제한적 - 사유 명시)
// 사유: 컴포넌트에 없는 커스텀 높이 필요
<div className="h-[var(--input-height-md)]">

// ⚠️ 레벨 4: TypeScript 토큰 import (지양 - 동적 계산 시에만)
// 사유: 동적 그리드 간격 계산
import { space } from '@design-system/tokens';
style={{ gap: space[columns * 2] }}

// ❌ 레벨 5: 하드코딩 (금지)
<div className="bg-[#3b82f6]">  // 금지
<div style={{ height: '36px' }}>  // 금지
```

### 레벨 3-4 사용 시 필수 조건

1. **JSDoc 또는 주석으로 사유 명시**
2. **UI 컴포넌트로 대체 불가능한 경우에만**
3. **PR 리뷰 시 정당성 검토**

---

## 체크리스트 (CHECKLIST)

새 컴포넌트/스타일 작성 전 확인:

- [ ] 색상이 시맨틱 클래스를 사용하는가? (`bg-primary`, `text-foreground`)
- [ ] 크기가 4px 그리드를 따르는가? (`h-9`, `p-4`)
- [ ] Z-Index가 정의된 레이어를 사용하는가? (`z-modal`, `z-tooltip`)
- [ ] 하드코딩된 값이 있다면 JSDoc에 문서화했는가?
- [ ] ESLint 경고가 없는가?

---

## 참고 자료

- **스타일 가이드 페이지**: `/style-guide` 라우트에서 모든 토큰 시각화 확인
- **CSS 변수 정의**: `design-system/css/variables.css`
- **Tailwind 설정**: `tailwind.config.js` (플러그인 통합)
