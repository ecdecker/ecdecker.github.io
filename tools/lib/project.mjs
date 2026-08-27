import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import hugoPath from "hugo-bin";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export { hugoPath };

export class SiteError extends Error {
  constructor(message, { exitCode = 1, cause } = {}) {
    super(message, { cause });
    this.name = "SiteError";
    this.exitCode = exitCode;
  }
}

export async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export function run(command, args = [], options = {}) {
  const {
    cwd = projectRoot,
    env = process.env,
    stdio = "inherit",
    capture = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : stdio,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", (error) => {
      reject(new SiteError(`Could not start ${path.basename(command)}: ${error.message}`, { cause: error }));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve({ code, stdout, stderr, child });
        return;
      }
      const detail = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      const ended = signal ? `signal ${signal}` : `exit ${code}`;
      reject(new SiteError(
        `${path.basename(command)} failed (${ended})${detail ? `:\n${detail}` : ""}`,
        { exitCode: code || 1 },
      ));
    });
  });
}

export function spawnManaged(command, args = [], options = {}) {
  return spawn(command, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    windowsHide: true,
  });
}

export async function hugo(args, options = {}) {
  return run(hugoPath, args, options);
}
