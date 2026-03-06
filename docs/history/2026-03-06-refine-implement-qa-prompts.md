# 작업 이력: Implement/QA 프롬프트 역할 분리

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

시스템 워크플로우(Workflow 1, 2)의 Implement와 QA Review 단계 프롬프트 간 역할이 명확히 구분되지 않고 중복되는 문제를 해결했습니다.

## 변경 파일 목록

### Backend

- `backend/migrations/versions/20260306_0030_refine_implement_qa_prompts.py` - Implement/QA 프롬프트 역할 분리 마이그레이션

## 상세 변경 내용

### 1. Implement 프롬프트에서 검증 결과 보고 제거

- WF1 Implement: "실행된 검증 단계 (빌드, 린트 등)의 최종 결과" 리포트 항목 제거
- WF2 Implement: "빌드/린트 테스트 통과 여부" 리포트 항목 제거
- Implement는 "무엇을 변경했는지"만 보고하도록 역할 한정

### 2. QA 프롬프트를 WF1/WF2 별도 분리

- 기존: 동일한 `_QA_STEP_TEMPLATE`을 양쪽에서 공유
- 변경: `_WF1_QA_PROMPT` (Plan 기준 완성도 검증) / `_WF2_QA_PROMPT` (Research 기준 완성도 검증) 분리
- WF2 QA에서 잘못된 "Plan" 참조 → "Research 분석에서 파악한 문제" 기준으로 수정

### 3. QA에서 빌드/테스트 중복 검증 제거

- 기존 6개 검증항목 중 빌드/컴파일, 테스트 통과, 코드 스타일 3개 제거 (시스템 `run_validation`이 이미 자동 검증)
- 4개 항목으로 축소: 완성도, 코드 품질, 엣지 케이스, 보안
- "독립적인 코드 리뷰어" 역할 프레이밍 추가

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 비고

- 마이그레이션은 read-modify-write 방식으로 기존 `run_validation` 등 필드를 보존
- `parse_qa_checklist()`는 정규식 기반 동적 매칭이므로 항목 수 변경(6→4)에 영향 없음
