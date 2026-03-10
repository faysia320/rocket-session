# 작업 이력: Top Bar 사용량 라벨 개선

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Top Bar의 UsageIndicator를 중앙으로 이동하고, 회색톤 텍스트의 가독성을 개선하며, 7d 카운트다운을 day/hour/minute 형태로 변경했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 레이아웃 3영역 분리, 투명도 클래스 상향, 시간 포맷 변경
- `frontend/src/index.css` - `--muted-foreground` CSS 변수 밝기 조정 (다크/라이트 모두)

## 상세 변경 내용

### 1. UsageIndicator 중앙 배치

- header 내부를 3영역 flex 레이아웃으로 변경: 좌측 nav(`flex-1`) / 중앙 Usage(`shrink-0`) / 우측 버튼(`flex-1 justify-end`)
- 기존 `ml-auto` 단일 div에서 UsageIndicator를 분리하여 독립된 중앙 영역에 배치
- UsageIndicator의 불필요한 `mr-1` 클래스 제거 (로딩/에러/정상 상태 모두)

### 2. 회색톤 가독성 개선

- **라이트 테마** `--muted-foreground`: `233 10% 47%` → `233 12% 40%` (더 어둡게 = 밝은 배경 대비 향상)
- **다크 테마** `--muted-foreground`: `215 16% 47%` → `215 20% 57%` (더 밝게 = 어두운 배경 대비 향상)
- 라벨 투명도: `/60` → `/80`, 카운트다운 투명도: `/40` → `/60`, 구분자: `text-border` → `text-muted-foreground/50`

### 3. 7d 카운트다운 day/hour/minute 형태

- `formatTimeRemaining` 함수에 day 계산 추가
- 1일 이상: `3d 5h 12m` / 1일 미만: `12h 30m` 형태로 표시
- 5h 윈도우는 항상 days=0이므로 기존 형태 유지

## 관련 커밋

- Design: Top Bar 사용량 라벨 중앙 배치 및 가독성 개선

## 후속 작업: 사용량 라벨 뱃지 UI 변경

### 변경 요약

플레인 텍스트(`5h: 42% | 7d: 65%`)를 shadcn/ui `Badge` 컴포넌트 기반 뱃지 UI로 교체하여 시각적 구분과 상태 인지를 개선했습니다.

### 상세 변경 내용

1. **Badge 컴포넌트 도입**: `<Badge variant="outline">`으로 각 사용량 지표(5h, 7d)를 독립 뱃지로 감쌈
2. **사용률 기반 색상 뱃지**: `utilizationBadgeClass` 함수 추가 — `<50%` 초록, `50-79%` 노랑, `>=80%` 빨강 (배경/텍스트/보더 동시 적용)
3. **데드코드 정리**: 기존 `utilizationColor` 함수 제거 (뱃지 전환으로 미사용)
4. **파이프 구분자 제거**: 텍스트 파이프(`|`) 대신 뱃지 간 `gap-1.5`로 시각 분리
5. **모바일 반응형 유지**: 축약 라벨(`h`/`w`) + 퍼센트만 표시

### 관련 커밋

- Design: Top Bar 사용량 라벨을 뱃지 UI로 변경

## 비고

- `--muted-foreground` CSS 변수는 122개 파일 532곳에서 사용되므로 시각적 전체 확인 권장
- QA 2차 리뷰에서 `flex-1` + `shrink-0` 충돌 수정 완료
