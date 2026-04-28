import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export function getDownloadsPath(): string {
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        `powershell -NoProfile -NonInteractive -Command "(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders').'{374DE290-123F-4565-9164-39C4925E467B}'"`,
        { encoding: 'utf8', timeout: 3000 },
      );
      const trimmed = out.trim();
      if (trimmed && /^[a-zA-Z]:[\\/]/.test(trimmed.replace(/^%[^%]+%/, 'C:\\'))) {
        return trimmed.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? '');
      }
    } catch {
      // fall through to default
    }
  }
  return path.join(os.homedir(), 'Downloads');
}
