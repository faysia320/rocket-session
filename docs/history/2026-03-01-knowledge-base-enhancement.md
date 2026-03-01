# 작업 이력: Knowledge Base 기능 고도화

- **날짜**: 2026-03-01
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base가 읽기 전용 대시보드에서 실제 세션에 컨텍스트를 주입하는 활성 시스템으로 고도화되었습니다. 6개 Enhancement를 구현하여 Insight 편집, 세션 KB 자동 주입, 인메모리 캐싱, 검색/필터, ContextSuggestionPanel 활성화, 테스트 추가를 완료했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_memory_service.py` - 상수 추출, 소스 우선순위 정렬, TTL 캐싱, limit 기본값 변경
- `backend/app/services/context_builder_service.py` - build_memory_context 호출 시 limit=5 하드코딩 제거
- `backend/app/api/v1/endpoints/ws.py` - _handle_prompt()에 KB 컨텍스트 자동 주입 블록 추가
- `backend/tests/test_claude_memory_service.py` - ClaudeMemoryService 유닛 테스트 35건
- `backend/tests/test_context_builder_service.py` - ContextBuilderService 유닛 테스트 12건

### Frontend

- `frontend/src/features/knowledge/components/InsightCreateDialog.tsx` - 편집 모드 지원 (initialData prop, 동적 제목/버튼)
- `frontend/src/features/knowledge/components/KnowledgeContent.tsx` - Insight 편집 연결, 검색바, 소스 필터 칩
- `frontend/src/features/chat/components/ChatPanel.tsx` - ContextSuggestionPanel 마운트, 컨텍스트 프리픽스 주입

## 상세 변경 내용

### 1. Insight 편집 기능 완성 (E1)

- InsightCreateDialog에 `initialData` prop 추가, useEffect로 편집 모드 필드 프리필
- KnowledgeContent에서 editingInsight 상태 관리, InsightCard의 onEdit과 연결
- 다이얼로그 제목 "Edit Insight" / "New Insight" 동적 전환

### 2. 세션 KB 컨텍스트 자동 주입 (E2, 핵심)

- ws.py의 _handle_prompt()에서 팀 컨텍스트 주입 후 KB 컨텍스트를 `<knowledge_base>` 태그로 system_prompt에 append
- current_session의 work_dir을 사용하여 ClaudeMemoryService.build_memory_context() 호출
- 실패 시 graceful degradation (debug 로그만 기록)

### 3. ClaudeMemoryService 인메모리 캐싱 (E3)

- TTL 60초 기반 dict 캐시 구현 (_get_cached, _set_cached, invalidate_cache)
- list_memory_files()에 캐시 체크 적용
- 워크스페이스별 또는 전체 캐시 무효화 지원

### 4. Knowledge Base 검색/필터 (E4)

- 검색 Input: Memory 탭에서 파일명, Insights 탭에서 제목/내용/태그 필터링
- Memory 소스 필터: Auto/Project/Rules/Serena 토글 칩 (다중 선택)
- 순수 클라이언트 사이드 필터링

### 5. ContextSuggestionPanel 활성화 (E5)

- 새 세션(메시지 0건 + workspace_id 존재)에서 ChatInput 위에 패널 렌더링
- 사용자가 Memory 파일/파일 제안을 체크하면 컨텍스트 텍스트 생성
- 첫 프롬프트 전송 시 `<context>` 블록으로 prefix 삽입 후 자동 소멸

### 6. 서비스 테스트 추가 (E6)

- ClaudeMemoryService: 경로 인코딩, 4소스 목록, 읽기, Path Traversal 방지, 컨텍스트 빌드, 캐싱 (35건)
- ContextBuilderService: 키워드 추출, 불용어 처리, 전체 컨텍스트 조합 (12건)

## 테스트 결과

- Backend: 390 passed (기존 343 + 신규 47)
- Frontend: pnpm build 성공
