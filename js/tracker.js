/**
 * dytth_young - Site Telemetry
 */
const CLIENT_ID_KEY = '_dytth_cid';

function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId || !/^u_[a-zA-Z0-9_-]{6,64}$/.test(clientId)) {
    clientId = `u_${crypto.randomUUID?.() || `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

export function initTracker(endpoint) {
  try {
    const payload = {
      site: location.hostname || 'dytth.is-a.dev',
      path: location.pathname || '/',
      ref: document.referrer ? new URL(document.referrer).hostname : 'Direct',
      device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
      cid: getClientId()
    };

    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}
