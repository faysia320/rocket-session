# 작업 이력: Phase 1 기능 확장 (템플릿, 분석, 히스토리, 태그, 검색)

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

로드맵 Phase 1에 해당하는 5가지 주요 기능을 구현했습니다:
1. **세션 템플릿**: 시스템 프롬프트 + 허용 도구 + 작업 디렉토리를 프리셋으로 저장/재사용
2. **토큰 분석 대시보드**: 토큰 사용량 통계 및 시각화 (recharts)
3. **세션 히스토리**: 히스토리 페이지 라우트 및 기본 구조
4. **태그 시스템**: 세션 태그 관리 CRUD
5. **전문 검색**: FTS5 기반 세션/메시지 검색

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - DB 스키마 확장 (tags, session_tags, session_templates, sessions_fts 테이블 + 인덱스 + FTS5 트리거 + 템플릿/태그/검색 CRUD 메서드)
- `backend/app/api/dependencies.py` - TemplateService, TagService, SearchService, AnalyticsService DI 등록
- `backend/app/api/v1/api.py` - templates, tags, analytics 라우터 등록
- `backend/app/api/v1/endpoints/sessions.py` - 세션 생성 시 template_id 적용 로직 + 태그/검색 연동
- `backend/app/schemas/session.py` - CreateSessionRequest에 template_id 필드 추가
- `backend/tests/test_api_endpoints.py` - TemplateService DI override 추가
- `backend/app/schemas/template.py` - 템플릿 Pydantic 스키마 (신규)
- `backend/app/schemas/tag.py` - 태그 Pydantic 스키마 (신규)
- `backend/app/schemas/analytics.py` - 분석 Pydantic 스키마 (신규)
- `backend/app/schemas/search.py` - 검색 Pydantic 스키마 (신규)
- `backend/app/services/template_service.py` - 템플릿 CRUD 서비스 (신규)
- `backend/app/services/tag_service.py` - 태그 CRUD 서비스 (신규)
- `backend/app/services/analytics_service.py` - 토큰 분석 서비스 (신규)
- `backend/app/services/search_service.py` - FTS5 검색 서비스 (신규)
- `backend/app/api/v1/endpoints/templates.py` - 템플릿 REST API (신규)
- `backend/app/api/v1/endpoints/tags.py` - 태그 REST API (신규)
- `backend/app/api/v1/endpoints/analytics.py` - 분석 REST API (신규)

### Frontend

- `frontend/package.json` - recharts 의존성 추가
- `frontend/pnpm-lock.yaml` - lockfile 업데이트
- `frontend/src/types/index.ts` - template, tag, analytics 타입 re-export
- `frontend/src/types/session.ts` - CreateSessionRequest에 template_id 추가
- `frontend/src/types/template.ts` - 템플릿 TypeScript 타입 (신규)
- `frontend/src/types/tag.ts` - 태그 TypeScript 타입 (신규)
- `frontend/src/types/analytics.ts` - 분석 TypeScript 타입 (신규)
- `frontend/src/lib/api/sessions.api.ts` - create에 template_id 옵션 추가
- `frontend/src/lib/api/templates.api.ts` - 템플릿 API 클라이언트 (신규)
- `frontend/src/lib/api/tags.api.ts` - 태그 API 클라이언트 (신규)
- `frontend/src/lib/api/analytics.api.ts` - 분석 API 클라이언트 (신규)
- `frontend/src/features/template/` - 템플릿 컴포넌트 + 훅 (신규 디렉토리)
- `frontend/src/features/analytics/` - 분석 대시보드 컴포넌트 (신규 디렉토리)
- `frontend/src/features/tags/` - 태그 관리 컴포넌트 (신규 디렉토리)
- `frontend/src/features/history/` - 히스토리 컴포넌트 (신규 디렉토리)
- `frontend/src/routes/history.tsx` - 히스토리 라우트 (신규)
- `frontend/src/routeTree.gen.ts` - /history 라우트 자동 생성
- `frontend/src/routes/__root.tsx` - AnalyticsDashboard lazy import + costView 연동
- `frontend/src/store/useSessionStore.ts` - costView 상태 + 토글 액션 추가
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - TemplateSelector 통합
- `frontend/src/features/session/components/SessionSettings.tsx` - SaveAsTemplateDialog 버튼 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 템플릿/히스토리 버튼 + costView 토글
- `frontend/src/features/session/hooks/useSessions.ts` - template_id 옵션 추가
- `frontend/src/features/command-palette/commands/ui.ts` - 토큰 분석 뷰 전환 명령 추가
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - toggleCostView 연동
- `frontend/src/features/git-monitor/components/GitMonitorPanel.tsx` - UI 개선
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` - UI 개선

## 상세 변경 내용

### 1. 세션 템플릿 기능

- DB에 `session_templates` 테이블 추가 (이름, 설명, 모든 세션 설정 필드)
- REST API 8개 엔드포인트 (CRUD + from-session + export/import)
- 세션 생성 시 template_id로 설정 자동 적용 (우선순위: 요청값 > 템플릿값 > 전역설정)
- Frontend: TemplateSelector 드롭다운, TemplateListDialog 관리 UI, SaveAsTemplateDialog

### 2. 토큰 분석 대시보드

- messages 테이블에 토큰 관련 컬럼 추가 (input_tokens, output_tokens, cache_*)
- AnalyticsService: 기간별 토큰 요약, 일별 사용량, 세션별 랭킹, 프로젝트별 분석
- Frontend: recharts 기반 AnalyticsDashboard + Sidebar costView 토글

### 3. 태그 시스템

- tags + session_tags 테이블 (다대다 관계)
- TagService: 태그 CRUD + 세션-태그 연결 관리
- sessions 엔드포인트에 태그 필터링 통합

### 4. 전문 검색

- FTS5 가상 테이블 (sessions_fts) + 자동 인덱싱 트리거
- SearchService: 세션 이름/메시지 내용 전문 검색 + 페이지네이션

### 5. UI 개선

- Git Monitor 패널/섹션 UI 개선
- Command Palette에 토큰 분석 뷰 전환 명령 추가
- Dashboard 레이아웃 비율 변경 (세션 40% / Git Monitor 60%)

## 테스트 방법

1. Backend: `cd backend && uv run pytest` (166 tests passed)
2. Frontend: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` + `npx vite build`
3. 세션 생성 화면에서 템플릿 선택 후 설정 자동 채움 확인
4. 세션 설정 Sheet에서 "템플릿으로 저장" 버튼 동작 확인
5. Sidebar 템플릿 아이콘으로 관리 다이얼로그 진입

## 비고

- Phase 1 로드맵의 세션 템플릿, 비용 대시보드, 세션 히스토리 3대 기능이 포함됨
- 추가로 태그 시스템, 전문 검색 기반도 함께 구축
