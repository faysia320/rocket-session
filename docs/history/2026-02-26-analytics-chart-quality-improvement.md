# 작업 이력: Analytics 차트 퀄리티 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Analytics 대시보드의 차트 디자인, 심미성, 가독성을 전면 개선했습니다.
하드코딩된 HSL 색상을 CSS 변수 기반 디자인 토큰으로 교체하고,
공유 차트 설정 모듈 및 UI 컴포넌트를 추출하여 중복을 제거했습니다.
라이트/다크 테마 양쪽을 모두 지원합니다.

## 변경 파일 목록

### Frontend - 기반 설정

- `frontend/src/index.css` - 차트 CSS 변수 22개 추가 (:root + .dark)
- `frontend/tailwind.config.js` - chart.1~5 색상 토큰 등록

### Frontend - 공유 모듈 (신규)

- `frontend/src/features/analytics/lib/chartConfig.ts` - useChartColors 훅, 상수, 팩토리 함수
- `frontend/src/features/analytics/components/ChartTooltip.tsx` - 커스텀 Recharts Tooltip
- `frontend/src/features/analytics/components/ChartLegend.tsx` - 커스텀 Recharts Legend
- `frontend/src/features/analytics/components/ChartCard.tsx` - 공유 카드 래퍼 (shadow, empty state)

### Frontend - 차트 컴포넌트 리팩토링

- `frontend/src/features/analytics/components/DailyTokenChart.tsx` - useChartColors, gradient, 높이 증가
- `frontend/src/features/analytics/components/PhaseTokenBreakdown.tsx` - useChartColors, LabelList 추가
- `frontend/src/features/analytics/components/ProjectBreakdown.tsx` - useChartColors, LabelList 추가
- `frontend/src/features/analytics/components/SessionPhaseChart.tsx` - useChartColors, 애니메이션 스태거링

### Frontend - UI 개선

- `frontend/src/features/analytics/components/TokenSummaryCards.tsx` - border-t-2, shadow, 폰트 증가
- `frontend/src/features/analytics/components/SessionRankingTable.tsx` - ChartCard 래퍼, 크기 증가
- `frontend/src/features/analytics/components/AnalyticsDashboard.tsx` - 간격 space-y-4→5, gap-4→5

## 상세 변경 내용

### 1. CSS 변수 및 Tailwind 설정

- `:root`와 `.dark`에 `--chart-1`~`--chart-5`, `--chart-grid`, `--chart-axis-text`, `--chart-tooltip-*` 변수 추가
- Tailwind config에 `chart.1`~`chart.5` 색상 토큰 등록
- Recharts SVG는 CSS var()를 직접 사용할 수 없어 `getComputedStyle` 런타임 해석 방식 채택

### 2. 공유 차트 설정 모듈 (chartConfig.ts)

- `useChartColors()`: CSS 변수를 런타임에 resolve하여 Recharts에 전달하는 훅
- `CHART_FONT`, `CHART_DIMENSIONS`, `CHART_ANIMATION` 상수
- `getXAxisProps()`, `getYAxisProps()`, `getGridProps()` 팩토리 함수로 축/그리드 설정 통일

### 3. 공유 UI 컴포넌트

- `ChartTooltip`: 컬러 dot, tabular-nums, box-shadow, 테마 인식
- `ChartLegend`: 12px 폰트, 라운드 스와치, flex-wrap
- `ChartCard`: shadow-sm/hover:shadow-md, 빈 상태 통합, title/subtitle/action props

### 4. 차트 리팩토링

- 모든 차트에서 하드코딩 COLORS 상수 제거 → useChartColors() 전환
- DailyTokenChart: 4개 영역 모두 gradient 적용, 높이 240→280
- PhaseTokenBreakdown/ProjectBreakdown: LabelList로 데이터 레이블 추가, barGap 확대
- SessionPhaseChart: PHASE_COLORS 제거, YAxis 폭 증가, 애니메이션 스태거링

### 5. KPI 카드 및 테이블 개선

- TokenSummaryCards: border-t-2 색상 강조선, 아이콘/폰트 크기 증가, tabular-nums
- SessionRankingTable: ChartCard 래퍼 적용, 스크롤 영역 확대

## 테스트 방법

1. Analytics 페이지 접속
2. 라이트/다크 테마 전환 확인
3. 각 차트 hover 시 Tooltip 스타일 확인
4. 데이터 레이블 표시 확인
5. 빈 데이터 상태에서 empty state 표시 확인

## 검증 결과

- `npm run build`: 성공
- `npm run lint`: 에러 없음
- `npm run test`: 151개 전부 통과
