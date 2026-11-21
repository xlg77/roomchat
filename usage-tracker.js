import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const STORAGE_KEY = 'roomchat:public-usage-session:v1';
const HEARTBEAT_MS = 30_000;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function getSessionId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const sessionId = getSessionId();
let activeSince = document.visibilityState === 'visible' ? Date.now() : 0;
let heartbeat = 0;
let sending = false;

async function record(seconds) {
  if (sending || seconds <= 0) return;
  sending = true;
  try {
    await supabase.rpc('roomchat_record_usage', {
      p_session_id: sessionId,
      p_seconds: Math.min(45, Math.max(0, Math.floor(seconds))),
    });
  } catch (error) {
    console.debug('[RoomChat usage] heartbeat skipped', error);
  } finally {
    sending = false;
  }
}

function flush() {
  if (!activeSince) return;
  const elapsed = Math.min(45, (Date.now() - activeSince) / 1000);
  activeSince = Date.now();
  void record(elapsed);
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flush();
    activeSince = 0;
  } else if (!activeSince) {
    activeSince = Date.now();
  }
}

document.addEventListener('visibilitychange', onVisibilityChange);
window.addEventListener('pagehide', flush);
heartbeat = window.setInterval(() => {
  if (document.visibilityState === 'visible') flush();
}, HEARTBEAT_MS);
window.addEventListener('beforeunload', () => {
  if (heartbeat) window.clearInterval(heartbeat);
});
