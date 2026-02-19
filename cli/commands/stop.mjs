/**
 * rocket-session stop
 * 실행 중인 서비스를 중지합니다.
 */

import { existsSync } from 'node:fs';
import * as log from '../lib/logger.mjs';
import { getComposeFile, getEnvFile } from '../lib/paths.mjs';
import { composeDown } from '../lib/docker.mjs';

export default async function stop(flags) {
  log.banner();

  const composeFile = getComposeFile({ dataDir: flags.dataDir });
  const envFile = getEnvFile({ dataDir: flags.dataDir });

  if (!existsSync(composeFile)) {
    log.error('Rocket Session이 초기화되지 않았습니다. 먼저 start를 실행하세요.');
    log.json({ error: 'not initialized' });
    process.exit(1);
  }

  log.info('서비스를 중지합니다…');

  try {
    await composeDown(composeFile, envFile, {
      removeVolumes: flags.removeVolumes,
    });
    log.success('Rocket Session이 중지되었습니다.');
    log.json({ status: 'stopped' });
  } catch (err) {
    log.error(`중지 실패: ${err.message}`);
    log.json({ error: err.message });
    process.exit(1);
  }
}
