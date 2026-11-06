const { app, BrowserWindow, shell } = require('electron');
const { spawn, execSync } = require('child_process');
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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';
  mainWindow.loadURL(devServerUrl).catch((err) => {
    console.error('[Desktop Main] Failed to load URL:', err.message);
  });
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
