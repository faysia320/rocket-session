# 작업 이력: 새 주제 버튼 디버그 로깅 추가

- **날짜**: 2026-03-08
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Split View에서 "새 주제" 클릭 시 현재 보고 있는 세션이 아닌 다른 세션이 아카이브되는 버그의 원인을 특정하기 위해 런타임 디버그 로그를 추가했습니다.

정적 분석으로는 프론트엔드/백엔드 전체 데이터 흐름이 정상으로 확인되어, 런타임 로그를 통해 `sessionId`와 `sessionInfo.id`의 불일치 여부를 확인합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - `handleNewTopic`에 디버그 로그 3개 추가

## 상세 변경 내용

### 1. handleNewTopic 디버그 로그 추가

- **아카이브 직전**: `sessionId`와 `sessionInfo.id`, `name` 출력 → 크로스 오염 확인
- **아카이브 직후**: API 호출 성공 확인
- **새 세션 생성 후**: `createSession` 완료 및 네비게이션 확인

## 테스트 방법

1. Docker 재빌드 후 Split View에서 세션 완료
2. "새 주제" 클릭
3. 브라우저 콘솔에서 `[NewTopic]` 로그 확인
4. 네트워크 탭에서 `POST /api/sessions/{id}/archive` 요청의 실제 ID 확인

## 비고

- 이 변경은 버그 원인 특정을 위한 임시 디버그 로그입니다.
- 원인 파악 후 로그를 제거하고 실제 수정을 진행해야 합니다.
