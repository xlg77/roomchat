const { app, BrowserWindow, shell, session, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://xlg77.github.io/roomchat/";
const APP_ORIGIN = new URL(APP_URL).origin;
const OVERLAY_CSS = `
html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}
#app-loading{display:none!important}
.app-shell{display:block!important;width:100%!important;height:100vh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
.app-shell>:not(.chat-panel){display:none!important}
.chat-panel{display:block!important;position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:hidden!important}
.chat-panel>:not(#message-list):not(.composer-wrap):not(#roomchat-overlay-toolbar):not(#roomchat-overlay-restore){display:none!important}
#roomchat-overlay-toolbar{position:absolute!important;top:6px!important;left:8px!important;right:8px!important;z-index:5!important;display:flex!important;align-items:center!important;gap:7px!important;height:25px!important;padding:0 5px!important;background:rgba(0,0,0,.28)!important;border-radius:6px!important;-webkit-app-region:drag!important;cursor:move!important}
#roomchat-overlay-toolbar .overlay-drag-handle{display:inline-flex!important;align-items:center!important;flex:1 1 auto!important;height:25px!important;padding-left:5px!important;color:#fff!important;font:700 12px Segoe UI,Arial,sans-serif!important;letter-spacing:.2px!important;-webkit-app-region:drag!important;user-select:none!important}
#roomchat-overlay-toolbar button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:25px!important;height:25px!important;margin:0!important;padding:0!important;border:0!important;border-radius:6px!important;background:rgba(255,255,255,.94)!important;color:#222!important;box-shadow:0 1px 4px #0005!important;cursor:pointer!important;font:700 17px Arial,sans-serif!important;-webkit-app-region:no-drag!important}
#roomchat-overlay-toolbar .overlay-controls{display:flex!important;margin-left:auto!important}
#roomchat-overlay-toolbar .overlay-controls button{background:rgba(25,25,25,.58)!important;color:#fff!important}
#message-list{position:absolute!important;top:37px!important;left:8px!important;right:40px!important;bottom:43px!important;display:block!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:5px 7px!important;margin:0!important;background:rgba(0,0,0,.55)!important;border:0!important;border-radius:0!important;color:#fff!important}
#message-list:empty:before{content:"Chat /? or /help for a list of chat commands.";display:block;color:#f4f4f4;font:600 13px Georgia,serif;line-height:17px}
.message-item{max-width:100%!important;margin:0 0 2px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:#fff!important;font:600 13px Georgia,serif!important}
.message-content{overflow-wrap:anywhere!important;word-break:normal!important;color:#fff!important}
.composer-wrap{position:absolute!important;left:8px!important;right:40px!important;bottom:7px!important;z-index:4!important;display:block!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important}
.composer-wrap form{display:flex!important;gap:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.composer-wrap form>:not(#message-input):not(#send-button){display:none!important}
#message-input{display:block!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;height:29px!important;min-height:29px!important;max-height:29px!important;margin:0!important;padding:4px 7px!important;border:0!important;border-radius:0!important;outline:none!important;resize:none!important;background:rgba(225,225,225,.78)!important;color:#222!important;font:600 13px Georgia,serif!important;box-shadow:none!important}
#message-input::placeholder{color:#555!important;opacity:1!important}
#send-button{display:none!important}
.composer-foot,.toast,.mention-popup{display:none!important}
.chat-panel.roomchat-overlay-folded #message-list,.chat-panel.roomchat-overlay-folded .composer-wrap{display:none!important}
#roomchat-overlay-restore{display:none!important;position:absolute!important;right:8px!important;bottom:8px!important;width:38px!important;height:38px!important;border:0!important;border-radius:50%!important;background:#2676c9!important;color:#fff!important;font-size:18px!important}
.chat-panel.roomchat-overlay-folded #roomchat-overlay-restore{display:flex!important;align-items:center!important;justify-content:center!important}
`;


app.setName("RoomChat");
app.setAppUserModelId("com.xlg77.roomchat");

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  let updateCheckInProgress = false;
  const checkForUpdates = async () => {
    if (updateCheckInProgress) return;
    updateCheckInProgress = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error("[RoomChat update check]", error);
    } finally {
      updateCheckInProgress = false;
    }
  };
  autoUpdater.on("error", (error) => console.error("[RoomChat updater]", error));
  autoUpdater.on("update-downloaded", async () => {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["지금 재시작", "나중에"],
      defaultId: 0,
      cancelId: 1,
      title: "RoomChat 업데이트 준비 완료",
      message: "새 버전 다운로드가 완료됐어요.",
      detail: "지금 재시작하면 RoomChat이 자동으로 업데이트됩니다."
    });
    if (choice.response === 0) autoUpdater.quitAndInstall();
  });
  // Check shortly after launch, then retry every minute.
  setTimeout(checkForUpdates, 5000);
  setInterval(checkForUpdates, 60 * 1000);
}


let mainWindow = null;
let toggleButtonWindow = null;
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

function createOverlayToggleButtonWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`
    (() => {
      let button = document.getElementById('roomchat-overlay-toggle');
      if (!button) {
        button = document.createElement('button');
        button.id = 'roomchat-overlay-toggle';
        button.type = 'button';
        button.style.cssText = 'position:fixed!important;top:12px!important;right:14px!important;z-index:2147483647!important;padding:9px 14px!important;border:0!important;border-radius:9px!important;background:#2676c9!important;color:#fff!important;font:700 13px Segoe UI,Arial,sans-serif!important;box-shadow:0 2px 10px #0004!important;cursor:pointer!important;';
        button.addEventListener('click', () => window.open('roomchat://toggle-overlay'));
        document.body.appendChild(button);
      }
      button.textContent = ${JSON.stringify(overlayMode ? "오버레이 끄기" : "오버레이 켜기")};
    })();
  `).catch(error => console.error('[RoomChat overlay button]', error));
}

function updateOverlayToggleButton() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`
    const button = document.getElementById('roomchat-overlay-toggle');
    if (button) button.textContent = ${JSON.stringify(overlayMode ? "오버레이 끄기" : "오버레이 켜기")};
  `).catch(() => {});
}

function positionOverlayToggleButton() {
  // The button is fixed inside the RoomChat page, so it follows the window automatically.
}

function applyOverlayStyles() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`
    (function(){
      const id='roomchat-windows-overlay-style';
      let style=document.getElementById(id);
      if(!style){style=document.createElement('style');style.id=id;document.head.appendChild(style);}
      style.textContent=${JSON.stringify(OVERLAY_CSS)};
      const panel=document.querySelector('.chat-panel');
      if(panel && !document.getElementById('roomchat-overlay-toolbar')){
        const bar=document.createElement('div');
        bar.id='roomchat-overlay-toolbar';
        bar.innerHTML='<span class="overlay-drag-handle" title="여기를 잡고 오버레이 창 이동">RoomChat · 오버레이</span><button type="button" title="채팅">◇</button><span class="overlay-controls"><button type="button" data-action="fold" title="접기">－</button></span>';
        panel.prepend(bar);
        bar.addEventListener('click',event=>{
          const action=event.target?.dataset?.action;
          if(action==='fold') panel.classList.add('roomchat-overlay-folded');
        });
        const restore=document.createElement('button');
        restore.id='roomchat-overlay-restore';
        restore.type='button';
        restore.title='채팅 다시 열기';
        restore.textContent='R';
        restore.addEventListener('click',()=>panel.classList.remove('roomchat-overlay-folded'));
        panel.append(restore);
      }
      const input=document.querySelector('#message-input');
      if(input) input.placeholder='To chat click here or press "/" key';
    })();
  `).catch(() => {});
}

function setOverlayMode(enabled) {
  if (!mainWindow || mainWindow.isDestroyed() || overlayMode === enabled) return;
  if (enabled) {
    normalBounds = mainWindow.getBounds();
    overlayMode = true;
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setMovable(true);
    mainWindow.setOpacity(0.88);
    mainWindow.setBackgroundColor("#00000000");
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setMinimumSize(360, 220);
    mainWindow.setResizable(true);
    mainWindow.setSize(400, 260);
    mainWindow.center();
    mainWindow.setTitle("RoomChat · 채팅 오버레이");
    mainWindow.setMenuBarVisibility(false);
    applyOverlayStyles();
    updateOverlayToggleButton();
  } else {
    overlayMode = false;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setOpacity(1);
    mainWindow.setBackgroundColor("#e8f8ff");
    mainWindow.setIgnoreMouseEvents(false);
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
    mainWindow.webContents.executeJavaScript("document.getElementById('roomchat-windows-overlay-style')?.remove();document.getElementById('roomchat-overlay-toolbar')?.remove();document.getElementById('roomchat-overlay-restore')?.remove();document.querySelector('.chat-panel')?.classList.remove('roomchat-overlay-folded')").catch(() => {});
  }
  updateOverlayToggleButton();
  positionOverlayToggleButton();
  buildAppMenu();
}

function buildAppMenu() {
  const template = [
    { label: "RoomChat", submenu: [
      { label: "채팅 오버레이 모드", type: "checkbox", checked: overlayMode, click: () => setOverlayMode(!overlayMode) },
      { type: "separator" },
      { role: "quit", label: "종료" }
    ]},
    { label: "보기", submenu: [
      { label: "채팅 오버레이 모드 전환", click: () => setOverlayMode(!overlayMode) },
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
    backgroundColor: "#00000000",
    transparent: true,
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
    createOverlayToggleButtonWindow();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "roomchat://toggle-overlay") {
      setOverlayMode(!overlayMode);
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
      return { action: "deny" };
    }
    if (/^https:\/\//i.test(url) && !isTrustedAppUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on("move", positionOverlayToggleButton);
  mainWindow.on("resize", positionOverlayToggleButton);
  mainWindow.on("show", () => { if (toggleButtonWindow && !toggleButtonWindow.isDestroyed()) toggleButtonWindow.showInactive(); });
  mainWindow.on("hide", () => { if (toggleButtonWindow && !toggleButtonWindow.isDestroyed()) toggleButtonWindow.hide(); });
  mainWindow.on("closed", () => {
    if (toggleButtonWindow && !toggleButtonWindow.isDestroyed()) toggleButtonWindow.close();
    toggleButtonWindow = null;
    mainWindow = null;
  });
  mainWindow.loadURL(APP_URL);
  buildAppMenu();
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    callback(isTrustedAppUrl(requestingUrl) && permission === "notifications");
  });

  createWindow();
  setupAutoUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
