/**
 * Docker / Docker Compose 사전 검사.
 * 서비스 시작 전 필수 요구사항을 확인합니다.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

function execQuiet(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
  } catch {
    return null;
  }
}

export function checkDocker() {
  const version = execQuiet('docker', ['--version']);
  if (!version) {
    return {
      ok: false,
      message: 'Docker가 설치되지 않았습니다. https://docker.com 에서 설치해주세요.',
    };
  }
  return { ok: true, message: version };
}

export function checkDockerCompose() {
  const version = execQuiet('docker', ['compose', 'version']);
  if (!version) {
    return {
      ok: false,
      message:
        'Docker Compose V2가 필요합니다. Docker Desktop을 최신 버전으로 업데이트해주세요.',
    };
  }
  return { ok: true, message: version };
}

export function checkDockerDaemon() {
  const info = execQuiet('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (!info) {
    return {
      ok: false,
      message: 'Docker 데몬이 실행되고 있지 않습니다. Docker Desktop을 시작해주세요.',
    };
  }
  return { ok: true, message: `Docker Engine ${info}` };
}

export function checkPath(path, label) {
  if (!path) {
    return { ok: false, message: `${label} 경로가 지정되지 않았습니다.` };
  }
  if (!existsSync(path)) {
    return { ok: false, message: `${label} '${path}'가 존재하지 않습니다.` };
  }
  return { ok: true, message: path };
}

export function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve({
        ok: false,
        message: `포트 ${port}가 이미 사용 중입니다. --port 옵션으로 다른 포트를 지정해주세요.`,
      });
    });
    server.once('listening', () => {
      server.close();
      resolve({ ok: true, message: `포트 ${port} 사용 가능` });
    });
    server.listen(port, '0.0.0.0');
  });
}

/**
 * 전체 사전 검사를 수행합니다.
 * @returns {{ passed: boolean, results: Array<{name: string, ok: boolean, message: string}> }}
 */
export async function runAllChecks(options) {
  const results = [];

  const docker = checkDocker();
  results.push({ name: 'Docker', ...docker });
  if (!docker.ok) return { passed: false, results };

  const compose = checkDockerCompose();
  results.push({ name: 'Docker Compose', ...compose });
  if (!compose.ok) return { passed: false, results };

  const daemon = checkDockerDaemon();
  results.push({ name: 'Docker Daemon', ...daemon });
  if (!daemon.ok) return { passed: false, results };

  const claudeAuth = checkPath(options.claudeAuthDir, 'Claude 인증 디렉토리');
  results.push({ name: 'Claude Auth', ...claudeAuth });
  if (!claudeAuth.ok) {
    results[results.length - 1].message +=
      '\nclaude CLI로 먼저 로그인해주세요: npx @anthropic-ai/claude-code';
    return { passed: false, results };
  }

  const projectsDir = checkPath(options.projectsDir, '프로젝트 디렉토리');
  results.push({ name: 'Projects Dir', ...projectsDir });
  if (!projectsDir.ok) return { passed: false, results };

  const port = await checkPort(options.port || 8100);
  results.push({ name: 'Port', ...port });
  if (!port.ok) return { passed: false, results };

  return { passed: true, results };
}
