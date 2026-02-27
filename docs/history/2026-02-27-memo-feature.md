# 작업 이력: Hey Note 스타일 플로팅 메모 기능 구현

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: worktree-feat-memo

## 변경 요약

Hey Note 스타일의 플로팅 메모 기능을 풀스택으로 구현했습니다.
CodeMirror 6 기반 마크다운 에디터, 무한 블록 구조(Ctrl+Enter로 새 블록), 500ms debounce 자동 저장, Ctrl+M 글로벌 단축키를 지원합니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/models/memo_block.py` - MemoBlock ORM 모델 (id, content, sort_order, timestamps)
- `backend/migrations/versions/20260227_0025_add_memo_blocks.py` - Alembic 마이그레이션
- `backend/app/schemas/memo.py` - Pydantic 요청/응답 스키마 4종
- `backend/app/repositories/memo_block_repo.py` - Repository (sort_order 갭 전략 + 정규화)
- `backend/app/services/memo_service.py` - Service (CRUD + reorder + sort_order 계산)
- `backend/app/api/v1/endpoints/memo.py` - REST API 5개 엔드포인트

### Backend (수정)

- `backend/app/models/__init__.py` - MemoBlock re-export
- `backend/app/api/dependencies.py` - MemoService DI 등록
- `backend/app/api/v1/api.py` - memo 라우터 등록

### Frontend (신규)

- `frontend/src/types/memo.ts` - TypeScript 인터페이스
- `frontend/src/lib/api/memo.api.ts` - API 클라이언트 모듈
- `frontend/src/store/useMemoStore.ts` - Zustand 상태 (isOpen, persist)
- `frontend/src/features/memo/hooks/memoKeys.ts` - Query key factory
- `frontend/src/features/memo/hooks/useMemo.ts` - TanStack Query 훅 5종
- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - CodeMirror 래퍼
- `frontend/src/features/memo/components/MemoBlockItem.tsx` - 블록 컨테이너 (debounce auto-save)
- `frontend/src/features/memo/components/MemoBlockList.tsx` - 블록 리스트 + ScrollArea
- `frontend/src/features/memo/components/MemoPanel.tsx` - 플로팅 패널 (400×600, z-55)

### Frontend (수정)

- `frontend/package.json` - CodeMirror 6 패키지 추가
- `frontend/src/types/index.ts` - memo 타입 re-export
- `frontend/src/store/index.ts` - useMemoStore re-export
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - StickyNote 토글 버튼
- `frontend/src/routes/__root.tsx` - MemoPanel lazy mount
- `frontend/src/features/command-palette/hooks/useGlobalShortcuts.ts` - Ctrl+M 단축키
- `frontend/design-system/tokens/zIndex.ts` - memoPanel: 55

## 상세 변경 내용

### 1. Backend: MemoBlock CRUD API

- `memo_blocks` 테이블: id(PK), content(Text), sort_order(Integer), created_at, updated_at
- sort_order 갭 전략: 1000 간격으로 생성, 갭 소진 시 `_normalize_sort_orders()`로 자동 재배치
- REST 엔드포인트: GET /blocks, POST /blocks, PATCH /blocks/{id}, DELETE /blocks/{id}, PUT /blocks/reorder
- BaseRepository[MemoBlock] 패턴 준수, DBService 상속

### 2. Frontend: CodeMirror 마크다운 에디터

- `@codemirror/view`, `state`, `lang-markdown`, `language`, `language-data`, `commands` 패키지 사용
- CSS 변수 기반 다크 테마 (EditorView.theme)
- Ctrl+Enter → 새 블록 생성 (커스텀 Keymap)
- Ctrl+B stopPropagation → 글로벌 사이드바 토글과 충돌 방지
- 500ms debounce 자동 저장 (useRef 타이머 + unmount flush)

### 3. Frontend: 플로팅 메모 패널

- `fixed bottom-12 right-4 w-[400px] h-[600px]` 위치, z-index: 55 (overlay와 modal 사이)
- React.lazy() + Suspense로 코드 스플릿 (CodeMirror ~500KB)
- Zustand persist로 패널 열림 상태 유지
- 빈 상태 → "첫 메모 블록 만들기" 버튼, 새 블록 생성 시 자동 스크롤 + 포커스

## 관련 커밋

- `Feat: Add 메모 블록 Backend API` - 모델, 마이그레이션, 스키마, Repo, Service, Endpoint
- `Feat: Add 메모 블록 Frontend 기반 구조` - 패키지, 타입, API 클라이언트, Store, Hooks
- `Feat: Add 메모 블록 Frontend 컴포넌트` - CodeMirror 에디터, 블록, 리스트, 패널
- `Feat: Integrate 메모 패널 GlobalTopBar + 단축키` - TopBar 토글, 루트 마운트, Ctrl+M

## 테스트 방법

1. DB 마이그레이션: `alembic upgrade head`
2. 앱 실행 후 상단 TopBar 우측 StickyNote 아이콘 클릭 (또는 Ctrl+M)
3. "첫 메모 블록 만들기" 클릭
4. 마크다운 텍스트 입력 → 500ms 후 자동 저장 확인
5. Ctrl+Enter → 새 블록 생성 확인
6. 블록 hover → 삭제 버튼 동작 확인
7. 패널 닫기 → 재열기 시 이전 메모 유지 확인

## 비고

- CodeMirror 번들 (~500KB gzip ~179KB)은 React.lazy로 분리되어 패널 열 때만 로드
- sort_order 갭 전략은 대부분의 사용 사례에서 추가 쿼리 없이 O(1) 삽입 보장
- Ctrl+B 충돌은 EditorView.domEventHandlers에서 stopPropagation으로 해결 (bubble-phase window listener 차단)
