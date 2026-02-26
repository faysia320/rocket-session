# 작업 이력: Analytics 차트 퀄리티 버그 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ECharts 마이그레이션 후 발견된 4가지 비주얼 이슈를 수정했습니다:
범례-차트 겹침, 바 라벨 가독성, 세션명 말줄임표, ChartCard 스타일 개선.

## 변경 파일 목록

### Frontend

- `frontend/src/features/analytics/lib/echartsConfig.ts` - 범례 위치 고정, grid top 여백 확대, CHART_LABEL 상수 추가
- `frontend/src/features/analytics/lib/useECharts.ts` - chartRef 외부 노출 (이벤트 핸들러용)
- `frontend/src/features/analytics/components/DailyTokenChart.tsx` - useECharts destructuring 업데이트
- `frontend/src/features/analytics/components/PhaseTokenBreakdown.tsx` - CHART_LABEL 적용으로 바 라벨 가독성 개선
- `frontend/src/features/analytics/components/ProjectBreakdown.tsx` - CHART_LABEL 적용으로 바 라벨 가독성 개선
- `frontend/src/features/analytics/components/SessionPhaseChart.tsx` - yAxis 말줄임표 + 호버 native tooltip
- `frontend/src/features/analytics/components/ChartCard.tsx` - 그라데이션 배경, 글래스모피즘 스타일 적용

## 상세 변경 내용

### 1. 차트-범례 겹침 해결

- `getBaseLegend`에 `top: 4`, `left: "center"` 명시적 위치 설정
- `getBaseGrid`의 `top` 값 40 → 52로 증가하여 범례 공간 확보

### 2. 바 차트 라벨 가독성 개선

- 새로운 `CHART_LABEL` 상수 추가 (Inter sans-serif, 11px, font-weight 500)
- PhaseTokenBreakdown, ProjectBreakdown의 바 라벨에 적용
- 기존 JetBrains Mono 10px → Inter 11px medium weight로 변경

### 3. SessionPhaseChart 세션명 말줄임표 + 호버 툴팁

- yAxis `axisLabel`에 `overflow: "truncate"`, `ellipsis: "…"`, `width` 설정
- `useECharts` 훅에서 `chartRef`를 외부로 노출하도록 수정
- ECharts `mouseover`/`mouseout` 이벤트로 y축 라벨 호버 시 native tooltip 표시

### 4. ChartCard 스타일 개선

- `rounded-lg` → `rounded-xl`, 더 부드러운 모서리
- `bg-gradient-to-br from-card to-card/80` 그라데이션 배경
- `ring-1 ring-white/5` 내부 글로우 효과
- CSS 변수 기반 shadow (`--shadow-sm`, `--shadow-md`)
- `backdrop-blur-sm`, `border-bright` 반투명 보더

## 테스트 방법

1. Analytics 대시보드 진입
2. 모든 차트에서 범례가 차트 영역과 겹치지 않는지 확인
3. 바 차트의 값 라벨이 읽기 쉬운지 확인
4. 세션별 Phase 토큰 분포에서 긴 세션명이 말줄임표로 표시되는지 확인
5. 말줄임된 세션명 위에 마우스를 올리면 전체 이름이 보이는지 확인
6. ChartCard가 이전보다 시각적으로 개선되었는지 확인
7. 다크모드/라이트모드 전환 시 정상 동작 확인
