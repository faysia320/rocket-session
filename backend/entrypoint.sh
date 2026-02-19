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

exec "$@"
