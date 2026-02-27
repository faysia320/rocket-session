# 작업 이력: Serena MCP 2계층 아키텍처 구현

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

claude.md와 Serena 메모리를 2계층 정보 아키텍처로 분리하여, claude.md는 핵심 규칙/패턴만 유지하고 상세 참조 데이터는 Serena 메모리로 이동했습니다.
기존 잘못된 Serena 메모리(다른 프로젝트 데이터 오염) 6개를 삭제하고, 정확한 메모리 5개를 새로 생성했습니다.

## 변경 파일 목록

### 설정

- `.serena/project.yml` - ignored_paths 5개 추가, initial_prompt에 2계층 가이드 설정
- `claude.md` - 1,065줄 → 543줄 슬림화 (8개 섹션을 Serena 메모리 포인터로 교체)

## 상세 변경 내용

### 1. 잘못된 Serena 메모리 6개 삭제

다른 프로젝트(Aleatorik UI / Vue 3)의 데이터로 오염된 메모리 삭제:
- `project_overview`, `code_style_conventions`, `path_aliases`
- `suggested_commands`, `task_completion_checklist`, `frontend_architecture_analysis`

### 2. 새 Serena 메모리 5개 생성

claude.md에서 추출한 상세 참조 데이터:
- `project_structure` — 전체 디렉토리 트리
- `database_schema` — DB 테이블 16개 전체 정의
- `service_architecture` — 서비스 25개 + DI + 환경변수
- `frontend_design_system` — Deep Space 테마 + 디자인 토큰
- `new_feature_checklist` — 백엔드/프론트엔드 개발 체크리스트

### 3. claude.md 슬림화

8개 섹션을 Serena 메모리 포인터로 교체:
- §3 프로젝트 구조 (221줄 → 25줄)
- §4 서비스 테이블 (31줄 → 3줄)
- §6.2 Deep Space 테마 (18줄 → 2줄)
- §6.9 디자인 시스템 참조 (10줄 → 2줄)
- §7.1 DI 프로바이더 (23줄 → 3줄)
- §7.3 환경 설정 (15줄 → 1줄)
- §10 DB 스키마 (234줄 → 3줄)
- §11 개발 체크리스트 (25줄 → 1줄)

### 4. project.yml 설정

- `ignored_paths`: dist, node_modules, .venv, pkl, work-logs 제외
- `initial_prompt`: 2계층 구조 설명 + 메모리 카탈로그 + 충돌 시 우선순위 규칙

## 비고

- 2계층 구조: Layer 1(claude.md) = 규칙/패턴(항상 로드) / Layer 2(Serena 메모리) = 참조 데이터(선택적 로드)
- `workflow_refresh_bug_analysis` 메모리는 정확한 정보이므로 유지
