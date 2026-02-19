/**
 * Docker Compose 명령어 래퍼.
 * child_process.spawn으로 Docker Compose를 실행합니다.
 */

import { spawn } from 'node:child_process';
import { get as httpGet } from 'node:http';

/** Docker Compose 명령어 실행 */
function compose(composeFile, envFile, args, options = {}) {
  return new Promise((resolve, reject) => {
    const fullArgs = ['compose', '-f', composeFile, '--env-file', envFile, ...args];

    const child = spawn('docker', fullArgs, {
      stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
    });

    let stdout = '';
    let stderr = '';

    if (!options.inherit) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.onStdout) options.onStdout(data.toString());
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.onStderr) options.onStderr(data.toString());
      });
    }

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0 && !options.ignoreExitCode) {
        reject(new Error(stderr || `docker compose exited with code ${code}`));
      } else {
        resolve({ code, stdout, stderr });
      }
    });
  });
}

/** docker compose build */
export function composeBuild(composeFile, envFile) {
  return compose(composeFile, envFile, ['build'], { inherit: true });
}

/** docker compose up */
export function composeUp(composeFile, envFile, options = {}) {
  const args = ['up', '-d'];
  if (!options.noBuild) args.push('--build');
  return compose(composeFile, envFile, args, { inherit: true });
}

/** docker compose down */
export function composeDown(composeFile, envFile, options = {}) {
  const args = ['down'];
  if (options.removeVolumes) args.push('-v');
  return compose(composeFile, envFile, args, { inherit: true });
}

/** docker compose ps --format json */
export async function composePs(composeFile, envFile) {
  const result = await compose(composeFile, envFile, ['ps', '--format', 'json'], {
    ignoreExitCode: true,
  });

  if (!result.stdout.trim()) return [];

  // Docker Compose V2는 각 줄이 별도의 JSON 객체
  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** docker compose logs */
export function composeLogs(composeFile, envFile, options = {}) {
  const args = ['logs'];
  if (options.follow) args.push('-f');
  if (options.tail) args.push('--tail', String(options.tail));
  if (options.service) args.push(options.service);
  return compose(composeFile, envFile, args, { inherit: true });
}

/** HTTP 헬스체크 폴링 */
export function waitForHealthy(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function poll() {
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `서비스가 ${Math.round(timeoutMs / 1000)}초 내에 시작되지 않았습니다. 'rocket-session logs'로 로그를 확인해주세요.`,
          ),
        );
        return;
      }

      const req = httpGet(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(poll, 2000);
        }
      });

      req.on('error', () => {
        setTimeout(poll, 2000);
      });

      req.setTimeout(3000, () => {
        req.destroy();
        setTimeout(poll, 2000);
      });
    }

    setTimeout(poll, 3000);
  });
}
