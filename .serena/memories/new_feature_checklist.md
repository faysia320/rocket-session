# 새 기능 개발 체크리스트

## Backend 새 기능 추가

- [ ] `app/schemas/` - Pydantic 스키마 생성
- [ ] `app/models/` - SQLAlchemy ORM 모델 생성
- [ ] `app/repositories/` - Repository 클래스 생성
- [ ] `app/services/` - Service 클래스 생성
- [ ] `app/api/v1/endpoints/` - API 엔드포인트 생성
- [ ] `app/api/v1/api.py` - 라우터 등록
- [ ] `app/api/dependencies.py` - DI 프로바이더 추가
- [ ] `tests/` - 테스트 코드 작성

## Frontend 새 기능 추가

- [ ] `src/types/` - 타입 정의 (필요 시)
- [ ] `src/features/[feature-name]/` 디렉토리 생성
- [ ] `components/` - 기능 전용 TSX 컴포넌트 작성 (Tailwind + shadcn/ui)
- [ ] `hooks/` - 커스텀 훅 + TanStack Query 키 팩토리
- [ ] `src/lib/api/` - 타입 안전 API 함수 추가
- [ ] `src/store/` - Zustand 스토어 추가 (필요 시)
- [ ] `src/routes/` - 라우트 파일 추가 (필요 시)
- [ ] 접근성 체크리스트 확인 (aria-label, 시맨틱 요소)
- [ ] `npx tsc --noEmit` TypeScript 에러 없음 확인