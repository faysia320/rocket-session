# 작업 이력: iPhone 모바일 이슈 수정

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

iPhone에서 발생하는 두 가지 모바일 이슈를 수정:
1. Chat Input 터치 시 iOS Safari 자동 확대 방지 (font-size 16px 적용)
2. 백그라운드 복귀 시 chat panel 내용 자동 갱신

## 변경 파일 목록

### Frontend

- `frontend/src/lib/platform.ts` - 모바일 디바이스 감지 유틸리티 신규 생성
- `frontend/src/components/ui/input.tsx` - 모바일 font-size 16px 적용
- `frontend/src/components/ui/textarea.tsx` - 모바일 font-size 16px 적용
- `frontend/src/features/chat/components/ChatInput.tsx` - Chat textarea 모바일 font-size 16px 적용
- `frontend/src/features/chat/components/AskUserQuestionCard.tsx` - 질문 카드 input/textarea 모바일 font-size 16px 적용
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 모바일 full reconnect 로직 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 모바일 visibility threshold 동기화

## 상세 변경 내용

### 1. iOS Safari 자동 확대 방지

iOS Safari는 font-size가 16px 미만인 input/textarea에 focus 시 자동 확대 동작이 발생함.
프로젝트 커스텀 Tailwind 스케일에서 `text-lg`=16px이 안전한 최소 크기.

- 기본 UI 컴포넌트(Input, Textarea): `text-base`(14px) → `text-lg`(16px)
- ChatInput: `text-sm`(12px) → `text-lg md:text-sm`
- AskUserQuestionCard: `text-xs`(11px) → `text-lg md:text-xs`
- 모든 경우 데스크톱(md+)에서는 기존 크기 유지

### 2. 백그라운드 복귀 시 Chat 갱신

iOS Safari가 백그라운드에서 WebSocket 연결을 2-3초 내에 종료하는 문제 대응:

- `isMobileDevice()` 유틸리티로 모바일 감지
- 모바일 visibility threshold: 5초 → 2초로 단축
- 모바일 복귀 시 `lastSeqRef=0` 리셋하여 full session state reload 강제
  (기존 incremental `missed_events` 복구 대신 완전한 history 재로드)
- 데스크톱: 기존 ping probe 로직 그대로 유지
- ChatPanel에서 workflow-status 캐시도 추가 무효화

## 테스트 방법

1. iOS Safari에서 Chat Input 터치 → 화면 확대 없음 확인
2. iOS에서 앱 전환(3초+) 후 복귀 → chat 메시지 자동 갱신 확인
3. 데스크톱에서 input 폰트 크기 기존과 동일 확인
4. TypeScript 타입 체크 통과, Vite 빌드 성공 확인

## 비고

- `ChatSearchBar.tsx`에서 이미 `text-[16px] sm:text-md` 패턴을 사용하고 있어 선례가 있음
- 기존 테스트 실패 21개는 변경 전후 동일하며 이번 수정과 무관
