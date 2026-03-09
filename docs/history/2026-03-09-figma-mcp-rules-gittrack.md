# 작업 이력: Figma MCP 규칙 추가 및 .claude 이력 관리

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Figma MCP 토큰 초과 오류 방지를 위한 Claude 규칙 파일을 추가하고, `.claude/` 디렉토리를 Git 이력 관리 대상으로 변경했습니다.

## 변경 파일 목록

### 프로젝트 설정

- `.gitignore` - `/.claude` 전체 무시 → 로컬 전용 파일만 개별 무시로 변경
- `.claude/rules/figma-mcp.md` - Figma MCP 점진적 조회 규칙 추가

## 상세 변경 내용

### 1. Figma MCP 규칙 파일 추가

- Figma MCP(`get_figma_data`) 호출 시 토큰 제한 초과 방지를 위한 3단계 점진적 조회 워크플로우 규칙
- 1단계: `depth=1`로 구조 파악 → 2단계: `nodeId`로 특정 노드 조회 → 3단계: 이미지 다운로드
- 토큰 초과 시 Fallback 전략 (nodeId+depth 조합, 분할 조회, 이미지 전환)

### 2. .gitignore 수정

- `/.claude` 전체 무시 제거
- `.claude/settings.local.json`, `.claude/worktrees/`만 개별 무시
- `rules/`, `skills/` 등 프로젝트 공유 설정은 이력 관리 대상으로 편입

## 비고

- `.claude/rules/*.md` 파일은 Claude Code 세션 시작 시 자동 로드됨
- `smart-report` 프로젝트에도 동일한 규칙 파일 생성 완료 (별도 커밋 대상)
