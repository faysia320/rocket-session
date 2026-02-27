# 작업 이력: 명령 팔레트 Knowledge Base 커맨드 추가

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Knowledge Base가 GNB 독립 메뉴로 승격(commit `8b6849a`)된 이후, 명령 팔레트에 해당 내비게이션 커맨드가 누락되어 있었음. GNB와 명령 팔레트 간의 일관성을 맞추기 위해 Knowledge Base 관련 항목을 추가.

## 변경 파일 목록

### Frontend

- `frontend/src/features/command-palette/types.ts` - RouteZone 타입에 "knowledge-base" 추가
- `frontend/src/features/command-palette/registry.ts` - resolveRouteZone()에 /knowledge-base 경로 매핑 추가
- `frontend/src/features/command-palette/commands/navigation.ts` - nav:knowledge-base 커맨드 추가

## 상세 변경 내용

### 1. RouteZone 타입 확장 (types.ts)

- `RouteZone` 유니온 타입에 `"knowledge-base"` 멤버 추가
- 명령 팔레트의 context 기반 필터링에서 Knowledge Base 페이지를 인식할 수 있도록 함

### 2. 경로 매핑 추가 (registry.ts)

- `resolveRouteZone()` 함수에 `"/knowledge-base" → "knowledge-base"` 매핑 추가
- 이전에는 `/knowledge-base` 경로가 기본값 `"home"`으로 폴백되었음

### 3. 내비게이션 커맨드 추가 (navigation.ts)

- `BookOpen` 아이콘 import 추가 (GNB에서 사용하는 아이콘과 동일)
- `nav:knowledge-base` 커맨드를 staticCommands 배열에 삽입 (workflows 다음, new-session 이전)
- 검색 키워드: knowledge, 지식, memory, 메모리, claude, 규칙, rules

## 테스트 방법

1. `Cmd+K`로 명령 팔레트를 열고 "knowledge", "지식", "메모리" 등으로 검색
2. Knowledge Base 커맨드가 내비게이션 카테고리에 표시되는지 확인
3. 선택 시 `/knowledge-base` 페이지로 이동하는지 확인
