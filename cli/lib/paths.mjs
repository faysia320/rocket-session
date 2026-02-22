/**
 * 경로 해석 유틸리티.
 * npm 패키지 루트, 데이터 디렉토리, 설정 파일 경로를 관리합니다.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** npm 패키지 루트 디렉토리 (backend/, frontend/ 포함) */
export function getPackageRoot() {
  return resolve(__dirname, '..', '..');
}

/** 사용자 데이터 디렉토리 (기본: ~/.rocket-session) */
export function getDataDir(options = {}) {
  const dir = options.dataDir || join(homedir(), '.rocket-session');
  return resolve(dir);
}

/** 생성된 docker-compose.yml 경로 */
export function getComposeFile(options = {}) {
  return join(getDataDir(options), 'docker-compose.yml');
}

/** .env 파일 경로 */
export function getEnvFile(options = {}) {
  return join(getDataDir(options), '.env');
}

/** 데이터베이스 관련 디렉토리 */
export function getDbDir(options = {}) {
  return join(getDataDir(options), 'data');
}

/** 데이터 디렉토리 구조 생성 */
export function ensureDataDir(options = {}) {
  const dataDir = getDataDir(options);
  const dbDir = getDbDir(options);

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return dataDir;
}

/** Claude 인증 디렉토리 (기본: ~/.claude) */
export function getClaudeAuthDir(options = {}) {
  return options.claudeAuthDir || join(homedir(), '.claude');
}
