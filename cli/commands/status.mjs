/**
 * rocket-session status
 * 서비스 상태를 확인합니다.
 */

import { existsSync } from 'node:fs';
import * as log from '../lib/logger.mjs';
import { getComposeFile, getEnvFile, getDataDir } from '../lib/paths.mjs';
import { composePs } from '../lib/docker.mjs';
import { readEnvFile } from '../lib/env.mjs';

export default async function status(flags) {
  if (!flags.json) log.banner();

  const composeFile = getComposeFile({ dataDir: flags.dataDir });
  const envFile = getEnvFile({ dataDir: flags.dataDir });

  if (!existsSync(composeFile)) {
    log.info('Rocket Session이 초기화되지 않았습니다.');
    log.json({ status: 'not_initialized' });
    return;
  }

  try {
    const containers = await composePs(composeFile, envFile);
    const env = readEnvFile({ dataDir: flags.dataDir });
    const port = env.ROCKET_PORT || '8100';

    if (containers.length === 0) {
      log.info('서비스가 실행되고 있지 않습니다.');
      log.json({ status: 'stopped', containers: [] });
      return;
    }

    if (!flags.json) {
      console.log('');
      for (const c of containers) {
        const state = c.State || c.Status || 'unknown';
        const name = c.Name || c.Service || 'unknown';
        const health = c.Health || '';
        const statusIcon = state === 'running' ? '●' : '○';
        const healthSuffix = health ? ` (${health})` : '';
        log.info(`  ${statusIcon} ${name}: ${state}${healthSuffix}`);
      }
      console.log('');
      log.info(`  Dashboard: http://localhost:${port}`);
      log.info(`  데이터 저장: ${getDataDir({ dataDir: flags.dataDir })}`);
      console.log('');
    }

    const allRunning = containers.every(
      (c) => (c.State || '').toLowerCase() === 'running',
    );

    log.json({
      status: allRunning ? 'running' : 'partial',
      url: `http://localhost:${port}`,
      dataDir: getDataDir({ dataDir: flags.dataDir }),
      containers: containers.map((c) => ({
        name: c.Name || c.Service,
        state: c.State || c.Status,
        health: c.Health || '',
      })),
    });
  } catch (err) {
    log.error(`상태 확인 실패: ${err.message}`);
    log.json({ error: err.message });
    process.exit(1);
  }
}
