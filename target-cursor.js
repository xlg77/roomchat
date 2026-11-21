const CORNER_ANGLES = [0, 90, 180, 270];
const QUARTER = Math.PI / 2;

function spring(state, goal, stiffness, damping, dt) {
  const steps = 2;
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
}

const DEFAULT_TARGETS = [
  'button:not(:disabled)', 'a[href]', 'input:not(:disabled)', 'textarea:not(:disabled)',
  'select:not(:disabled)', '[role="button"]', '[role="tab"]', '[data-cursor-target]',
  '.room-item', '.mobile-room-chip', '.attach-button', '.message-image-link'
].join(',');

export default function initTargetCursor(options = {}) {
  if (window.__roomchatTargetCursorCleanup) window.__roomchatTargetCursorCleanup();

  const settings = {
    targetSelector: options.targetSelector || DEFAULT_TARGETS,
    cursorColor: options.cursorColor || '#ffffff',
    cursorColorOnTarget: options.cursorColorOnTarget || '#ffffff',
    spinDuration: options.spinDuration ?? 2,
    hoverDuration: Math.max(0.05, options.hoverDuration ?? 0.2),
    parallaxOn: options.parallaxOn ?? true,
    hideDefaultCursor: options.hideDefaultCursor ?? true,
    size: Math.max(4, options.size ?? 36),
    cornerSize: Math.max(2, options.cornerSize ?? 12),
    thickness: Math.max(0.5, options.thickness ?? 3),
    padding: options.padding ?? 6,
    matchRadius: options.matchRadius ?? true,
    dotSize: Math.max(0, options.dotSize ?? 4),
    showLabel: options.showLabel ?? true,
    clickEffect: options.clickEffect ?? true
  };

  const root = document.createElement('div');
  root.className = 'target-cursor';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__dot"></span><span class="target-cursor__label"></span>';
  document.body.append(root);

  const corners = [...root.querySelectorAll('.target-cursor__corner')];
  const dot = root.querySelector('.target-cursor__dot');
  const label = root.querySelector('.target-cursor__label');
  const style = document.createElement('style');
  document.head.append(style);

  const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false, touch: false };
  const centerX = { x: 0, v: 0 }, centerY = { x: 0, v: 0 };
  const halfW = { x: 0, v: 0 }, halfH = { x: 0, v: 0 };
  const radius = { x: 0, v: 0 }, turn = { x: 0, v: 0 };
  const lock = { x: 0, v: 0 }, press = { x: 0, v: 0 }, presence = { x: 0, v: 0 };
  let target = null, targetRadius = 0, quarter = 0, spinSpeed = 0;
  let raf = 0, last = 0, lastLabel = '', lastColor = '', touchTimer = 0, destroyed = false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const findTarget = (x, y, element) => {
    const node = element || document.elementFromPoint(x, y);
    if (!node || !node.closest) return null;
    return node.closest(settings.targetSelector);
  };
  const lockOn = next => {
    if (next === target) return;
    target = next;
    if (target) {
      quarter = Math.round(turn.x / QUARTER);
      targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      spinSpeed = 0;
    }
  };
  const hideCursor = () => {
    const hide = settings.hideDefaultCursor && !pointer.touch && pointer.inside;
    const rule = hide ? 'html, html * { cursor: none !important; }' : '';
    if (style.textContent !== rule) style.textContent = rule;
  };

  const frame = now => {
    raf = 0;
    if (destroyed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (target && !target.isConnected) lockOn(null);
    const rect = target ? target.getBoundingClientRect() : null;
    const locked = !!rect && pointer.inside;
    const snapW = 4.6 / settings.hoverDuration;
    const snapK = snapW * snapW;
    const snapC = 2 * 0.62 * snapW;

    spring(presence, pointer.inside ? 1 : 0, 260, 32, dt);
    spring(lock, locked ? 1 : 0, snapK, 2 * snapW, dt);
    spring(press, pointer.pressed && settings.clickEffect ? 1 : 0, 900, 40, dt);

    let goalX = pointer.x, goalY = pointer.y;
    let goalW = settings.size / 2, goalH = settings.size / 2;
    let goalR = Math.min(2, settings.cornerSize / 4);
    if (locked) {
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const lean = settings.parallaxOn ? 0.08 : 0;
      goalX = cx + (pointer.x - cx) * lean;
      goalY = cy + (pointer.y - cy) * lean;
      const odd = Math.abs(quarter) % 2 === 1;
      goalW = (odd ? rect.height : rect.width) / 2 + settings.padding;
      goalH = (odd ? rect.width : rect.height) / 2 + settings.padding;
      goalR = settings.matchRadius ? Math.min(targetRadius + Math.max(0, settings.padding), settings.cornerSize) : 0;
    }

    if (!pointer.inside && presence.x < 0.01) pointer.seen = false;
    if (!pointer.seen) {
      centerX.x = goalX; centerY.x = goalY;
      halfW.x = goalW; halfH.x = goalH;
      pointer.seen = pointer.inside;
    }
    const follow = locked ? snapK : 2200;
    const followC = locked ? snapC : 2 * Math.sqrt(2200);
    spring(centerX, goalX, follow, followC, dt);
    spring(centerY, goalY, follow, followC, dt);
    spring(halfW, goalW, snapK, snapC, dt);
    spring(halfH, goalH, snapK, snapC, dt);
    spring(radius, goalR, snapK, 2 * snapW, dt);

    if (locked) spring(turn, quarter * QUARTER, snapK, snapC, dt);
    else {
      const speed = settings.spinDuration > 0 && !reduceMotion ? (Math.PI * 2) / settings.spinDuration : 0;
      spinSpeed += (speed - spinSpeed) * (1 - Math.exp(-dt * 3));
      turn.v = spinSpeed;
      turn.x += spinSpeed * dt;
    }

    const squeeze = 1 - press.x * 0.14;
    const cos = Math.cos(turn.x), sin = Math.sin(turn.x);
    const w = Math.max(0, halfW.x) * squeeze, h = Math.max(0, halfH.x) * squeeze;
    const local = [[-w,-h],[w,-h],[w,h],[-w,h]];
    const r = Math.max(0, Math.min(radius.x, settings.cornerSize));
    const degrees = turn.x * 180 / Math.PI;
    let left = Infinity, top = Infinity;
    corners.forEach((corner, i) => {
      const [lx, ly] = local[i];
      const x = centerX.x + lx * cos - ly * sin;
      const y = centerY.x + lx * sin + ly * cos;
      left = Math.min(left, x); top = Math.min(top, y);
      corner.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${(CORNER_ANGLES[i] + degrees).toFixed(2)}deg)`;
      corner.style.width = `${settings.cornerSize}px`;
      corner.style.height = `${settings.cornerSize}px`;
      corner.style.borderWidth = `${settings.thickness}px 0 0 ${settings.thickness}px`;
      corner.style.borderTopLeftRadius = `${r.toFixed(2)}px`;
    });
    dot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0) translate(-50%,-50%) scale(${(1 - press.x * 0.35).toFixed(3)})`;
    dot.style.width = `${settings.dotSize}px`;
    dot.style.height = `${settings.dotSize}px`;

    const text = settings.showLabel && target ? target.getAttribute('data-cursor-label') || '' : '';
    if (text && text !== lastLabel) label.textContent = lastLabel = text;
    const shown = text ? Math.max(0, Math.min(1, lock.x)) : 0;
    if (Number.isFinite(left) && Number.isFinite(top)) {
      label.style.transform = `translate3d(${left.toFixed(2)}px,${(top - 8).toFixed(2)}px,0) translateY(-100%) translateY(${((1 - shown) * 4).toFixed(2)}px)`;
    }
    label.style.opacity = shown.toFixed(3);

    const mix = settings.cursorColorOnTarget ? Math.round(Math.max(0, Math.min(1, lock.x)) * 100) : 0;
    const color = mix ? `color-mix(in oklab, ${settings.cursorColorOnTarget} ${mix}%, ${settings.cursorColor})` : settings.cursorColor;
    if (color !== lastColor) {
      root.style.setProperty('--target-cursor-color', color);
      lastColor = color;
    }
    root.style.opacity = Math.max(0, Math.min(1, presence.x)).toFixed(3);

    const resting = !pointer.inside && presence.x < 0.002 && Math.abs(presence.v) < 0.002 &&
      Math.abs(lock.x) < 0.002 && Math.abs(press.x) < 0.002;
    const spinning = pointer.inside && !locked && spinSpeed > 0.0001;
    const moving = Math.abs(centerX.v) + Math.abs(centerY.v) + Math.abs(halfW.v) + Math.abs(halfH.v) +
      Math.abs(turn.v) > 0.01 || Math.abs(goalX - centerX.x) + Math.abs(goalY - centerY.x) > 0.05 ||
      Math.abs(lock.v) + Math.abs(press.v) + Math.abs(presence.v) > 0.001;
    if (!resting && (spinning || moving || locked)) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  const wake = () => { if (!raf && !destroyed) raf = requestAnimationFrame(frame); };
  const onPointerMove = event => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointer.touch = false;
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.inside = true;
    lockOn(findTarget(pointer.x, pointer.y, event.target));
    hideCursor(); wake();
  };
  const onPointerDown = event => {
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.touch = event.pointerType === 'touch';
    pointer.inside = true; pointer.pressed = true;
    lockOn(findTarget(pointer.x, pointer.y, event.target));
    hideCursor(); wake();
    if (pointer.touch) {
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        pointer.pressed = false; pointer.inside = false; lockOn(null);
        hideCursor(); wake();
      }, 720);
    }
  };
  const onPointerUp = event => {
    pointer.pressed = false;
    if (event.pointerType === 'touch') {
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        pointer.inside = false; lockOn(null); hideCursor(); wake();
      }, 520);
    }
    wake();
  };
  const onPointerLeave = event => {
    if (event.pointerType !== 'mouse') return;
    pointer.inside = false; pointer.pressed = false; lockOn(null); hideCursor(); wake();
  };
  const onScroll = () => {
    if (!pointer.inside) return;
    lockOn(findTarget(pointer.x, pointer.y)); wake();
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('pointerout', onPointerLeave, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('blur', onPointerLeave);

  const cleanup = () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(touchTimer);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('pointerout', onPointerLeave);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('blur', onPointerLeave);
    style.remove(); root.remove();
    if (window.__roomchatTargetCursorCleanup === cleanup) delete window.__roomchatTargetCursorCleanup;
  };
  window.__roomchatTargetCursorCleanup = cleanup;
  return cleanup;
}

initTargetCursor();
