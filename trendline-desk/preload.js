const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trendline", {
  history: (symbol) => ipcRenderer.invoke("history", symbol),
  getPrefs: () => ipcRenderer.invoke("prefs:get"),
  setPrefs: (ui) => ipcRenderer.invoke("prefs:set", ui),
  windowState: () => ipcRenderer.invoke("win:state"),
  setOnTop: (on) => ipcRenderer.invoke("win:onTop", on),
  setOpacity: (v) => ipcRenderer.invoke("win:opacity", v),
  setCompact: (on) => ipcRenderer.invoke("win:compact", on),
  minimize: () => ipcRenderer.invoke("win:minimize"),
  close: () => ipcRenderer.invoke("win:close"),
});
