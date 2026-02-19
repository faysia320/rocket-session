# 작업 이력: 도구 메시지 전용 컴포넌트 개발

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Claude Code의 도구(tool_use) 메시지 렌더링을 3-Tier 전략으로 개선했습니다. Edit/Write와 Bash는 전용 컴포넌트로 분리하고, Read/Grep/Glob는 기존 범용 컴포넌트 내에서 헤더와 출력을 강화했습니다. 공유 유틸리티를 별도 파일로 추출하여 코드 재사용성을 높였습니다.

## 변경 파일 목록

### Frontend (신규)

- `frontend/src/features/chat/components/toolMessageUtils.ts` - 공유 유틸 (getToolIcon, getToolColor, useElapsed, getLanguageFromPath)
- `frontend/src/features/chat/components/ToolStatusIcon.tsx` - 도구 상태 아이콘 컴포넌트 (✓/✕/spinner)
- `frontend/src/features/chat/components/EditToolMessage.tsx` - Edit/MultiEdit/Write 전용 컴포넌트
- `frontend/src/features/chat/components/BashToolMessage.tsx` - Bash 전용 컴포넌트

### Frontend (수정)

- `frontend/src/features/chat/components/MessageBubble.tsx` - 라우팅 분기 추가 + 공유 유틸 추출 + Read/Grep/Glob 헤더 개선
- `frontend/src/features/chat/utils/chatComputations.ts` - tight 간격 대상 수정 (Todo와 텍스트 메시지 겹침 해소)
- `frontend/src/features/chat/components/ChatInput.tsx` - 입력 영역 높이/패딩 미세 조정

## 상세 변경 내용

### 1. 3-Tier 전략

| Tier | 도구 | 접근 |
|------|------|------|
| Tier 1 (전용 컴포넌트) | Edit/MultiEdit/Write, Bash | 별도 파일 |
| Tier 2 (헤더+출력 강화) | Read, Grep/Glob | ToolUseMessage 내부 분기 |
| Tier 3 (현행 유지) | WebFetch, WebSearch, Task 등 | 범용 JSON 뷰 |

### 2. EditToolMessage

- old_string/new_string을 인라인 diff로 시각화 (삭제=빨강 배경, 추가=초록 배경)
- MultiEdit: edits 배열 순회, 각 edit마다 diff + 구분선
- Write: file_path + content 미리보기 (2000자 truncate)

### 3. BashToolMessage

- command 영역: `$ ` 접두사 + 복사 버튼, description 우선 표시
- output 영역: 터미널 스타일 분리 렌더링
- command/output 시각적 구분 (배경색/border 차별화)

### 4. ToolUseMessage 내부 개선

- Read: output을 CodeBlock 컴포넌트로 렌더링 (파일 확장자 기반 언어 감지)
- Grep: 헤더에 `"pattern" in *.tsx` 형태로 핵심 정보 요약
- Glob: 헤더에 pattern 직접 표시

### 5. 메시지 간격 겹침 해소

- tight 간격 대상을 `tool_use/tool_result/stderr`로 제한
- assistant_text가 tool_use 뒤에 올 때 normal 간격 적용 → Todo와 텍스트 메시지 겹침 해소

## 관련 커밋

- (이 커밋에서 생성)

## 비고

- 공유 유틸 추출로 MessageBubble.tsx 101 라인 감소
- 기존 CodeBlock 컴포넌트 재활용 (Read 출력)
- 기존 DiffViewer는 git unified diff 전용이라 Edit에는 경량 인라인 diff를 직접 구현
