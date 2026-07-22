const { contextBridge, ipcRenderer } = require('electron');

// Minimal generic bridge — this is a local, personal, single-user app.
contextBridge.exposeInMainWorld('tutor', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, fn) => ipcRenderer.on(channel, (_event, ...args) => fn(...args)),
});
