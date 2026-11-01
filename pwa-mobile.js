(() => {
  const mobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  if (!mobile) return;

  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  let installEvent = null;
  const button = document.createElement('button');
  button.id = 'roomchat-pwa-install';
  button.type = 'button';
  button.textContent = '앱으로 설치';
  button.hidden = true;
  button.setAttribute('aria-label', 'RoomChat 앱 설치');
  const style = document.createElement('style');
  style.textContent = `
    #roomchat-pwa-install{position:fixed;z-index:99980;right:14px;top:calc(env(safe-area-inset-top) + 12px);border:0;border-radius:999px;padding:10px 14px;background:#176bdb;color:white;font:700 13px system-ui;box-shadow:0 5px 20px #12345b45}
    #roomchat-pwa-install[hidden]{display:none}
    #roomchat-pwa-help{position:fixed;z-index:99981;inset:auto 12px calc(env(safe-area-inset-bottom) + 12px);padding:16px;border:1px solid #d7e4f2;border-radius:14px;background:#fff;color:#1b2b3d;box-shadow:0 10px 36px #0003;font:14px/1.55 system-ui}
    #roomchat-pwa-help[hidden]{display:none}
    #roomchat-pwa-help button{margin-top:10px;border:0;border-radius:8px;background:#176bdb;color:#fff;padding:9px 13px;font-weight:700}
  `;
  document.head.append(style);
  document.body.append(button);
  const help = document.createElement('section');
  help.id = 'roomchat-pwa-help';
  help.hidden = true;
  help.innerHTML = '<strong>RoomChat을 홈 화면에 추가하기</strong><p>브라우저 메뉴에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 선택하세요. iPhone·iPad에서는 Safari의 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하면 돼요.</p><button type="button">확인</button>';
  document.body.append(help);
  help.querySelector('button').addEventListener('click', () => { help.hidden = true; });

  function updateVisibility() {
    button.hidden = standalone() || (!installEvent && !/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    updateVisibility();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    updateVisibility();
  });
  button.addEventListener('click', async () => {
    if (installEvent) {
      const promptEvent = installEvent;
      installEvent = null;
      await promptEvent.prompt();
      await promptEvent.userChoice;
      updateVisibility();
      return;
    }
    help.hidden = false;
  });
  updateVisibility();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/roomchat/sw.js', { scope: '/roomchat/' })
        .catch((error) => console.warn('RoomChat PWA service worker registration failed:', error));
    }, { once: true });
  }
})();