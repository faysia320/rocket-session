# Aleatorik UI Frontend - 프로젝트 개요

## 목적
Vue 3 기반의 엔터프라이즈급 공급망 계획(SCP) 솔루션 프론트엔드

## 기술 스택
| 항목 | 내용 |
|------|------|
| Framework | Vue 3 + TypeScript + Vite |
| State | Pinia + TanStack Query |
| UI | Wijmo (그리드/차트), ECharts, Tailwind, Tiptap |
| 구조 | pnpm 모노레포 (7 packages, 2 libraries) |
| 테스트 | Vitest + jsdom + @vue/test-utils |
| i18n | i18next |

## 모노레포 구조
```
aleatorik-ui/
├── packages/           # 애플리케이션 패키지
│   ├── aps/           # 생산계획 (APS) - 핵심 패키지
│   ├── dp/            # 수요계획 (Demand Planning)
│   ├── admin/         # 관리자
│   ├── portal/        # 포털
│   ├── smart-report/  # 리포트
│   ├── smart-editor/  # 에디터
│   └── fab-sched/     # Fab 스케줄러
├── libraries/          # 공유 라이브러리
│   ├── moz-component/ # 핵심 컴포넌트 (@vmscloud/moz-component)
│   └── moz-ui-components/ # UI 컴포넌트
└── vitest.config.ts   # 루트 테스트 설정
```

## 패키지 의존성
```
packages/* → @vmscloud/moz-component (workspace:^)
           → @tanstack/vue-query
           → pinia
           → wijmo, echarts
```

## 주요 의존성 버전
| 패키지 | 버전 |
|--------|------|
| Vue | ^3.4.14 |
| TypeScript | ^5.3.3 |
| Vite | ^6.3.3 |
| Pinia | ^2.1.7 |
| TanStack Query | 5.28.13 |
| Wijmo | 5.20232.939 |
| ECharts | ^5.6.0 |
