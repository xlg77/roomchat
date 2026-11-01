(() => {
  if (window.__roomchatFloatingOverlayLoaded) return;
  if (!window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) return;
  window.__roomchatFloatingOverlayLoaded = true;

  const css = document.createElement('style');
  css.textContent = `
    #rc-float-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;border:0;border-radius:999px;padding:12px 17px;background:#176bdb;color:#fff;font:700 13px system-ui;box-shadow:0 8px 28px #10294b44;cursor:pointer}
    #rc-float-window{position:fixed;right:22px;bottom:78px;z-index:99999;width:min(390px,calc(100vw - 24px));height:min(490px,calc(100dvh - 110px));min-width:260px;min-height:250px;display:none;flex-direction:column;overflow:hidden;resize:both;border:1px solid #ffffff35;border-radius:13px;background:rgba(13,17,24,.94);color:#f4f7fb;box-shadow:0 18px 55px #0007;backdrop-filter:blur(12px);font:13px system-ui,sans-serif}
    #rc-float-window.rc-open{display:flex}
    #rc-float-head{height:42px;min-height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;background:#ffffff0c;border-bottom:1px solid #ffffff20;cursor:grab;user-select:none;touch-action:none}
    #rc-float-head:active{cursor:grabbing}
    #rc-float-title{font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #rc-float-actions{display:flex;gap:5px}
    #rc-float-actions button{width:28px;height:27px;border:0;border-radius:6px;background:#ffffff16;color:#fff;font-size:17px;cursor:pointer}
    #rc-float-messages{flex:1;min-height:0;overflow:auto;padding:10px 12px;overscroll-behavior:contain}
    #rc-float-messages .message-list{display:block!important;overflow:visible!important;height:auto!important;max-height:none!important;padding:0!important;background:transparent!important}
    #rc-float-messages .message-item{max-width:100%}
    #rc-float-messages .message-content{overflow-wrap:anywhere}
    #rc-float-empty{color:#aab4c2;text-align:center;padding:24px 8px}
    #rc-float-form{display:flex;gap:7px;padding:9px;border-top:1px solid #ffffff20;background:#090d14}
    #rc-float-input{flex:1;min-width:0;max-height:90px;resize:none;border:1px solid #ffffff2b;border-radius:7px;background:#ffffff10;color:#fff;padding:9px 10px;font:13px system-ui;outline:none}
    #rc-float-input:focus{border-color:#62a5ff}
    #rc-float-send{border:0;border-radius:7px;background:#2879df;color:white;padding:0 13px;font-weight:700;cursor:pointer}
    @media(max-width:600px){#rc-float-launcher{right:12px;bottom:12px}#rc-float-window{right:12px;bottom:62px;width:calc(100vw - 24px);height:min(55dvh,430px);resize:none}}
    @media(prefers-reduced-motion:no-preference){#rc-float-window{animation:rcFloatIn .16s ease-out}@keyframes rcFloatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}}
  `;
  document.head.append(css);

  const launcher = document.createElement('button');
  launcher.id = 'rc-float-launcher';
  launcher.type = 'button';
  launcher.textContent = '▤ 채팅 오버레이';
  launcher.setAttribute('aria-controls', 'rc-float-window');
  launcher.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.id = 'rc-float-window';
  panel.setAttribute('aria-label', '플로팅 채팅창');
  panel.innerHTML = `
    <header id="rc-float-head">
      <strong id="rc-float-title"># 채팅</strong>
      <span id="rc-float-actions"><button type="button" id="rc-float-min" aria-label="최소화">−</button><button type="button" id="rc-float-close" aria-label="닫기">×</button></span>
    </header>
    <div id="rc-float-messages" aria-live="polite"><div id="rc-float-empty">메시지를 불러오는 중…</div></div>
    <form id="rc-float-form"><textarea id="rc-float-input" rows="1" maxlength="2000" placeholder="메시지 입력…" aria-label="오버레이 메시지 입력"></textarea><button id="rc-float-send" type="submit">전송</button></form>
  `;
  document.body.append(launcher, panel);

  const source = document.querySelector('#message-list');
  const sourceInput = document.querySelector('#message-input');
  const sourceForm = document.querySelector('#message-form');
  const roomTitle = document.querySelector('#current-room-name');
  const target = panel.querySelector('#rc-float-messages');
  const title = panel.querySelector('#rc-float-title');
  const input = panel.querySelector('#rc-float-input');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function open() {
    panel.classList.add('rc-open');
    launcher.setAttribute('aria-expanded', 'true');
    launcher.textContent = '▤ 채팅 숨기기';
    syncMessages();
    input.focus();
  }
  function close() {
    panel.classList.remove('rc-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.textContent = '▤ 채팅 오버레이';
  }
  function syncMessages() {
    if (roomTitle) title.textContent = '# ' + roomTitle.textContent.trim();
    if (!source) return;
    const wasNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 70;
    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.querySelectorAll('button,input,textarea,select').forEach((el) => {
      el.setAttribute('tabindex', '-1');
      el.setAttribute('aria-hidden', 'true');
    });
    target.replaceChildren(clone);
    if (!clone.children.length) target.innerHTML = '<div id="rc-float-empty">아직 메시지가 없어요.</div>';
    if (wasNearBottom) target.scrollTop = target.scrollHeight;
  }
  launcher.addEventListener('click', () => panel.classList.contains('rc-open') ? close() : open());
  panel.querySelector('#rc-float-close').addEventListener('click', close);
  panel.querySelector('#rc-float-min').addEventListener('click', close);

  panel.querySelector('#rc-float-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !sourceInput || !sourceForm) return;
    sourceInput.value = text;
    sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
    sourceForm.requestSubmit();
    input.value = '';
    input.style.height = 'auto';
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      panel.querySelector('#rc-float-form').requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  if (source) new MutationObserver(syncMessages).observe(source, { childList: true, subtree: true, characterData: true });
  if (roomTitle) new MutationObserver(syncMessages).observe(roomTitle, { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.room-item, .mobile-room-item, #rail-room-list button')) window.setTimeout(syncMessages, 80);
  });

  const saved = (() => { try { return JSON.parse(localStorage.getItem('roomchat:float-position:v1') || 'null'); } catch { return null; } })();
  if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    panel.style.left = clamp(saved.left, 0, innerWidth - 120) + 'px';
    panel.style.top = clamp(saved.top, 0, innerHeight - 100) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }
  const head = panel.querySelector('#rc-float-head');
  let drag = null;
  head.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const left = clamp(event.clientX - drag.x, 0, innerWidth - panel.offsetWidth);
    const top = clamp(event.clientY - drag.y, 0, innerHeight - 90);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });
  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    const rect = panel.getBoundingClientRect();
    try { localStorage.setItem('roomchat:float-position:v1', JSON.stringify({ left: rect.left, top: rect.top })); } catch {}
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    if (!panel.classList.contains('rc-open')) return;
    const rect = panel.getBoundingClientRect();
    if (rect.right > innerWidth || rect.bottom > innerHeight) {
      panel.style.left = clamp(rect.left, 0, innerWidth - panel.offsetWidth) + 'px';
      panel.style.top = clamp(rect.top, 0, innerHeight - panel.offsetHeight) + 'px';
    }
  });
  window.addEventListener('roomchat:overlay-refresh', syncMessages);
  syncMessages();
})();