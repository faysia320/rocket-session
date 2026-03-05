# 작업 이력: Usage 표시 TopBar 이동 + Todo 완료 처리 + ChatInput 드래그 방지

- **날짜**: 2026-03-05
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. 화면 하단 UsageFooter를 제거하고, 사용량 정보를 상단 GlobalTopBar 우측으로 이동 (모바일 포함 항상 표시)
2. 세션 완료 시 잔여 todo(in_progress + pending)를 모두 completed로 전환하도록 수정
3. ChatInput textarea에서 파일 드래그앤드롭 시 기본 동작 방지

## 변경 파일 목록

### Frontend

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - UsageIndicator 컴포넌트 추가 (모바일/데스크톱 반응형)
- `frontend/src/features/usage/components/UsageFooter.tsx` - 삭제 (더 이상 사용 안 함)
- `frontend/src/routes/__root.tsx` - UsageFooter 제거, SplitViewPagination 독립 배치
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - 세션 완료 시 pending todo도 completed 처리
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - todo 완료 처리 테스트 3건 추가
- `frontend/src/features/chat/components/ChatInput.tsx` - textarea 드래그앤드롭 방지

## 상세 변경 내용

### 1. Usage 표시 위치 변경 (Footer → TopBar)

- UsageFooter 컴포넌트(브랜드 문구 + 사용량)를 완전히 제거
- GlobalTopBar 우측 액션 영역 맨 앞에 UsageIndicator 컴포넌트 추가
- 모바일: 축약 라벨(h:/w:) + 퍼센트만 표시
- 데스크톱(sm+): 5h/7d 라벨 + 퍼센트 + 카운트다운 표시
- 로딩/에러 상태 처리 포함
- SplitViewPagination은 main 하단에 독립 div로 재배치

### 2. 세션 완료 시 잔여 Todo 처리

- WS_SESSION_STATE: 세션이 이미 완료(idle)일 때 history에서 추출한 todo 중 in_progress/pending을 completed로 전환
- WS_STATUS idle: 기존에는 in_progress만 completed로 전환했으나, pending도 함께 completed 처리
- 테스트 3건 추가로 검증

### 3. ChatInput 드래그앤드롭 방지

- textarea에 파일 드래그 시 브라우저 기본 동작(파일 열기) 방지
- onDragOver/onDrop 이벤트 핸들러 추가

## 관련 커밋

- 커밋 후 해시 기록 예정

## 테스트 방법

1. 상단 TopBar 우측에 사용량(5h/7d 퍼센트)이 표시되는지 확인
2. 모바일 뷰포트에서도 사용량이 보이는지 확인
3. 하단 footer 바가 사라졌는지 확인
4. 세션 완료 후 todo 목록이 모두 completed로 표시되는지 확인
