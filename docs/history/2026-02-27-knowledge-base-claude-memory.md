# 작업 이력: Knowledge Base → Claude Code Memory 통합

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base의 AI 기반 키워드 추출 기능을 전면 제거하고, 대신 Claude Code가 자동으로 관리하는 Memory 파일들(Auto Memory, CLAUDE.md, Rules)을 직접 읽어 표시하도록 전환했습니다. Knowledge Base를 세션 사이드바 하위에서 독립 GNB 메뉴로 승격시키고, ERR_CONNECTION_REFUSED 버그를 수정했습니다.

## 변경 파일 목록

### Backend - 키워드 추출 제거

- `backend/app/services/insight_service.py` - extract_from_session, build_context_for_session 및 모든 키워드 상수/헬퍼 제거 (345줄 → ~88줄)
- `backend/app/api/v1/endpoints/insights.py` - extract, context 엔드포인트 제거
- `backend/app/schemas/workspace_insight.py` - ExtractInsightsRequest, InsightContextResponse 스키마 제거
- `backend/app/repositories/workspace_insight_repo.py` - search_by_keywords, bulk_create 메서드 제거
- `backend/app/services/claude_runner.py` - 세션 완료 후 인사이트 추출 블록 제거
- `backend/app/models/event_types.py` - INSIGHT_EXTRACTED 이벤트 타입 제거

### Backend - Claude Memory 서비스 추가

- `backend/app/services/claude_memory_service.py` - **신규** Claude Code Memory 파일 읽기 서비스 (Path Traversal 방지 포함)
- `backend/app/schemas/claude_memory.py` - **신규** MemoryFileInfo, MemoryFileContent, MemoryContextResponse 스키마
- `backend/app/api/v1/endpoints/memory.py` - **신규** Memory REST 엔드포인트 (files, context)
- `backend/app/api/v1/api.py` - memory 라우터 등록
- `backend/app/api/dependencies.py` - ClaudeMemoryService DI 등록, ContextBuilderService 의존성 변경
- `backend/app/services/context_builder_service.py` - InsightService → ClaudeMemoryService 전환
- `backend/app/schemas/context.py` - insights → memory_files 필드 변경

### Frontend - 추출 코드 제거 + Memory UI

- `frontend/src/types/claude-memory.ts` - **신규** Memory 관련 TypeScript 타입
- `frontend/src/lib/api/memory.api.ts` - **신규** Memory API 클라이언트
- `frontend/src/features/knowledge/hooks/useMemory.ts` - **신규** React Query 훅
- `frontend/src/features/knowledge/components/KnowledgeBasePanel.tsx` - Memory/Insights 탭 구조 추가
- `frontend/src/features/context/components/ContextSuggestionPanel.tsx` - insights → memory_files 표시
- `frontend/src/lib/api/insights.api.ts` - extract, context 메서드 제거 + trailing slash 수정
- `frontend/src/features/knowledge/hooks/useInsights.ts` - useExtractInsights, useInsightContext 제거
- `frontend/src/features/knowledge/hooks/insightKeys.ts` - context 쿼리 키 제거
- `frontend/src/types/knowledge.ts` - ExtractInsightsRequest, InsightContextResponse 제거
- `frontend/src/types/ws-events.ts` - WsInsightExtractedEvent 제거
- `frontend/src/types/index.ts` - 타입 내보내기 갱신
- `frontend/src/lib/api/context.api.ts` - insights → memory_files 필드 변경

### Frontend - 네비게이션 변경

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Knowledge 메뉴 추가
- `frontend/src/features/session/components/Sidebar.tsx` - KB 툴팁 버튼 제거

## 상세 변경 내용

### 1. 키워드 추출 시스템 완전 제거

AI 기반 키워드 추출(패턴, 결정, 주의사항 분류)을 제거했습니다. 추출 로직은 정확도가 낮고, Claude Code가 이미 자체적으로 Memory 파일을 관리하고 있어 중복이었습니다. insight_service.py에서 345줄의 추출 코드를 삭제하고 기본 CRUD만 유지합니다.

### 2. Claude Code Memory 서비스

`ClaudeMemoryService`는 세 가지 소스의 Memory 파일을 읽습니다:
- **Auto Memory**: `~/.claude/projects/<encoded-path>/memory/*.md`
- **CLAUDE.md**: 프로젝트 루트의 `claude.md`, `CLAUDE.md`, `.claude/CLAUDE.md`
- **Rules**: `.claude/rules/*.md`

경로 인코딩: `local_path.replace("\\","/").replace(":/","--").replace("/","-")`

### 3. 보안 강화 (QA 후속 수정)

- **Path Traversal 방지**: `_is_within()` + `.resolve().relative_to()` 경계 검증
- **빈 local_path guard**: 모든 public 메서드에서 빈 값 → 빈 결과 반환
- **에러 메시지 정보 노출 제거**: 사용자 입력 file_path를 에러 메시지에서 제외

### 4. ERR_CONNECTION_REFUSED 수정

FastAPI의 `redirect_slashes=True`가 307 리다이렉트를 발생시켜 Vite 프록시를 우회하는 문제. insights.api.ts의 API URL에 trailing slash를 추가하여 수정.

### 5. Knowledge Base 독립 메뉴 승격

Sidebar 하단 툴팁 → GlobalTopBar NAV_ITEMS로 이동하여 독립적인 1차 메뉴로 승격.

## 테스트 방법

1. Backend import 검증: `python -c "from app.services.claude_memory_service import ClaudeMemoryService"`
2. Frontend 빌드: `pnpm build` (성공 확인)
3. Path Traversal 차단: `GET /api/workspaces/{id}/memory/files/rules/../../etc/passwd` → 404
4. 빈 local_path: 워크스페이스에 local_path가 없으면 빈 목록 반환

## 비고

- 기존 Insights CRUD(수동 생성/편집/삭제)는 그대로 유지됨
- KnowledgeBasePanel에서 Memory 탭과 Insights 탭으로 분리하여 양쪽 모두 접근 가능
