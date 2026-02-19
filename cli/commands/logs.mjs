/**
 * rocket-session logs
 * 서비스 로그를 출력합니다.
 */

import { existsSync } from 'node:fs';
import * as log from '../lib/logger.mjs';
import { getComposeFile, getEnvFile } from '../lib/paths.mjs';
import { composeLogs } from '../lib/docker.mjs';

export default async function logs(flags) {
  const composeFile = getComposeFile({ dataDir: flags.dataDir });
  const envFile = getEnvFile({ dataDir: flags.dataDir });

  if (!existsSync(composeFile)) {
    log.error('Rocket Session이 초기화되지 않았습니다. 먼저 start를 실행하세요.');
    process.exit(1);
  }

  try {
    await composeLogs(composeFile, envFile, {
      follow: flags.follow,
      tail: flags.tail,
      service: flags.service,
    });
  } catch (err) {
    // Ctrl+C로 종료 시에도 에러로 처리되므로 무시
    if (err.message && !err.message.includes('exited with code')) {
      log.error(`로그 조회 실패: ${err.message}`);
      process.exit(1);
    }
  }
}
