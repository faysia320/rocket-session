# 작업 이력: KB 시스템 안정성·성능·구조·UX 22항목 종합 개선

- **날짜**: 2026-03-02
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base 시스템의 안정성(S1-S5), 성능(P1-P5), 구조(T1-T6), UI/UX(U1-U7) 총 22개 항목을 종합적으로 개선했습니다. 백엔드 서비스 레이어에서는 소스 상수 통합, 배치 파일 읽기, 병렬 I/O 실행, 캐시 협조 무효화를 구현하고, API 레이어에서는 에러 핸들링과 입력 검증을 강화했습니다. 프론트엔드에서는 에러 상태 표시, 접근성(ARIA), 세션 이동, 스코어 시각화 등 UX를 전면 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_memory_service.py` — 소스 상수 도입, 배치 파일 읽기, 캐시 무효화 로깅
- `backend/app/services/context_builder_service.py` — asyncio.gather 병렬 실행, Pydantic 반환 타입, 캐시 협조 무효화
- `backend/app/api/v1/endpoints/context.py` — 에러 핸들링, 워크스페이스 존재 검증, prompt max_length 제한
- `backend/app/api/v1/endpoints/ws.py` — KB 주입 실패 로깅 레벨 debug → warning 상향
- `backend/app/models/file_change.py` — GROUP BY 최적화 복합 인덱스 추가
- `backend/tests/test_claude_memory_service.py` — 미사용 import 제거 (lint fix)
- `backend/tests/test_context_builder_service.py` — 14개 테스트 추가 (캐시, 상수, 배치, 병렬)

### Frontend

- `frontend/src/features/context/components/ContextSuggestionPanel.tsx` — 에러 상태, ARIA, 툴팁, 스코어 바, 세션 이동
- `frontend/src/features/context/hooks/useContextSuggestion.ts` — keepPreviousData 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` — 파일변경→캐시무효화, 세션클릭핸들러

## 상세 변경 내용

### 안정성 (S1-S5)

| 항목 | 내용 |
|------|------|
| S1 | 파일 변경 WebSocket 이벤트 수신 시 `contextKeys.all` 캐시 무효화 |
| S2 | context API 3개 엔드포인트에 try/except + HTTPException + logger.exception 추가 |
| S3 | ContextSuggestionPanel에 isError 감지 + 에러 UI + 재시도 버튼 |
| S4 | ContextBuilderService.invalidate_caches()에서 ClaudeMemoryService.invalidate_cache() 연쇄 호출 |
| S5 | prompt 파라미터 Query(max_length=1000), 워크스페이스 존재 404 검증 |

### 성능 (P1-P5)

| 항목 | 내용 |
|------|------|
| P1 | FileChange 모델에 `idx_file_changes_session_file` 복합 인덱스 추가 |
| P2 | build_full_context에서 memory, sessions, files를 asyncio.gather로 병렬 실행 |
| P3 | _read_multiple_files_sync로 단일 asyncio.to_thread 호출에서 N개 파일 일괄 읽기 |
| P4 | buildContextText를 useCallback → useMemo로 변경 (값 직접 계산) |
| P5 | API prompt 파라미터 max_length=1000으로 과도한 키워드 추출 방지 |

### 구조 (T1-T6)

| 항목 | 내용 |
|------|------|
| T1 | SOURCE_AUTO_MEMORY 등 4개 모듈 레벨 상수 + PREFIX_TO_SOURCE 매핑 도입 |
| T2 | N/A — 프로젝트에 인증 시스템 미적용 (로컬 전용) |
| T3 | KB 주입 실패 로깅을 debug → warning(exc_info=True)로 상향 |
| T4 | 14개 테스트 추가 (390 → 404개), 5개 새 테스트 클래스 |
| T5 | build_full_context 반환 타입을 dict → SessionContextSuggestion(Pydantic)으로 변경 |
| T6 | PREFIX_TO_SOURCE 단일 딕셔너리로 소스 문자열 매핑 통합 |

### UI/UX (U1-U7)

| 항목 | 내용 |
|------|------|
| U1 | 에러 상태 시 경고 메시지 + 재시도 버튼 (RefreshCw 아이콘) |
| U2 | 실제 항목이 있을 때만 auto-expand (빈 데이터 시 축소 유지) |
| U3 | "Auto-injected" 뱃지에 Radix Tooltip — system_prompt 자동 주입 설명 |
| U4 | role="region", role="group", aria-expanded, aria-controls, aria-label 전면 적용 |
| U5 | 선택된 파일 수 뱃지 (Check 아이콘 + "N selected") |
| U6 | Recent Sessions 항목을 클릭 가능 버튼으로 변경 → 세션 이동 |
| U7 | 파일 제안 스코어를 퍼센트 바로 시각화 (bg-primary/60) |

## 관련 커밋

- `(TBD)` — Refactor: KB 서비스 소스 상수·배치 읽기·병렬 실행·캐시 협조 개선
- `(TBD)` — Feat: 컨텍스트 API 에러 핸들링 및 입력 검증 강화
- `(TBD)` — Test: KB 서비스 테스트 14개 추가
- `(TBD)` — Feat: ContextSuggestionPanel UI/UX 및 안정성 전면 개선

## 테스트 결과

- 백엔드 테스트: 404개 전체 통과 (14개 신규)
- TypeScript: clean
- 프로덕션 빌드: 성공 (17.33s)
- Ruff lint: clean
- ESLint: 0 error, 1 pre-existing warning

## 비고

- T2(인증 미들웨어)는 프로젝트가 로컬 전용 앱으로 인증 시스템이 없어 N/A 처리
- ESLint warning 1건은 기존 set-state-in-effect로, useRef 가드가 적용되어 문제 없음
