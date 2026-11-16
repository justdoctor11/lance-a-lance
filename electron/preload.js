const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('native', {
  platform: 'windows',
  fetchText: url => ipcRenderer.invoke('fetchText', url).catch(e => { const m = String(e && e.message || e); throw { code: /nouser/.test(m) ? 'nouser' : (m.match(/http_\d+/) || ['rede'])[0] }; })
});
