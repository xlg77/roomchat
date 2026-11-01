const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("roomchatOverlay", {
  beginDrag: (x, y) => ipcRenderer.send("roomchat-overlay-drag", "start", x, y),
  moveDrag: (x, y) => ipcRenderer.send("roomchat-overlay-drag", "move", x, y),
  endDrag: (x, y) => ipcRenderer.send("roomchat-overlay-drag", "end", x, y)
});
