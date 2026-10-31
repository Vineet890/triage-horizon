import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDirectory = path.resolve(frontendDirectory, '..');
const serverDirectory = path.join(repositoryDirectory, 'server');
const services = [];
let shuttingDown = false;

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (listening) => {
      socket.destroy();
      resolve(listening);
    };

    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function servesExpectedApp(port, endpoint, marker) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok && (await response.text()).includes(marker);
  } catch {
    return false;
  }
}

function stopServices(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of services) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }

  process.exitCode = exitCode;
}

function startService(name, entryPoint, cwd) {
  const child = spawn(process.execPath, [entryPoint], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  services.push(child);
  child.once('error', (error) => {
    console.error(`[dev] Could not start ${name}: ${error.message}`);
    stopServices(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[dev] ${name} stopped${signal ? ` after ${signal}` : ` with exit code ${code}`}.`
    );
    stopServices(code ?? 1);
  });

  return child;
}

async function waitForPort(port, child, name) {
  const timeoutAt = Date.now() + 30_000;

  while (Date.now() < timeoutAt) {
    if (await isPortListening(port)) return;
    if (child.exitCode !== null) {
      throw new Error(`${name} exited before port ${port} became available.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${name} did not start listening on port ${port} within 30 seconds.`);
}

async function main() {
  const [backendPortOpen, frontendPortOpen] = await Promise.all([
    isPortListening(5000),
    isPortListening(5173),
  ]);
  const [backendAlreadyRunning, frontendAlreadyRunning] = await Promise.all([
    backendPortOpen && servesExpectedApp(5000, '/health', 'triage-horizon-backend'),
    frontendPortOpen && servesExpectedApp(5173, '/', 'Triage Horizon | Clinical Triage Network'),
  ]);

  if (backendPortOpen && !backendAlreadyRunning) {
    throw new Error('Port 5000 is occupied by a service that is not the Triage Horizon backend.');
  }
  if (frontendPortOpen && !frontendAlreadyRunning) {
    throw new Error('Port 5173 is occupied by a service that is not the Triage Horizon frontend.');
  }

  if (backendAlreadyRunning) {
    console.log('[dev] Backend already listening on port 5000; reusing it.');
  } else {
    console.log('[dev] Starting backend on port 5000...');
    const backend = startService(
      'Backend',
      path.join(serverDirectory, 'src', 'server.js'),
      serverDirectory
    );
    await waitForPort(5000, backend, 'Backend');
  }

  if (frontendAlreadyRunning) {
    console.log('[dev] Frontend already listening on port 5173; reusing it.');
  } else {
    console.log('[dev] Starting Vite on port 5173...');
    startService(
      'Frontend',
      path.join(frontendDirectory, 'node_modules', 'vite', 'bin', 'vite.js'),
      frontendDirectory
    );
  }

  if (backendAlreadyRunning && frontendAlreadyRunning) {
    console.log('[dev] Both services are already running. No duplicate processes started.');
  }
}

process.on('SIGINT', () => stopServices(130));
process.on('SIGTERM', () => stopServices(143));

main().catch((error) => {
  console.error(`[dev] ${error.message}`);
  stopServices(1);
});
