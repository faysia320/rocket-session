/**
 * 콘솔 출력 유틸리티.
 * 외부 의존성 없이 ANSI escape code로 색상 처리.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const isColorSupported =
  process.env.FORCE_COLOR !== '0' &&
  !process.env.NO_COLOR &&
  (process.env.FORCE_COLOR || process.stdout.isTTY);

const c = (code) => (isColorSupported ? `\x1b[${code}m` : '');

const colors = {
  reset: c(0),
  bold: c(1),
  dim: c(2),
  red: c(31),
  green: c(32),
  yellow: c(33),
  blue: c(34),
  cyan: c(36),
};

let version = '0.0.0';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'),
  );
  version = pkg.version;
} catch {
  // 패키지 읽기 실패 시 기본값 사용
}

let jsonMode = false;

export function setJsonMode(enabled) {
  jsonMode = enabled;
}

export function step(current, total, message) {
  if (jsonMode) return;
  process.stdout.write(
    `${colors.cyan}[${current}/${total}]${colors.reset} ${message}`,
  );
}

export function ok(message = '') {
  if (jsonMode) return;
  console.log(` ${colors.green}✓${colors.reset}${message ? ' ' + message : ''}`);
}

export function fail(message = '') {
  if (jsonMode) return;
  console.log(` ${colors.red}✗${colors.reset}${message ? ' ' + message : ''}`);
}

export function info(message) {
  if (jsonMode) return;
  console.log(`${colors.dim}${message}${colors.reset}`);
}

export function warn(message) {
  if (jsonMode) return;
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

export function error(message) {
  if (jsonMode) return;
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

export function success(message) {
  if (jsonMode) return;
  console.log(`\n${colors.green}${colors.bold}${message}${colors.reset}`);
}

export function json(data) {
  if (jsonMode) {
    console.log(JSON.stringify(data));
  }
}

export function banner() {
  if (jsonMode) return;
  console.log(
    `\n${colors.bold}🚀 Rocket Session${colors.reset} ${colors.dim}v${version}${colors.reset}\n`,
  );
}

export function getVersion() {
  return version;
}
