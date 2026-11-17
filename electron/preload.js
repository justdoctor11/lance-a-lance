const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('native', {
  platform: 'windows',
  portable: !!process.env.PORTABLE_EXECUTABLE_DIR,
  fetchText: url => ipcRenderer.invoke('fetchText', url).catch(e => { const m = String(e && e.message || e); throw { code: /nouser/.test(m) ? 'nouser' : (m.match(/http_\d+/) || ['rede'])[0] }; }),
  installShellUpdate: () => ipcRenderer.invoke('installShellUpdate'),
  gh: o => ipcRenderer.invoke('gh', o)
});
// avisa a página quando o instalador novo já foi baixado
ipcRenderer.on('shell-update-ready', (_e, v) => window.dispatchEvent(new CustomEvent('lal-shell-ready', { detail: { version: v || '' } })));
