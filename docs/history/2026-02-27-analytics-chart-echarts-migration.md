# 작업 이력: Analytics 차트 Apache ECharts 마이그레이션

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Analytics 대시보드의 4개 차트를 Recharts 3.7.0에서 Apache ECharts 6.0.0으로 전면 교체했습니다. 다크모드 시 `purple-passion`, 라이트모드 시 `roma` 공식 테마를 적용하여 시각적 완성도를 높였습니다.

## 변경 파일 목록

### Frontend - 새로 생성 (7개)

- `frontend/src/features/analytics/lib/echarts.ts` - ECharts tree-shaking 진입점 (LineChart, BarChart, Grid, Tooltip, Legend, CanvasRenderer만 등록)
- `frontend/src/features/analytics/lib/useECharts.ts` - 커스텀 훅 (init/dispose/resize/theme 전환)
- `frontend/src/features/analytics/lib/echartsConfig.ts` - 공유 상수 및 ECharts option 팩토리 함수
- `frontend/src/features/analytics/lib/registerThemes.ts` - purple-passion/roma 테마 등록 사이드이펙트 모듈
- `frontend/src/features/analytics/lib/tooltipFormatter.ts` - HTML 문자열 기반 tooltip formatter
- `frontend/src/features/analytics/lib/themes/purple-passion.json` - 다크모드 ECharts 테마
- `frontend/src/features/analytics/lib/themes/roma.json` - 라이트모드 ECharts 테마

### Frontend - 재작성 (4개)

- `frontend/src/features/analytics/components/DailyTokenChart.tsx` - Stacked Area Chart (Recharts → ECharts)
- `frontend/src/features/analytics/components/PhaseTokenBreakdown.tsx` - Horizontal Grouped Bar (Recharts → ECharts)
- `frontend/src/features/analytics/components/SessionPhaseChart.tsx` - Stacked Horizontal Bar (Recharts → ECharts)
- `frontend/src/features/analytics/components/ProjectBreakdown.tsx` - Horizontal Grouped Bar (Recharts → ECharts)

### Frontend - 수정 (2개)

- `frontend/vite.config.ts` - vendor chunk 설정: `vendor-recharts` → `vendor-echarts`
- `frontend/src/index.css` - Recharts용 CSS 변수 삭제 (`--chart-grid`, `--chart-axis-text`, `--chart-tooltip-*`)

### Frontend - 삭제 (3개)

- `frontend/src/features/analytics/components/ChartTooltip.tsx` - Recharts 전용 React tooltip 컴포넌트
- `frontend/src/features/analytics/components/ChartLegend.tsx` - Recharts 전용 React legend 컴포넌트
- `frontend/src/features/analytics/lib/chartConfig.ts` - Recharts 전용 색상/축/그리드 설정

### 패키지 변경

- `frontend/package.json` - `+echarts@6.0.0`, `-recharts@3.7.0`
- `frontend/pnpm-lock.yaml` - lockfile 업데이트 (-34 packages)

## 상세 변경 내용

### 1. ECharts 인프라 모듈 구축

- `echarts.ts`: tree-shaking을 위한 모듈별 import (echarts/core, echarts/charts, echarts/components, echarts/renderers)
- `useECharts.ts`: next-themes의 `resolvedTheme`과 연동, theme 변경 시 dispose/re-init, option 변경 시 setOption만 호출, ResizeObserver 기반 반응형 리사이즈
- `echartsConfig.ts`: 기존 CHART_FONT/DIMENSIONS/ANIMATION 상수 유지 + ECharts option 팩토리 함수 추가 (getBaseAxis, getBaseGrid, getBaseTooltip, getBaseLegend, getSplitLineStyle)

### 2. 테마 시스템

- Apache ECharts Theme Builder에서 purple-passion.json, roma.json 다운로드
- registerThemes.ts에서 사이드이펙트로 한 번만 등록
- 모든 차트에 `backgroundColor: "transparent"` 설정하여 ChartCard 배경과 충돌 방지

### 3. 차트 컴포넌트 마이그레이션

- Recharts JSX 선언형 → ECharts option 객체 imperative 방식으로 전환
- props 인터페이스 동일 유지하여 AnalyticsDashboard.tsx 수정 불필요
- 주요 매핑: Area type="monotone" → line smooth:true, stackId → stack, layout="vertical" → yAxis type:category, LabelList → series.label

### 4. Tooltip 변환

- React 컴포넌트 (ChartTooltip.tsx) → HTML 문자열 formatter 함수 (tooltipFormatter.ts)
- ECharts 내장 params.marker 활용으로 색상 도트 자동 생성
- JetBrains Mono 폰트, tabular-nums 스타일 유지

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. Analytics 페이지 접속 → 4개 차트 데이터 표시 확인
2. 기간 선택 (오늘/7일/30일/전체) → 차트 데이터 갱신 확인
3. 다크/라이트 모드 토글 → purple-passion ↔ roma 테마 전환 확인
4. 브라우저 리사이즈 → 차트 자동 반응형 리사이즈 확인
5. 차트 호버 → 툴팁 (포맷된 토큰 값 + 색상 도트) 확인
6. 범례 클릭 → 시리즈 토글 확인

## 비고

- vendor-echarts 청크: 526.76 KB / 177.46 KB gzipped (기존 vendor-recharts 대비 유사 크기)
- ECharts 6.0.0은 zrender 의존성 포함으로 tree-shaking 효과가 제한적
- AnalyticsDashboard.tsx, ChartCard.tsx, TokenSummaryCards.tsx, SessionRankingTable.tsx는 변경 없음
