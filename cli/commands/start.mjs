/**
 * rocket-session start
 * Docker 이미지를 빌드하고 서비스를 시작합니다.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import * as log from '../lib/logger.mjs';
import { getPackageRoot, ensureDataDir, getComposeFile, getEnvFile } from '../lib/paths.mjs';
import { mergeOptions, writeEnvFile } from '../lib/env.mjs';
import { runAllChecks } from '../lib/preflight.mjs';
import { composeUp, waitForHealthy } from '../lib/docker.mjs';

const TOTAL_STEPS = 5;

/** readline으로 사용자 입력 받기 */
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

/** docker-compose.yml 템플릿을 복사하고 __PACKAGE_ROOT__를 치환 */
function generateComposeFile(options) {
  const templatePath = join(getPackageRoot(), 'cli', 'templates', 'docker-compose.yml');
  const template = readFileSync(templatePath, 'utf-8');
  const composed = template.replace(/__PACKAGE_ROOT__/g, getPackageRoot());
  const destPath = getComposeFile(options);
  writeFileSync(destPath, composed, 'utf-8');
  return destPath;
}

export default async function start(flags) {
  log.banner();

  // 옵션 병합 (CLI 플래그 > .env > 기본값)
  const merged = mergeOptions(flags);

  // 대화형 모드: projects-dir이 없으면 물어봄
  if (!merged.projectsDir) {
    if (flags.json) {
      log.json({ error: 'projects-dir is required' });
      process.exit(1);
    }
    merged.projectsDir = await ask(
      '프로젝트 디렉토리 경로를 입력하세요 (Claude가 작업할 디렉토리)',
    );
    if (!merged.projectsDir) {
      log.error('프로젝트 디렉토리는 필수입니다. --projects-dir 옵션을 사용하세요.');
      process.exit(1);
    }
  }

  // [1/5] 사전 검사
  log.step(1, TOTAL_STEPS, 'Docker 환경 확인 중…');
  const { passed, results } = await runAllChecks({
    claudeAuthDir: merged.claudeAuthDir,
    projectsDir: merged.projectsDir,
    port: Number(merged.port),
  });

  if (!passed) {
    log.fail();
    for (const r of results) {
      if (!r.ok) log.error(`${r.name}: ${r.message}`);
    }
    log.json({ error: 'preflight check failed', results });
    process.exit(1);
  }
  log.ok();

  // [2/5] 데이터 디렉토리 + .env 생성
  log.step(2, TOTAL_STEPS, '설정 파일 생성 중…');
  ensureDataDir({ dataDir: merged.dataDir });
  writeEnvFile(merged, { dataDir: merged.dataDir });
  log.ok();

  // [3/5] docker-compose.yml 생성
  log.step(3, TOTAL_STEPS, 'Docker Compose 파일 생성 중…');
  const composeFile = generateComposeFile({ dataDir: merged.dataDir });
  const envFile = getEnvFile({ dataDir: merged.dataDir });
  log.ok();

  // [4/5] Docker 빌드 + 실행
  log.step(4, TOTAL_STEPS, 'Docker 이미지 빌드 및 서비스 시작 중…');
  console.log('');
  log.info('  (최초 실행 시 5-10분 소요될 수 있습니다)');

  try {
    await composeUp(composeFile, envFile, { noBuild: flags.noBuild });
  } catch (err) {
    log.fail();
    log.error(`Docker 빌드/실행 실패: ${err.message}`);
    log.info(`'rocket-session logs'로 상세 로그를 확인하세요.`);
    log.json({ error: 'docker compose up failed', detail: err.message });
    process.exit(1);
  }

  // [5/5] 헬스체크 대기
  log.step(5, TOTAL_STEPS, '서비스 시작 대기 중…');
  try {
    await waitForHealthy(`http://localhost:${merged.port}/api/health`, 120000);
    log.ok();
  } catch (err) {
    log.fail();
    log.warn(err.message);
  }

  // 완료 메시지
  const url = `http://localhost:${merged.port}`;
  log.success('Rocket Session이 시작되었습니다!');
  log.info(`  Dashboard: ${url}`);
  log.info(`  데이터 저장: ${merged.dataDir}`);
  log.info('');
  log.info(`  중지: npx rocket-session stop`);
  log.info(`  로그: npx rocket-session logs -f`);
  console.log('');

  log.json({
    status: 'started',
    url,
    composeFile,
    dataDir: merged.dataDir,
  });
}
