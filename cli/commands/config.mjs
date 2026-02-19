/**
 * rocket-session config
 * 현재 설정을 조회하거나 변경합니다.
 */

import { existsSync } from 'node:fs';
import * as log from '../lib/logger.mjs';
import { getEnvFile, getDataDir } from '../lib/paths.mjs';
import { readEnvFile, writeEnvFile, mergeOptions } from '../lib/env.mjs';

export default async function config(flags) {
  const subcommand = flags._args?.[0] || 'list';

  switch (subcommand) {
    case 'list':
      return listConfig(flags);
    case 'set':
      return setConfig(flags);
    case 'path':
      return showPath(flags);
    default:
      log.error(`알 수 없는 서브커맨드: ${subcommand}`);
      log.info('사용법: rocket-session config [list|set|path]');
      process.exit(1);
  }
}

function listConfig(flags) {
  const envFile = getEnvFile({ dataDir: flags.dataDir });

  if (!existsSync(envFile)) {
    log.info('설정 파일이 없습니다. `rocket-session init`으로 생성하세요.');
    log.json({ error: 'no config file' });
    return;
  }

  const env = readEnvFile({ dataDir: flags.dataDir });

  if (flags.json) {
    log.json(env);
    return;
  }

  log.banner();
  console.log('현재 설정:\n');
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('#')) continue;
    const display = key === 'GITHUB_TOKEN' && value ? '***' : value || '(미설정)';
    log.info(`  ${key}=${display}`);
  }
  console.log('');
}

function setConfig(flags) {
  const args = flags._args || [];
  if (args.length < 3) {
    log.error('사용법: rocket-session config set <KEY> <VALUE>');
    process.exit(1);
  }

  const key = args[1];
  const value = args[2];
  const envFile = getEnvFile({ dataDir: flags.dataDir });

  if (!existsSync(envFile)) {
    log.error('설정 파일이 없습니다. `rocket-session init`으로 먼저 생성하세요.');
    process.exit(1);
  }

  const env = readEnvFile({ dataDir: flags.dataDir });
  env[key] = value;

  // .env 파일에 직접 key=value 쓰기
  const merged = mergeOptions({
    claudeAuthDir: env.CLAUDE_AUTH_DIR,
    projectsDir: env.HOST_PROJECTS_DIR,
    dataDir: getDataDir({ dataDir: flags.dataDir }),
    port: env.ROCKET_PORT,
    allowedTools: env.CLAUDE_ALLOWED_TOOLS,
    gitUserName: env.GIT_USER_NAME,
    gitUserEmail: env.GIT_USER_EMAIL,
    githubToken: env.GITHUB_TOKEN,
    corsOrigins: env.CORS_EXTRA_ORIGINS,
  });

  writeEnvFile(merged, { dataDir: flags.dataDir });
  log.success(`${key}=${value} 설정 완료`);
  log.json({ status: 'updated', key, value });
}

function showPath(flags) {
  const envFile = getEnvFile({ dataDir: flags.dataDir });
  if (flags.json) {
    log.json({ envFile, dataDir: getDataDir({ dataDir: flags.dataDir }) });
  } else {
    log.info(`설정 파일: ${envFile}`);
    log.info(`데이터 디렉토리: ${getDataDir({ dataDir: flags.dataDir })}`);
  }
}
