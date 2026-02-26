# 개발 명령어

## 개발 서버
```bash
pnpm dev:aps          # APS (Advanced Planning & Scheduling) - 포트 5173
pnpm dev:dp           # DP (Demand Planning) - 포트 5174
pnpm dev:admin        # Admin - 포트 5175
pnpm dev:portal       # Portal - 포트 5176
pnpm dev:smart-report # Smart Report - 포트 5177
pnpm dev:smart-editor # Smart Editor - 포트 5178
pnpm dev:fab-sched    # Fab Scheduler - 포트 5179
pnpm dev:all          # 모든 패키지 동시 실행
```

## 빌드 & 린트
```bash
pnpm build:aps        # APS 빌드 (lint 포함)
pnpm build:dp         # DP 빌드
pnpm lint:aps         # APS 린트 (--fix 포함)
pnpm lint:dp          # DP 린트
```

## 테스트
```bash
pnpm test                       # 전체 테스트 실행
pnpm test SimpleGrid.test.ts    # 특정 파일 테스트
pnpm test:watch                 # watch 모드
pnpm test:coverage              # 커버리지 리포트
```

## 환경 관리
```bash
pnpm setup            # 의존성 설치 (pnpm i)
pnpm clean            # node_modules 및 lerna clean
pnpm nginx:up         # Docker nginx 프록시 시작 (포트 8080)
pnpm nginx:down       # Docker nginx 중지
```

## 타입 체크
```bash
vue-tsc --noEmit      # 타입 검사만 실행 (빌드 없이)
```
