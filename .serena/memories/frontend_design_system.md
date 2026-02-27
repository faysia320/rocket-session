# 프론트엔드 디자인 시스템

## Deep Space 테마 (HSL CSS 변수)

프로젝트의 색상 시스템은 `frontend/src/index.css`에 HSL 포맷으로 정의되어 있습니다:

| 용도 | Tailwind 클래스 | CSS 변수 (HSL) |
|------|----------------|----------------|
| 배경 (주) | `bg-background` | `--background: 220 50% 5%` |
| 전경 (주) | `text-foreground` | `--foreground: 215 25% 90%` |
| 카드 배경 | `bg-card` | `--card: 220 37% 7%` |
| 강조 (amber) | `bg-primary` / `text-primary` | `--primary: 38 92% 50%` |
| 보조 | `bg-secondary` | `--secondary: 217 33% 17%` |
| 뮤트 | `bg-muted` / `text-muted-foreground` | `--muted: 217 33% 17%` |
| 입력 | `bg-input` | `--input: 220 45% 8%` |
| 테두리 | `border-border` | `--border: 217 33% 17%` |
| 파괴적 | `text-destructive` | `--destructive: 0 84% 60%` |
| 성공 | `text-success` | `--success: 142 71% 45%` |
| 정보 | `text-info` | `--info: 217 91% 60%` |
| 경고 | `text-warning` | `--warning: 38 92% 50%` |

## 디자인 시스템 참조 파일

| 문서 | 위치 | 내용 |
|------|------|------|
| **Design System Guidelines** | `frontend/design-system/GUIDELINES.md` | 크기, 간격, z-index 등 디자인 토큰 사용 가이드 |
| **CSS 변수 정의** | `frontend/design-system/css/variables.css` | spacing, typography, radius, shadow 토큰 |
| **글로벌 스타일** | `frontend/src/index.css` | Deep Space 테마 (HSL), 키프레임 애니메이션 |
| **Tailwind 설정** | `frontend/tailwind.config.js` | 테마 색상, 폰트, 반지름 매핑 |

## 스페이싱 시스템

Tailwind 기본 4px 그리드 + `design-system/css/variables.css` 커스텀 토큰 사용.