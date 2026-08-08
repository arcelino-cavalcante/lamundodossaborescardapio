const { fork, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const config = require('./src/config');
const { startDashboard } = require('./src/dashboard-server');
const { createDatabase } = require('./src/database');

const botRoot = __dirname;
const workerFile = path.join(botRoot, 'app.js');
let worker = null;
let dashboard = null;
let database = null;
let shuttingDown = false;
let restartTimer = null;
let crashCount = 0;
let controlQueue = Promise.resolve();
const plannedStops = new Set();
const runtime = {
  state: 'stopped',
  pid: null,
  startedAt: null,
  lastExit: null,
  printerEnabled: null,
  pixConfigured: null
};

function status() {
  return { ...runtime };
}

function recordError(source, error) {
  const message = error?.stack || error?.message || String(error || 'Erro desconhecido');
  if (database) database.addLog('error', source, message).catch(() => {});
}

function capture(stream, output, source, saveAsError = false) {
  let pending = '';
  stream.on('data', chunk => {
    output.write(chunk);
    pending += chunk.toString('utf8');
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || '';
    if (saveAsError) {
      for (const line of lines.map(value => value.trim()).filter(Boolean)) recordError(source, line);
    }
  });
  stream.on('end', () => {
    if (saveAsError && pending.trim()) recordError(source, pending.trim());
  });
}

function handleWorkerMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'ready') {
    runtime.state = 'online';
    runtime.printerEnabled = message.printerEnabled;
    runtime.pixConfigured = message.pixConfigured;
    crashCount = 0;
  } else if (message.type === 'qr') {
    runtime.state = 'qr';
  } else if (message.type === 'auth_failure' || message.type === 'disconnected') {
    runtime.state = 'error';
  }
}

function scheduleAutoRestart() {
  if (shuttingDown || restartTimer) return;
  crashCount += 1;
  const delay = Math.min(30000, 2000 * crashCount);
  runtime.state = 'restarting';
  console.log(`[SUPERVISOR] Reiniciando o bot automaticamente em ${Math.round(delay / 1000)}s...`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startWorker();
  }, delay);
}

function startWorker() {
  if (worker || shuttingDown) return;
  runtime.state = 'starting';
  runtime.startedAt = new Date().toISOString();
  worker = fork(workerFile, [], {
    cwd: botRoot,
    env: process.env,
    silent: true
  });
  runtime.pid = worker.pid;
  console.log(`[SUPERVISOR] Bot iniciado (PID ${worker.pid}).`);
  capture(worker.stdout, process.stdout, 'bot');
  capture(worker.stderr, process.stderr, 'bot', true);
  worker.on('message', handleWorkerMessage);
  worker.once('error', error => recordError('supervisor', error));
  worker.once('exit', (code, signal) => {
    const pid = worker?.pid;
    const planned = plannedStops.delete(pid);
    runtime.lastExit = { code, signal, at: new Date().toISOString() };
    runtime.pid = null;
    worker = null;
    if (shuttingDown || planned) {
      runtime.state = 'stopped';
      return;
    }
    recordError('supervisor', `O processo do bot encerrou (código ${code}, sinal ${signal || 'nenhum'}).`);
    scheduleAutoRestart();
  });
}

function stopWorker() {
  if (!worker) return Promise.resolve();
  const target = worker;
  plannedStops.add(target.pid);
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    target.once('exit', finish);
    target.kill('SIGTERM');
    setTimeout(() => {
      if (target.exitCode == null && target.signalCode == null) target.kill('SIGKILL');
      finish();
    }, 10000).unref();
  });
}

function enqueue(action) {
  controlQueue = controlQueue.then(action, action);
  return controlQueue;
}

function restart() {
  return enqueue(async () => {
    runtime.state = 'restarting';
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    await stopWorker();
    startWorker();
  });
}

function clearSession() {
  return enqueue(async () => {
    runtime.state = 'restarting';
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    await stopWorker();
    const authRoot = path.resolve(config.authPath);
    const sessionDirectory = path.resolve(authRoot, `session-${config.clientId}`);
    if (path.dirname(sessionDirectory) !== authRoot) throw new Error('Caminho da sessão do WhatsApp inválido.');
    await fs.rm(sessionDirectory, { recursive: true, force: true });
    console.log('[SUPERVISOR] Sessão autenticada do WhatsApp removida. Aguarde o novo QR Code.');
    startWorker();
  });
}

function openDashboard(url) {
  if (!config.dashboardAutoOpen) return;
  let command;
  let args;
  if (os.platform() === 'darwin') {
    command = 'open';
    args = [url];
  } else if (os.platform() === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  const opener = spawn(command, args, { detached: true, stdio: 'ignore' });
  opener.once('error', error => recordError('painel', error));
  opener.unref();
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[SUPERVISOR] Encerrando (${signal})...`);
  if (restartTimer) clearTimeout(restartTimer);
  await stopWorker().catch(error => recordError('supervisor', error));
  if (dashboard) await dashboard.close().catch(error => recordError('painel', error));
  if (database) await database.close().catch(() => {});
  process.exit(0);
}

async function main() {
  database = await createDatabase(config.dbPath);
  const controller = { status, restart, clearSession, recordError };
  dashboard = await startDashboard({ database, controller, config });
  console.log(`[PAINEL] Acesse ${dashboard.url}`);
  startWorker();
  openDashboard(dashboard.url);

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(error => {
  console.error('[SUPERVISOR] Falha na inicialização:', error.stack || error);
  process.exitCode = 1;
});
