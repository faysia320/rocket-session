# 작업 이력: Knowledge Base 2분할 레이아웃 + Serena Memory 통합

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base 메뉴를 Git Monitor/Workflows와 동일한 좌우 2분할 레이아웃으로 리팩토링하고,
`.serena/memories/` 파일들을 Memory 소스로 추가하여 Knowledge Base에서 조회할 수 있도록 했다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/claude_memory.py` - `MemorySource` Literal에 `"serena_memory"` 추가
- `backend/app/services/claude_memory_service.py` - Serena 메모리 탐색/읽기/경로 해석 로직 추가

### Frontend

- `frontend/src/types/claude-memory.ts` - `MemorySource` 타입에 `"serena_memory"` 추가
- `frontend/src/features/knowledge/components/KnowledgeWorkspaceList.tsx` - (신규) 좌측 워크스페이스 사이드바
- `frontend/src/features/knowledge/components/KnowledgeContent.tsx` - (신규) 우측 Memory/Insights 콘텐츠 패널
- `frontend/src/features/knowledge/components/KnowledgeBasePanel.tsx` - 319줄 → 101줄 오케스트레이터로 리팩토링

## 상세 변경 내용

### 1. 좌우 2분할 레이아웃 (항목 1)

- 기존 단일 패널 + Select 드롭다운 방식에서 Git Monitor와 동일한 2분할 패턴으로 변경
- 좌측: `KnowledgeWorkspaceList` (w-60 사이드바, border-l-2 선택 표시자)
- 우측: `KnowledgeContent` (Memory/Insights 탭 + 콘텐츠)
- `KnowledgeBasePanel`은 오케스트레이터 역할만 담당하도록 축소
- `useIsMobile()` 반응형: 모바일에서 좌측 패널 숨기고 Select 드롭다운 대체

### 2. Insights 출처 확인 (항목 2)

- 코드 변경 없음 — 자동 생성 로직은 미구현 상태
- `InsightService`는 수동 CRUD만 제공
- 50여 개 insights는 수동/API 생성 또는 시딩 스크립트로 생성된 것으로 확인

### 3. Serena Memory 소스 추가 (항목 3)

- 백엔드 `ClaudeMemoryService`에 4번째 소스 추가: `.serena/memories/*.md`
- `list_memory_files()`: Serena 메모리 디렉토리 탐색 블록 추가
- `read_memory_file()`: `source_map`에 `"serena-memory"` → `"serena_memory"` 매핑
- `_resolve_path()`: `serena-memory` prefix 경로 해석 + path traversal 방지
- 프론트엔드: `Database` 아이콘, "Serena Memory" 라벨, "Serena" 배지 표시

## 관련 커밋

- 백엔드: Serena Memory 소스를 Knowledge Base에 통합
- 프론트엔드: Knowledge Base 2분할 레이아웃 리팩토링 + Serena Memory 표시

## 테스트 방법

1. Knowledge Base 메뉴 진입 → 좌측 워크스페이스 목록 + 우측 Memory/Insights 표시 확인
2. 워크스페이스 선택 → Memory 탭에 Serena Memory 배지가 달린 파일 6개 표시 확인
3. 파일 클릭 → 내용 정상 표시, "Back to file list" 동작 확인
4. Insights 탭 → 기존 기능 동작 확인

## 비고

- API 엔드포인트, hooks, DB 변경 없음 — 기존 제네릭 구조가 자동으로 새 소스 지원
- `ContextBuilderService`의 `limit=5` 제한으로 Serena 파일이 컨텍스트에서 잘릴 수 있음 (이번 범위 외)
