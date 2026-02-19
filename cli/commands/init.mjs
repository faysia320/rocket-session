/**
 * rocket-session init
 * 대화형으로 설정 파일을 생성합니다.
 */

import { createInterface } from 'node:readline';
import * as log from '../lib/logger.mjs';
import { ensureDataDir, getEnvFile, getClaudeAuthDir } from '../lib/paths.mjs';
import { mergeOptions, writeEnvFile } from '../lib/env.mjs';

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

export default async function init(flags) {
  log.banner();

  // 비대화형: 모든 플래그가 제공되면 바로 생성
  if (flags.projectsDir) {
    const merged = mergeOptions(flags);
    ensureDataDir({ dataDir: merged.dataDir });
    const envPath = writeEnvFile(merged, { dataDir: merged.dataDir });
    log.success(`설정 파일이 생성되었습니다: ${envPath}`);
    log.json({ status: 'initialized', envFile: envPath });
    return;
  }

  // 대화형 모드
  log.info('Rocket Session 설정을 생성합니다.\n');

  const projectsDir = await ask(
    '프로젝트 디렉토리 (Claude가 작업할 디렉토리 경로)',
  );
  if (!projectsDir) {
    log.error('프로젝트 디렉토리는 필수입니다.');
    process.exit(1);
  }

  const claudeAuthDir = await ask(
    'Claude 인증 디렉토리',
    getClaudeAuthDir(),
  );
  const port = await ask('포트', '8100');
  const gitUserName = await ask('Git 사용자 이름 (선택)', '');
  const gitUserEmail = await ask('Git 이메일 (선택)', '');
  const githubToken = await ask('GitHub 토큰 (선택)', '');

  const merged = mergeOptions({
    ...flags,
    projectsDir,
    claudeAuthDir,
    port,
    gitUserName,
    gitUserEmail,
    githubToken,
  });

  ensureDataDir({ dataDir: merged.dataDir });
  const envPath = writeEnvFile(merged, { dataDir: merged.dataDir });

  log.success(`설정 파일이 생성되었습니다: ${envPath}`);
  log.info('');
  log.info(`서비스 시작: npx rocket-session start`);
  console.log('');
}
