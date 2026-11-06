const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let backendProcess = null;

/**
 * Check whether port 8000 is active/listening
 */
function isPort8000Listening() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(8000, '127.0.0.1');
  });
}

/**
 * Poll http://127.0.0.1:8000/healthz every 250ms, max 15s timeout (60 retries)
 */
function waitForBackendHealth(timeoutMs = 15000, intervalMs = 250) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get('http://127.0.0.1:8000/healthz', (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (Date.now() - startTime >= timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, intervalMs);
        }
      });

      req.on('error', () => {
        if (Date.now() - startTime >= timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, intervalMs);
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() - startTime >= timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, intervalMs);
        }
      });
    };

    check();
  });
}

/**
 * Spawn local FastAPI Uvicorn backend process if not already running on port 8000
 */
async function startBackendProcess() {
  const isRunning = await isPort8000Listening();
  if (isRunning) {
    console.log('[Desktop Main] Backend port 8000 already active. Reusing running process.');
    return;
  }

  const projectRoot = path.resolve(__dirname, '..');
  const backendDir = path.join(projectRoot, 'backend');

  console.log('[Desktop Main] Launching FastAPI backend process...');
  backendProcess = spawn(
    'python3',
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: backendDir,
      stdio: 'ignore',
      detached: false,
    }
  );

  backendProcess.on('error', (err) => {
    console.error('[Desktop Main] Failed to spawn backend process:', err.message);
  });
}

/**
 * Terminate backend sub-process cleanly
 */
function terminateBackendProcess() {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Desktop Main] Gracefully terminating backend process...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

/**
 * Verify navigation target is strictly localhost loopback
 */
function isLocalhostUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#020617',
    title: 'O-Finance Workstation',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Remove default window menu bar
  mainWindow.setMenu(null);

  // Security Constitution Invariant: Intercept all external navigations outside 127.0.0.1 / localhost
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocalhostUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalhostUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  loadAppContent();
}

async function loadAppContent() {
  const targetUrl = process.env.OFINANCE_DESKTOP_URL || 'http://127.0.0.1:8000/';
  const fallbackFile = path.join(__dirname, '../dist/index.html');

  console.log('[Desktop Main] Polling backend health on http://127.0.0.1:8000/healthz...');
  const isHealthy = await waitForBackendHealth(15000, 250);

  if (isHealthy) {
    console.log(`[Desktop Main] Backend healthy. Loading URL: ${targetUrl}`);
    try {
      await mainWindow.loadURL(targetUrl);
      return;
    } catch (err) {
      console.error('[Desktop Main] Failed to load target URL:', err.message);
    }
  } else {
    console.warn('[Desktop Main] Backend health probe timed out or failed. Falling back to local dist/index.html');
  }

  try {
    await mainWindow.loadFile(fallbackFile);
  } catch (err) {
    console.error('[Desktop Main] Failed to load fallback file:', err.message);
  }
}

app.whenReady().then(async () => {
  await startBackendProcess();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  terminateBackendProcess();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
