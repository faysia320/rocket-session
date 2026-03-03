# 작업 이력: 워크플로우 추천 알고리즘 개선 (none 옵션 추가)

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 추천 AI가 비개발 질문(단순 질문, 상태 확인 등)에도 복잡한 워크플로우를 강제 배정하던 문제를 수정했습니다.
"none" 옵션을 도입하여 코드 변경이 필요 없는 요청에는 워크플로우를 비활성화하고 일반 모드로 동작하게 합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/workflow_recommender_service.py` - 시스템 프롬프트 개선 + "none" 응답 처리
- `backend/app/api/v1/endpoints/ws.py` - "none" 추천 시 워크플로우 비활성화 분기 추가

## 상세 변경 내용

### 1. 시스템 프롬프트 개선 (workflow_recommender_service.py)

- 규칙 1(신규): 비개발 요청은 `"none"`으로 응답하도록 명시 + 예시 제공
- 규칙 5(기존 4번): 폴백 전략을 "단계 수가 가장 많은" → "가장 적은"으로 변경
- JSON 응답 형식에 "none" 옵션 포함

### 2. recommend() 메서드 "none" 처리 (workflow_recommender_service.py)

- 유효 ID 검증 전에 `result == "none"` 체크 분기 추가
- "none"은 워크플로우 불필요를 의미하는 특수 값으로 반환

### 3. ws.py _handle_prompt "none" 추천 처리

- `recommended_id == "none"` 분기 추가
- 워크플로우 상태 초기화: `workflow_phase=None`, `workflow_phase_status=None`
- 로컬 변수 초기화: `workflow_phase`, `workflow_service`, `workflow_step_config` = None
- 이후 Phase별 컨텍스트 프롬프트 구성을 건너뛰어 일반 모드로 Claude 실행

## 테스트 방법

1. 워크플로우가 활성화된 세션 생성
2. "이게 뭐야?", "MCP 연결 확인해줘" 같은 비개발 질문 전송
3. 워크플로우가 배정되지 않고 일반 모드로 응답하는지 확인
4. "로그인 기능 구현해줘" 같은 개발 요청 전송
5. 적절한 워크플로우가 자동 추천되는지 확인

## 비고

- 근본 원인: 기존 폴백 규칙이 "판단이 어려우면 가장 복잡한 워크플로우 선택"이었고, "none" 옵션이 없어 모든 요청에 워크플로우가 강제 배정됨
- 프론트엔드 변경 없음: 백엔드에서 워크플로우를 비활성화하면 기존 로직이 자연스럽게 일반 모드로 동작
