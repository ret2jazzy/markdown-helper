import { exec } from 'node:child_process';
import { extractExecutableCommands } from './index.js';

const defaultTimeout = 30_000;
const defaultMaxBuffer = 1024 * 1024;

export function executeCommand(command, {
  cwd = process.cwd(),
  timeout = defaultTimeout,
  maxBuffer = defaultMaxBuffer,
  env = process.env
} = {}) {
  if (typeof command !== 'string' || !command.trim() || command.length > 5000) {
    throw new TypeError('Command must be a non-empty string of at most 5000 characters.');
  }
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new TypeError('timeout must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) {
    throw new TypeError('maxBuffer must be a positive safe integer.');
  }

  return new Promise(resolve => {
    exec(command, { cwd, timeout, maxBuffer, env }, (error, stdout, stderr) => {
      resolve({
        exitCode: error ? (typeof error.code === 'number' ? error.code : null) : 0,
        signal: error?.signal ?? null,
        timedOut: error?.killed === true,
        stdout,
        stderr,
        error: error && typeof error.code !== 'number' ? error.message : null
      });
    });
  });
}

export async function executeMarkdown(source, options) {
  const results = [];
  for (const command of extractExecutableCommands(source)) {
    results.push({ command, ...await executeCommand(command, options) });
  }
  return results;
}
