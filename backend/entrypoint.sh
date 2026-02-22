#!/bin/bash
set -e

# Git 사용자 정보 설정
if [ -n "$GIT_USER_NAME" ]; then
  git config --global user.name "$GIT_USER_NAME"
fi
if [ -n "$GIT_USER_EMAIL" ]; then
  git config --global user.email "$GIT_USER_EMAIL"
fi

# GitHub 토큰 기반 HTTPS 인증 설정
if [ -n "$GITHUB_TOKEN" ]; then
  git config --global credential.helper store
  echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > /root/.git-credentials
  chmod 600 /root/.git-credentials
  # gh CLI 인증 (GH_TOKEN은 gh CLI 공식 환경변수)
  export GH_TOKEN="${GITHUB_TOKEN}"
fi

# safe directory 설정 (/projects 하위 모든 디렉토리)
git config --global --add safe.directory '*'

# .claude.json 방어 로직: 파일 바인드 마운트 시 호스트에 파일이 없으면
# Docker가 디렉토리로 생성하는 문제를 방어
if [ -d "/root/.claude.json" ]; then
  rmdir /root/.claude.json 2>/dev/null || true
  echo '{}' > /root/.claude.json
fi

# .claude.json이 없는 경우 백업에서 복원 시도
if [ ! -f "/root/.claude.json" ]; then
  LATEST_BACKUP=$(ls -t /root/.claude/backups/.claude.json.backup.* 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    cp "$LATEST_BACKUP" /root/.claude.json
  else
    echo '{}' > /root/.claude.json
  fi
fi

exec "$@"
