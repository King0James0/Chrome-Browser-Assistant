import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ports = [50090, 50091];
const isWindows = process.platform === 'win32';

async function killPortWindows(port) {
  const psScript = `
$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq 'Listen' }
foreach ($c in $conns) {
  try {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
    Write-Output ('killed pid ' + $c.OwningProcess)
  } catch { }
}
`;
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psScript,
    ]);
    const trimmed = stdout.trim();
    if (trimmed) {
      console.log(`[kill-ports] ${port}: ${trimmed.replace(/\r?\n/g, ', ')}`);
    }
  } catch {
    // No-op: nothing to kill, or PowerShell exit-code noise. The verify step below
    // catches any actual failure to free the port.
  }
}

async function killPortUnix(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`]).catch(() => ({
      stdout: '',
    }));
    const pids = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pid of pids) {
      await execFileAsync('kill', ['-9', pid]).catch(() => {});
      console.log(`[kill-ports] ${port}: killed pid ${pid}`);
    }
  } catch {
    // nothing to kill
  }
}

async function isPortBound(port) {
  if (isWindows) {
    try {
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }).Count`,
      ]);
      return Number(stdout.trim()) > 0;
    } catch {
      return false;
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`]).catch(() => ({
      stdout: '',
    }));
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

await Promise.all(ports.map((p) => (isWindows ? killPortWindows(p) : killPortUnix(p))));

const stillBound = [];
for (const port of ports) {
  if (await isPortBound(port)) stillBound.push(port);
}
if (stillBound.length) {
  console.warn(`[kill-ports] WARNING: still bound after kill: ${stillBound.join(', ')}`);
  process.exit(1);
}
console.log(`[kill-ports] cleared ${ports.join(', ')}`);
