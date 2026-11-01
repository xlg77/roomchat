const { app, BrowserWindow, shell, session, Menu } = require("electron");

const APP_URL = "https://xlg77.github.io/roomchat/";
const APP_ORIGIN = new URL(APP_URL).origin;
const OVERLAY_CSS = `
  html,body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}
  #app-loading{display:none!important}
  #roomchat-overlay-toggle{position:fixed!important;top:10px!important;right:12px!important;z-index:2147483647!important;padding:8px 13px!important;border:0!important;border-radius:9px!important;background:#2676c9!important;color:#fff!important;font:600 12px Arial,sans-serif!important;box-shadow:0 2px 10px #0003!important;cursor:pointer!important;-webkit-app-region:no-drag!important}
  .app-shell{display:block!important;width:100%!important;height:100vh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
  .app-shell>:not(.chat-panel){display:none!important}
  .chat-panel{display:flex!important;flex-direction:column!important;position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:rgba(112,130,148,.94)!important;overflow:hidden!important}
  .chat-panel>:not(#message-list):not(.composer-wrap):not(#roomchat-overlay-toolbar){display:none!important}
  #roomchat-overlay-toolbar{display:flex!important;align-items:center!important;justify-content:space-between!important;flex:0 0 27px!important;height:27px!important;padding:0 7px!important;background:rgba(35,92,150,.96)!important;color:#fff!important;font:600 12px Arial,sans-serif!important;-webkit-app-region:drag!important;user-select:none!important}
  #roomchat-overlay-toolbar button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:25px!important;height:22px!important;margin-left:5px!important;border:0!important;border-radius:5px!important;background:rgba(255,255,255,.18)!important;color:#fff!important;font:600 14px Arial,sans-serif!important;cursor:pointer!important;-webkit-app-region:no-drag!important}
  #roomchat-overlay-toolbar .overlay-controls{display:flex!important;-webkit-app-region:no-drag!important}
  #message-list{display:block!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:5px 8px!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important}
  .message-item{max-width:100%!important;margin:0 0 2px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
  .message-content{overflow-wrap:anywhere!important;word-break:normal!important}
  .composer-wrap{display:block!important;flex:0 0 auto!important;margin:0!important;padding:4px!important;background:rgba(226,235,243,.97)!important;border-top:1px solid rgba(255,255,255,.6)!important}
  .composer-wrap form{display:flex!important;gap:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
  .composer-wrap form>:not(#message-input):not(#send-button){display:none!important}
  #message-input{display:block!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;min-height:27px!important;max-height:70px!important;margin:0!important;padding:4px 7px!important;border:1px solid #b8c8d8!important;border-radius:6px!important;outline:none!important;resize:none!important;background:#fff!important;color:#222!important;font:600 13px Arial,sans-serif!important}
  #message-input::placeholder{color:#555!important;opacity:1!important}
  #send-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;margin-left:5px!important;padding:0 9px!important;border:0!important;border-radius:6px!important;background:#2676c9!important;color:#fff!important;font-size:12px!important}
  .composer-foot,.toast,.mention-popup{display:none!important}
  .chat-panel.roomchat-overlay-folded #message-list{display:none!important}
  .chat-panel.roomchat-overlay-folded .composer-wrap{display:none!important}
  .chat-panel.roomchat-overlay-folded{background:transparent!important}
  #roomchat-overlay-restore{display:none!important;position:absolute!important;right:8px!important;bottom:8px!important;width:38px!important;height:38px!important;border:0!important;border-radius:50%!important;background:#2676c9!important;color:#fff!important;font-size:18px!important;box-shadow:0 2px 10px #0005!important;cursor:pointer!important}
  .chat-panel.roomchat-overlay-folded #roomchat-overlay-restore{display:flex!important;align-items:center!important;justify-content:center!important}
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

function injectOverlayToggleButton() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const label = overlayMode ? "오버레이 끄기" : "오버레이 켜기";
  const script = '(function(){let b=document.getElementById("roomchat-overlay-toggle");if(!b){b=document.createElement("button");b.id="roomchat-overlay-toggle";b.type="button";b.addEventListener("click",()=>window.open("roomchat://toggle-overlay"));document.body.appendChild(b);}b.textContent=' + JSON.stringify(label) + ';b.title="RoomChat 오버레이 모드 전환";b.style.cssText="position:fixed;top:10px;right:12px;z-index:2147483647;padding:8px 13px;border:0;border-radius:9px;background:#2676c9;color:#fff;font:600 12px Arial,sans-serif;box-shadow:0 2px 10px #0003;cursor:pointer;-webkit-app-region:no-drag";})();';
  mainWindow.webContents.executeJavaScript(script).catch(() => {});
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
        bar.innerHTML='<span>RoomChat · 오버레이</span><span class="overlay-controls"><button type="button" data-action="fold" title="접기">－</button></span>';
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
      if(input) input.placeholder='메시지 입력…';
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
    injectOverlayToggleButton();
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
    mainWindow.webContents.executeJavaScript("document.getElementById('roomchat-windows-overlay-style')?.remove();document.getElementById('roomchat-overlay-toolbar')?.remove();document.getElementById('roomchat-overlay-restore')?.remove();document.querySelector('.chat-panel')?.classList.remove('roomchat-overlay-folded')").catch(() => {});
  }
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
    injectOverlayToggleButton();
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
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
