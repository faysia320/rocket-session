/**
 * CLI 명령어 라우터.
 * process.argv를 파싱하여 적절한 명령어 핸들러로 위임합니다.
 */

import * as log from './lib/logger.mjs';

const COMMANDS = {
  start: () => import('./commands/start.mjs'),
  stop: () => import('./commands/stop.mjs'),
  status: () => import('./commands/status.mjs'),
  logs: () => import('./commands/logs.mjs'),
  init: () => import('./commands/init.mjs'),
  config: () => import('./commands/config.mjs'),
};

/** CLI 플래그를 파싱하여 { command, flags } 반환 */
export function parseArgs(argv) {
  const flags = {};
  let command = null;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--detach' || arg === '-d') {
      flags.detach = true;
    } else if (arg === '--no-build') {
      flags.noBuild = true;
    } else if (arg === '--follow' || arg === '-f') {
      flags.follow = true;
    } else if (arg === '--remove-volumes') {
      flags.removeVolumes = true;
    } else if (arg.startsWith('--') && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
      // --key value 형태의 플래그
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      i++;
      flags[key] = argv[i];
    } else if (arg.startsWith('--') && arg.includes('=')) {
      // --key=value 형태의 플래그
      const [rawKey, ...rest] = arg.slice(2).split('=');
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      flags[key] = rest.join('=');
    } else if (!arg.startsWith('-') && !command) {
      command = arg;
    } else if (!arg.startsWith('-') && command) {
      // 서브커맨드 인자 (config list, config set 등)
      flags._args = flags._args || [];
      flags._args.push(arg);
    }
    i++;
  }

  return { command, flags };
}

function printHelp() {
  console.log(`
Usage: rocket-session <command> [options]

Commands:
  start     Docker 이미지를 빌드하고 서비스를 시작합니다
  stop      실행 중인 서비스를 중지합니다
  status    서비스 상태를 확인합니다
  logs      서비스 로그를 출력합니다
  init      설정 파일을 생성합니다 (대화형)
  config    현재 설정을 조회하거나 변경합니다

Global Options:
  --help, -h        도움말 표시
  --version, -v     버전 표시
  --data-dir <path> 데이터 디렉토리 (기본: ~/.rocket-session)
  --json            JSON 출력 모드 (LLM 자동화용)

Examples:
  npx rocket-session start --projects-dir ~/workspace
  npx rocket-session start --projects-dir ~/workspace --port 9000
  npx rocket-session stop
  npx rocket-session status --json
  npx rocket-session logs -f
`);
}

export async function run(argv) {
  const { command, flags } = parseArgs(argv);

  if (flags.json) {
    log.setJsonMode(true);
  }

  if (flags.version) {
    console.log(log.getVersion());
    process.exit(0);
  }

  if (flags.help && !command) {
    log.banner();
    printHelp();
    process.exit(0);
  }

  if (!command) {
    log.banner();
    printHelp();
    process.exit(0);
  }

  const loader = COMMANDS[command];
  if (!loader) {
    log.error(`알 수 없는 명령어: ${command}`);
    log.info(`'rocket-session --help'로 사용 가능한 명령어를 확인하세요.`);
    process.exit(1);
  }

  try {
    const mod = await loader();
    await mod.default(flags);
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}
