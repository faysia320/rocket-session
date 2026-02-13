# 작업 이력: 세션 영속성 + 세션별 설정 + 파일 조회 기능 추가

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

서버 재시작 시 세션/히스토리가 소실되는 문제를 해결하기 위해 SQLite 기반 영속성을 구현하고,
세션별 도구/프롬프트/타임아웃 설정 기능과 파일 내용 조회 기능을 추가했습니다.

## 변경 파일 목록

### Backend (수정)

- `backend/pyproject.toml` - aiosqlite 의존성 추가
- `backend/app/core/config.py` - database_path 설정 추가
- `backend/app/models/session.py` - 인메모리 Session 클래스 → SessionStatus 열거형만 유지
- `backend/app/services/session_manager.py` - dict 인메모리 → SQLite CRUD 기반 리팩토링
- `backend/app/services/claude_runner.py` - DB 연동, 시스템 프롬프트, 타임아웃 지원
- `backend/app/api/dependencies.py` - Database DI + init/shutdown 라이프사이클
- `backend/app/main.py` - lifespan 컨텍스트 매니저 적용
- `backend/app/schemas/session.py` - 설정 필드 + UpdateSessionRequest 추가
- `backend/app/api/v1/endpoints/sessions.py` - 전체 async 전환 + PATCH 엔드포인트
- `backend/app/api/v1/endpoints/ws.py` - DB 히스토리 로드/저장 + allowed_tools 우선순위
- `backend/app/api/v1/api.py` - files 라우터 등록

### Backend (신규)

- `backend/app/core/database.py` - SQLite 연결 관리 + 테이블 스키마 + CRUD 메서드
- `backend/app/api/v1/endpoints/files.py` - 파일 내용 조회 API (path traversal 방지)

### Frontend (수정)

- `frontend/src/types/session.ts` - allowed_tools, system_prompt, timeout_seconds 필드 추가
- `frontend/src/types/index.ts` - UpdateSessionRequest export 추가
- `frontend/src/lib/api/client.ts` - getText(), patch() 메서드 추가
- `frontend/src/lib/api/sessions.api.ts` - update(), fileContent() API 함수 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 고급 설정 토글 (시스템 프롬프트, 타임아웃)
- `frontend/src/features/session/hooks/useSessions.ts` - createSession 시그니처 확장
- `frontend/src/features/chat/components/ChatPanel.tsx` - 설정 아이콘 추가
- `frontend/src/features/files/components/FilePanel.tsx` - 파일 클릭 이벤트 추가
- `frontend/src/routes/session/$sessionId.tsx` - FileViewer 연동
- `frontend/components.json` - aliases를 @/ prefix로 수정

### Frontend (신규)

- `frontend/src/features/session/components/SessionSettings.tsx` - Sheet 기반 세션 설정 패널
- `frontend/src/features/files/components/FileViewer.tsx` - 파일 내용 뷰어 컴포넌트
- `frontend/src/components/ui/{dialog,checkbox,label,tabs,sheet}.tsx` - shadcn/ui 컴포넌트

## 상세 변경 내용

### 1. 세션 영속성 (Phase 1)

- SQLite (aiosqlite) 기반 비동기 데이터베이스 모듈 구현
- sessions, messages, file_changes 3개 테이블 스키마
- WAL 모드 + FOREIGN KEY CASCADE 삭제 지원
- SessionManager를 dict 기반에서 SQLite CRUD로 완전 리팩토링
- 프로세스 핸들만 인메모리 유지 (DB에 저장 불가)
- FastAPI lifespan으로 DB 초기화/정리 라이프사이클 관리

### 2. 세션별 설정 (Phase 2)

- 세션 생성 시 allowed_tools, system_prompt, timeout_seconds 지정 가능
- PATCH /api/sessions/{id} 엔드포인트로 기존 세션 설정 수정
- ClaudeRunner에서 --system-prompt 플래그 및 asyncio.wait_for 타임아웃 적용
- allowed_tools 우선순위: 요청 > 세션 설정 > 전역 설정
- 프론트엔드 Sheet 기반 설정 패널 (도구 체크박스, 프롬프트 텍스트 영역, 타임아웃 입력)

### 3. 파일 내용 조회 (Phase 3)

- GET /api/sessions/{id}/file-content/{path} 엔드포인트
- Path traversal 공격 방지 (work_dir 하위 경로만 허용)
- 파일 크기 제한 (1MB), 바이너리 파일 거부
- FileViewer 컴포넌트: 코드 표시, 도구 배지, 로딩/에러 상태
- FilePanel에서 파일 클릭 시 FileViewer로 연결

## 테스트 방법

### 백엔드 검증
```bash
cd backend
uv run python -c "from app.main import app; print('OK')"
```

### 프론트엔드 검증
```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit
pnpm build
```

### 영속성 확인
1. 서버 시작 → 세션 생성 → 프롬프트 전송
2. 서버 재시작
3. 세션 및 히스토리가 유지되는지 확인

## 비고

- DB 파일은 `backend/data/sessions.db`에 생성됨 (.gitignore에 추가)
- shadcn/ui components.json의 aliases가 `src/` 대신 `@/` prefix를 사용하도록 수정 (빌드 실패 방지)
