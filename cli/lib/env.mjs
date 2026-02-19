/**
 * .env 파일 생성 및 관리.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getEnvFile, getDataDir, getPackageRoot, getClaudeAuthDir } from './paths.mjs';

const DEFAULTS = {
  CLAUDE_AUTH_DIR: '',
  HOST_PROJECTS_DIR: '',
  ROCKET_DATA_DIR: '',
  ROCKET_PORT: '8100',
  CLAUDE_ALLOWED_TOOLS: 'Read,Write,Edit,Bash',
  GIT_USER_NAME: '',
  GIT_USER_EMAIL: '',
  GITHUB_TOKEN: '',
  CORS_EXTRA_ORIGINS: '',
};

/** .env 파일을 파싱하여 key-value 객체로 반환 */
export function readEnvFile(options = {}) {
  const envPath = getEnvFile(options);
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, 'utf-8');
  const result = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }

  return result;
}

/** CLI 플래그 + .env 파일 + 기본값을 병합 */
export function mergeOptions(flags, options = {}) {
  const env = readEnvFile(options);

  return {
    claudeAuthDir: flags.claudeAuthDir || env.CLAUDE_AUTH_DIR || getClaudeAuthDir(),
    projectsDir: flags.projectsDir || env.HOST_PROJECTS_DIR || '',
    dataDir: flags.dataDir || getDataDir(options),
    port: flags.port || env.ROCKET_PORT || DEFAULTS.ROCKET_PORT,
    allowedTools:
      flags.allowedTools || env.CLAUDE_ALLOWED_TOOLS || DEFAULTS.CLAUDE_ALLOWED_TOOLS,
    gitUserName: flags.gitUserName || env.GIT_USER_NAME || '',
    gitUserEmail: flags.gitUserEmail || env.GIT_USER_EMAIL || '',
    githubToken: flags.githubToken || env.GITHUB_TOKEN || '',
    corsOrigins: flags.corsOrigins || env.CORS_EXTRA_ORIGINS || '',
    packageRoot: getPackageRoot(),
  };
}

/** .env 파일을 생성/덮어쓰기 */
export function writeEnvFile(merged, options = {}) {
  const envPath = getEnvFile(options);
  const lines = [
    `# Rocket Session 설정 (자동 생성)`,
    `CLAUDE_AUTH_DIR=${merged.claudeAuthDir}`,
    `HOST_PROJECTS_DIR=${merged.projectsDir}`,
    `ROCKET_DATA_DIR=${merged.dataDir}`,
    `ROCKET_PORT=${merged.port}`,
    `CLAUDE_ALLOWED_TOOLS=${merged.allowedTools}`,
    `GIT_USER_NAME=${merged.gitUserName}`,
    `GIT_USER_EMAIL=${merged.gitUserEmail}`,
    `GITHUB_TOKEN=${merged.githubToken}`,
    `CORS_EXTRA_ORIGINS=${merged.corsOrigins}`,
    '',
  ];

  writeFileSync(envPath, lines.join('\n'), 'utf-8');
  return envPath;
}
