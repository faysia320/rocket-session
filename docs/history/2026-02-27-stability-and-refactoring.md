# 작업 이력: 안정성 개선 및 코드 리팩토링

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 인메모리 캐시 메모리 누수 방지(OrderedDict LRU), WS 엔드포인트 워크플로우 로직 단순화,
프론트엔드 FilePanel 컴포넌트 모듈 분할, 채팅 WS 메시지 레이스 컨디션 수정, 라우트 에러 바운더리 추가,
Zustand 스토어 구독 최적화 등 전반적인 안정성 및 코드 품질 개선.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/permissions.py` - OrderedDict LRU 캐시 적용
- `backend/app/api/v1/endpoints/ws.py` - 워크플로우 상태 해석 로직 서비스로 추출
- `backend/app/repositories/event_repo.py` - SQL interval을 SQLAlchemy timedelta로 변경
- `backend/app/services/claude_runner.py` - 세션 레이트 리미터 LRU 적용
- `backend/app/services/github_service.py` - PR 리뷰 태스크 에러 핸들링 추가
- `backend/app/services/pending_questions.py` - 대기 질문 캐시 LRU 적용
- `backend/app/services/websocket_manager.py` - 관측성 카운터 추가, 임포트 정리

### Frontend

- `frontend/src/components/ui/RouteErrorFallback.tsx` - 라우트 에러 폴백 컴포넌트 (신규)
- `frontend/src/features/files/components/types.ts` - FilePanel 타입 정의 분리 (신규)
- `frontend/src/features/files/components/fileTreeUtils.ts` - 파일 트리 유틸리티 분리 (신규)
- `frontend/src/features/files/components/FileTreeView.tsx` - 트리 뷰 컴포넌트 분리 (신규)
- `frontend/src/features/files/components/FileTreeFolderNode.tsx` - 폴더 노드 컴포넌트 (신규)
- `frontend/src/features/files/components/FileTreeFileNode.tsx` - 파일 노드 컴포넌트 (신규)
- `frontend/src/features/files/components/DiffHoverContent.tsx` - Diff 호버 컴포넌트 (신규)
- `frontend/src/features/files/components/MergedFileChangeItem.tsx` - 병합 파일 항목 컴포넌트 (신규)
- `frontend/src/features/files/components/FilePanel.tsx` - 모듈 분할 후 축소
- `frontend/src/features/chat/hooks/reducers/types.ts` - 레이스 컨디션 방지 상태 추가
- `frontend/src/features/chat/hooks/reducers/index.ts` - 초기 상태에 신규 필드 추가
- `frontend/src/features/chat/hooks/reducers/uiHandlers.ts` - 리셋/트렁케이트 시 신규 필드 처리
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - orphaned tool_result 버퍼링
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - WS 에러 토스트 알림
- `frontend/src/features/chat/components/ChatPanel.tsx` - useShallow 적용
- `frontend/src/routes/__root.tsx` - useShallow 적용
- `frontend/src/routes/analytics.tsx` - errorComponent 추가
- `frontend/src/routes/git-monitor.tsx` - errorComponent 추가
- `frontend/src/routes/knowledge-base.tsx` - errorComponent 추가
- `frontend/src/routes/session/$sessionId.tsx` - errorComponent 추가
- `frontend/src/routes/session/new.tsx` - errorComponent 추가
- `frontend/src/routes/team/$teamId.tsx` - errorComponent 추가
- `frontend/src/routes/team/index.tsx` - errorComponent 추가
- `frontend/src/routes/workflows.tsx` - errorComponent 추가
- `frontend/src/App.tsx` - QueryClient 설정 강화
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - useShallow 적용
- `frontend/src/features/session/components/Sidebar.tsx` - useShallow 적용
- `frontend/src/features/tags/hooks/useTags.ts` - history 쿼리 무효화 추가
- `frontend/src/features/team/hooks/useTeamSocket.ts` - 지수 백오프 재연결
- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - min-w-0 오버플로우 수정
- `frontend/src/features/history/components/HistoryPage.tsx` - useCallback 안정화
- `frontend/src/features/history/components/SessionContextMenu.tsx` - 고정 너비 제거

## 상세 변경 내용

### 1. 백엔드 인메모리 캐시 LRU 제한

- `dict`를 `OrderedDict`로 교체하여 최대 200개 세션까지만 캐시 유지
- permissions, claude_runner, pending_questions 세 곳에 일관 적용
- 장기 운영 시 메모리 누수 방지

### 2. 백엔드 WS 워크플로우 로직 단순화

- ws.py의 복잡한 워크플로우 게이트 로직을 `workflow_service.resolve_workflow_state()`로 추출
- 설정 병합 로직을 `settings_service.merge_session_with_globals()`로 추출
- event_repo의 raw SQL을 SQLAlchemy 표현식으로 변경 (DB 호환성 개선)
- github_service의 PR 리뷰 태스크에 done_callback 에러 핸들링 추가

### 3. 프론트엔드 FilePanel 모듈 분할

- 680줄 모놀리식 FilePanel.tsx를 8개 파일로 분리
- types, utils, 각 컴포넌트를 독립 파일로 추출
- memo() 적용으로 불필요한 리렌더링 방지

### 4. 채팅 WS 메시지 레이스 컨디션 수정

- `_pendingAssistantTextIdx`로 assistant_text 메시지의 정확한 인덱스 추적
- `_orphanedToolResults`로 tool_use보다 먼저 도착한 tool_result 버퍼링
- FIFO 20개 제한으로 메모리 안전성 확보

### 5. 라우트 에러 바운더리

- RouteErrorFallback 공용 컴포넌트 생성
- 8개 라우트에 errorComponent 적용
- 라우트 레벨 에러 발생 시 앱 전체 크래시 방지

### 6. Zustand 스토어 구독 최적화

- 다수의 개별 `useSessionStore` 호출을 `useShallow`로 배칭
- 불필요한 리렌더링 감소
- useTeamSocket에 지수 백오프 재연결 적용
- useTags에 history 쿼리 무효화 추가

## 관련 커밋

- (커밋 후 업데이트 예정)

## 비고

- main 브랜치 직접 커밋 (안정성 패치 및 리팩토링)
