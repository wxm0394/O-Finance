const { contextBridge } = require('electron');

/**
 * Preload script for O-Finance Desktop Workstation.
 * Strictly enforces 10 Security Constitution Invariants:
 * - Context Isolation: true
 * - Node Integration: false
 * - Only read-only runtime metadata exposed via window.ofinanceDesktop
 */
contextBridge.exposeInMainWorld('ofinanceDesktop', {
  isDesktop: true,
  platform: process.platform,
  appVersion: '0.4.0',
});
