// Peão Passado para Windows (Electron)
const { app, BrowserWindow, ipcMain, protocol, net, nativeTheme, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WWW = path.join(__dirname, '..', 'www');
const ALLOWED = ['api.chess.com', 'lichess.org', 'raw.githubusercontent.com', 'tablebase.lichess.ovh'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.json': 'application/json', '.css': 'text/css' };

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();
// O nome "Peão Passado" entra no User-Agent padrão; o "ã" quebrava o protocolo app:// (cabeçalho fora de ASCII)
// e nada além do index.html carregava (lib/chess.js, motor, fontes).
app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 380, minHeight: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1412' : '#eef1ee',
    title: 'Peão Passado', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.loadURL('app://local/index.html');
  return win;
}

// o app mudou de nome (Lance a Lance → Peão Passado); os dados continuam na pasta antiga
app.setPath('userData', path.join(app.getPath('appData'), 'Lance a Lance'));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', async req => {
    const u = new URL(req.url); let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(WWW, rel));
    if (!file.startsWith(WWW)) return new Response('Proibido', { status: 403 });
    // lê direto do disco (funciona dentro do app.asar) em vez de net.fetch, que repassava os cabeçalhos da página
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, { status: 200, headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) { return new Response('Não encontrado', { status: 404 }); }
  });
  ipcMain.handle('fetchText', async (_e, url) => {
    const host = new URL(url).hostname;
    if (!ALLOWED.includes(host)) throw new Error('host_blocked');
    const r = await net.fetch(url, { headers: { 'User-Agent': 'LanceALance/1.0 (app pessoal de estudo)', Accept: 'application/json, application/x-chess-pgn, */*' } });
    if (r.status === 404) return Promise.reject(new Error('nouser'));
    if (!r.ok) return Promise.reject(new Error('http_' + r.status));
    return r.text();
  });
  // sincronização entre aparelhos: só a API de Gists do GitHub, com o token que a pessoa colou no app
  ipcMain.handle('gh', async (_e, o) => {
    const u = new URL(o && o.url);
    if (u.protocol !== 'https:' || u.hostname !== 'api.github.com' || !/^\/gists(\/|\?|$)/.test(u.pathname + (u.search ? '?' : ''))) throw new Error('host_blocked');
    const method = ['GET', 'POST', 'PATCH'].includes(o.method) ? o.method : 'GET';
    const headers = { 'User-Agent': 'LanceALance/1.0 (app pessoal de estudo)', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + String(o.token || '') };
    if (o.body) headers['Content-Type'] = 'application/json';
    const r = await net.fetch(u.toString(), { method, headers, body: o.body || undefined });
    return { status: r.status, text: await r.text() };
  });
  const win = createWindow();
  setupShellUpdates(win);
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
// Atualização da casca (instalador do Windows). A versão portátil não se atualiza sozinha.
function setupShellUpdates(win) {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  let autoUpdater; try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => { if (!win.isDestroyed()) win.webContents.send('shell-update-ready', info && info.version); });
  autoUpdater.on('error', () => {});
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000); setInterval(check, 6 * 60 * 60 * 1000);
  ipcMain.handle('installShellUpdate', () => { setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
