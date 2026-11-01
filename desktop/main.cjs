const { app, BrowserWindow, shell, session, Menu, globalShortcut } = require("electron");

const APP_URL = "https://xlg77.github.io/roomchat/";
const APP_ORIGIN = new URL(APP_URL).origin;
const OVERLAY_CSS = `
  html,body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}
  #app-loading{display:none!important}
  .app-shell{display:block!important;width:100%!important;height:100vh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
  .app-shell>:not(.chat-panel){display:none!important}
  .chat-panel{display:flex!important;position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:rgba(112,112,112,.86)!important;overflow:hidden!important}
  .chat-panel>:not(#message-list):not(.composer-wrap){display:none!important}
  #message-list{display:block!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:4px 8px!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important}
  .message-item{max-width:100%!important;margin:0 0 2px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
  .message-content{overflow-wrap:anywhere!important;word-break:normal!important}
  .composer-wrap{display:block!important;flex:0 0 auto!important;margin:0!important;padding:4px!important;background:rgba(220,220,220,.94)!important;border-top:1px solid rgba(255,255,255,.6)!important}
  .composer{display:flex!important;gap:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
  .composer>:not(#message-input){display:none!important}
  #message-input{display:block!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;min-height:25px!important;max-height:64px!important;margin:0!important;padding:3px 6px!important;border:0!important;border-radius:0!important;outline:none!important;resize:none!important;background:rgba(255,255,255,.5)!important;color:#222!important;font:600 13px Arial,sans-serif!important}
  #message-input::placeholder{color:#555!important;opacity:1!important}
  .composer-foot,.toast,.mention-popup{display:none!important}
`;

app.setName("RoomChat");
app.setAppUserModelId("com.xlg77.roomchat");

let mainWindow = null;
let overlayMode = false;
let normalBounds = { width: 1440, height: 900, x: undefined, y: undefined };

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === APP_ORIGIN && url.pathname.startsWith("/roomchat/");
  } catch {
    return false;
  }
}

function applyOverlayStyles() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`
    (function(){
      const id='roomchat-windows-overlay-style';
      let style=document.getElementById(id);
      if(!style){style=document.createElement('style');style.id=id;document.head.appendChild(style);}
      style.textContent=${JSON.stringify(OVERLAY_CSS)};
      const input=document.querySelector('#message-input');
      if(input) input.placeholder='Tap here to chat';
    })();
  `).catch(() => {});
}

function setOverlayMode(enabled) {
  if (!mainWindow || mainWindow.isDestroyed() || overlayMode === enabled) return;
  if (enabled) {
    normalBounds = mainWindow.getBounds();
    overlayMode = true;
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setMinimumSize(360, 220);
    mainWindow.setResizable(true);
    mainWindow.setSize(480, 330);
    mainWindow.center();
    mainWindow.setTitle("RoomChat · 채팅 오버레이");
    mainWindow.setMenuBarVisibility(false);
    applyOverlayStyles();
  } else {
    overlayMode = false;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(900, 640);
    mainWindow.setResizable(true);
    mainWindow.setSize(Math.max(900, normalBounds.width), Math.max(640, normalBounds.height));
    if (Number.isFinite(normalBounds.x) && Number.isFinite(normalBounds.y)) {
      mainWindow.setPosition(normalBounds.x, normalBounds.y);
    } else {
      mainWindow.center();
    }
    mainWindow.setTitle("RoomChat");
    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.executeJavaScript("document.getElementById('roomchat-windows-overlay-style')?.remove()").catch(() => {});
  }
  buildAppMenu();
}

function buildAppMenu() {
  const template = [
    { label: "RoomChat", submenu: [
      { label: "채팅 오버레이 모드", type: "checkbox", checked: overlayMode, accelerator: "Ctrl+Shift+O", click: () => setOverlayMode(!overlayMode) },
      { type: "separator" },
      { role: "quit", label: "종료" }
    ]},
    { label: "보기", submenu: [
      { label: "채팅 오버레이 모드 전환", accelerator: "Ctrl+Shift+O", click: () => setOverlayMode(!overlayMode) },
      { type: "separator" },
      { role: "reload", label: "새로고침" },
      { role: "toggleDevTools", label: "개발자 도구" }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#e8f8ff",
    title: "RoomChat",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("did-finish-load", () => {
    if (overlayMode) applyOverlayStyles();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url) && !isTrustedAppUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL);
  buildAppMenu();
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    callback(isTrustedAppUrl(requestingUrl) && permission === "notifications");
  });

  createWindow();
  globalShortcut.register("CommandOrControl+Shift+O", () => setOverlayMode(!overlayMode));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
