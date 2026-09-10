let cachedBackendUrl: string | null = null;
let lastFetchTime = 0;

export async function resolveBackendUrl(): Promise<string> {
  const now = Date.now();
  if (cachedBackendUrl && (now - lastFetchTime < 30000)) {
    return cachedBackendUrl;
  }

  // 1. Check localStorage override
  const saved = typeof window !== 'undefined' ? localStorage.getItem('TRADING_GURU_BACKEND_URL') : null;
  if (saved && saved.trim()) {
    let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const proto = window.location.protocol === 'https:' ? 'https' : 'http';
    cachedBackendUrl = `${proto}://${clean}`;
    lastFetchTime = now;
    return cachedBackendUrl;
  }

  // 2. Fetch live_backend.json from HF raw repository URL with no-store
  try {
    const rawHfUrl = 'https://huggingface.co/spaces/marshalavi/TradingGuru/raw/main/live_backend.json';
    const res = await fetch(`${rawHfUrl}?_t=${now}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.backendUrl) {
        let clean = json.backendUrl.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const proto = window.location.protocol === 'https:' ? 'https' : 'http';
        cachedBackendUrl = `${proto}://${clean}`;
        lastFetchTime = now;
        return cachedBackendUrl;
      }
    }
  } catch (e) {
    // Ignore fetch failure, fall through
  }

  // 3. Fallback to localhost:3002 or window.location.origin
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    cachedBackendUrl = 'http://localhost:3002';
  } else {
    cachedBackendUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
  }

  lastFetchTime = now;
  return cachedBackendUrl;
}

export function getBackendHttpUrlSync(): string {
  if (cachedBackendUrl) return cachedBackendUrl;
  const saved = typeof window !== 'undefined' ? localStorage.getItem('TRADING_GURU_BACKEND_URL') : null;
  if (saved && saved.trim()) {
    let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const proto = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${clean}`;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3002';
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
}
