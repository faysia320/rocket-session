# 작업 이력: 모바일 대시보드 탭 높이 100% 미사용 버그 수정

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

모바일 대시보드에서 "세션현황"/"세션히스토리" 탭이 전체 높이를 사용하지 못하고 빈 공간이 발생하는 버그를 수정했습니다. Radix UI `[hidden]` 속성과 Tailwind `flex` 클래스의 CSS 우선순위 충돌이 원인이었습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/routes/index.tsx` - TabsContent의 `flex` → `data-[state=active]:flex`로 변경

## 상세 변경 내용

### 1. CSS 우선순위 충돌 해결

- **원인**: Radix UI는 비활성 탭에 `[hidden]` 속성(`display: none`)을 추가하지만, Tailwind의 `.flex` 클래스(`display: flex`)가 같은 specificity에서 캐스케이드 순서상 우선하여 비활성 탭이 숨겨지지 않음
- **증상**: 두 TabsContent가 `flex-1`로 공간을 50:50 분할 → 세션현황 하단/세션히스토리 상단에 빈 공간
- **수정**: `flex` → `data-[state=active]:flex`로 변경하여 활성 탭에서만 `display: flex` 적용, 비활성 탭은 `[hidden]`의 `display: none`이 정상 작동

## 테스트 방법

1. 모바일 뷰포트(Chrome DevTools)에서 대시보드 접속
2. "세션 현황" 탭: 카드 그리드가 전체 높이 사용, 하단 빈 공간 없음 확인
3. "히스토리" 탭: 검색/필터 + 목록이 전체 높이 사용, 상단 빈 공간 없음 확인
4. DevTools Elements에서 비활성 TabsContent에 `display: none` 적용 확인
