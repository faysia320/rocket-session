# 작업 이력: 사용량 뱃지 모던 & 소프트 스타일 적용

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Top bar 사용량 뱃지의 색상을 파스텔 배경 + 짙은 텍스트 조합(모던 & 소프트 스타일)으로 변경하고, 글꼴 굵기를 메인/보조 텍스트로 분리했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 사용량 뱃지 색상 및 글꼴 굵기 변경

## 상세 변경 내용

### 1. 색상 변경 (utilizationBadgeClass)

기존 Tailwind CSS 변수 기반 반투명 스타일에서 HEX 파스텔 색상으로 변경:

| 티어 | 조건 | 배경 | 보더 | 글자 |
|------|------|------|------|------|
| 🟢 초록 | < 50% | `#E8F5E9` | `#A5D6A7` | `#1B5E20` |
| 🟠 주황 | 50-80% | `#FFF3E0` | `#FFCC80` | `#E65100` |
| 🔴 빨강 | >= 80% | `#FFEBEE` | `#EF9A9A` | `#B71C1C` |

### 2. 글꼴 굵기 분리

- Badge 레벨 `font-medium` 제거
- 메인 텍스트 (라벨 + 퍼센트): `font-bold` (700)
- 보조 텍스트 (카운트다운): `font-normal` (400), `opacity-60` 제거

## 테스트 방법

1. 브라우저에서 top bar 확인
2. utilization < 50%: 연초록 배경 + 짙은 초록 텍스트
3. utilization 50-80%: 연주황 배경 + 짙은 오렌지 텍스트
4. utilization >= 80%: 연빨강 배경 + 짙은 빨강 텍스트
