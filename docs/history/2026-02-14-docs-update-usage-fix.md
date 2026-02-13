# 작업 이력: 문서 최신화 + 사용량 파싱 수정

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프로젝트 문서(README.md, CLAUDE.md)를 현재 코드베이스에 맞게 전면 최신화하고,
사용량 추적(UsageService)의 ccusage 파싱 버그를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/usage_service.py` - ccusage blocks/weekly 파싱 로직 수정

### Docs

- `README.md` - 전면 재작성 (한국어, 현재 기능/구조 반영)
- `claude.md` (CLAUDE.md) - 프로젝트 개요, 구조, 아키텍처, 서비스, DB 스키마 등 최신화

## 상세 변경 내용

### 1. 사용량 파싱 버그 수정 (usage_service.py)

**문제**: ccusage CLI 응답에서 잘못된 항목을 참조하여 사용량이 제대로 표시되지 않음
- blocks: `data[0]` (가장 오래된 블록)을 참조 → 활성 블록 또는 최신 블록을 찾도록 수정
- weekly: `weekly[0]` (가장 오래된 주)을 참조 → `weekly[-1]` (현재 주)로 수정
- weekly 비용 필드명: `costUSD` → `totalCost`로 수정 (실제 응답 구조에 맞게)
- burnRate: 단순 정수 → dict에서 `costPerHour` 추출
- time_remaining: `projection.remainingMinutes`에서 추출

### 2. README.md 전면 재작성

- 영문 → 한국어 전환
- 아키텍처 다이어그램에 SQLite 레이어 추가
- 12개 주요 기능 목록 추가 (Plan Mode, Permission Mode, 사용량 추적 등)
- API 엔드포인트 전체 목록 테이블
- 프로젝트 구조 갱신 (7개 endpoints, 4개 schemas, 7개 services)
- Docker 실행 가이드 추가

### 3. CLAUDE.md 최신화

- 섹션 1: 주요 기능 목록 확장
- 섹션 2: SQLite, python-multipart, ccusage 외부 의존성 추가
- 섹션 3: 프로젝트 구조 전면 갱신
- 섹션 4: 아키텍처에 SQLite 레이어, 서비스 7개로 확장
- 섹션 6.6: /session/new 라우트 추가
- 섹션 6.7: WebSocket 이벤트 타입 + 재연결 메커니즘 설명
- 섹션 7.1: DI 패턴 실제 코드 반영 (8개 provider)
- 섹션 7.3: CLAUDE_PLAN, DATABASE_PATH 환경변수 추가
- 섹션 10 (신규): DB 스키마 전문
- 섹션 12: 참고 파일 확장

## 테스트 방법

1. 백엔드 사용량 API 확인: `GET /api/v1/usage/`
2. 프론트엔드 하단 UsageFooter에서 5h/wk 값이 현재 데이터를 표시하는지 확인

## 비고

- ccusage blocks 응답의 `data` 배열은 시간순 정렬이며, 활성 블록은 `isActive: true`로 표시됨
- ccusage weekly 응답의 `weekly` 배열도 시간순이며, 현재 주는 마지막 항목
- 블록 비용 필드는 `costUSD`, 주간 비용 필드는 `totalCost`로 필드명이 다름
