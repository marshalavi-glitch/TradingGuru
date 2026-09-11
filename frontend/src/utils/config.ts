let cachedBackendUrl: string | null = null;
let lastFetchTime = 0;

export function clearBackendUrlCache(): void {
  cachedBackendUrl = null;
  lastFetchTime = 0;
}

export async function resolveBackendUrl(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (forceRefresh) {
    cachedBackendUrl = null;
  } else if (cachedBackendUrl && (now - lastFetchTime < 15000)) {
    return cachedBackendUrl;
  }

  // 1. Check if user explicitly set a custom backend URL in localStorage
  const saved = typeof window !== 'undefined' ? localStorage.getItem('TRADING_GURU_BACKEND_URL') : null;
  if (saved && saved.trim()) {
    let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const proto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https' : 'http';
    cachedBackendUrl = `${proto}://${clean}`;
    lastFetchTime = now;
    return cachedBackendUrl;
  }

  // 2. Try fetching live_backend.json from relative URL and HF Space raw URL
  const fetchUrls = [
    typeof window !== 'undefined' ? `${window.location.origin}/live_backend.json` : null,
    'https://huggingface.co/spaces/marshalavi/TradingGuru/raw/main/live_backend.json'
  ].filter(Boolean) as string[];

  for (const url of fetchUrls) {
    try {
      const res = await fetch(`${url}?_t=${now}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.backendUrl) {
          let clean = json.backendUrl.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
          const proto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https' : 'http';
          cachedBackendUrl = `${proto}://${clean}`;
          lastFetchTime = now;
          console.log(`[Config] Resolved active live backend URL: ${cachedBackendUrl}`);
          return cachedBackendUrl;
        }
      }
    } catch (e) {
      // Continue to next fetch attempt
    }
  }

  // 3. Fallback to localhost:3002 or active Cloudflare Tunnel
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    cachedBackendUrl = 'http://localhost:3002';
  } else {
    cachedBackendUrl = 'https://almost-vaccine-partly-shift.trycloudflare.com';
  }

  lastFetchTime = now;
  return cachedBackendUrl;
}

// Immediate eager execution of resolveBackendUrl on module load
if (typeof window !== 'undefined') {
  resolveBackendUrl().catch(() => {});
}

export function getBackendHttpUrlSync(): string {
  if (cachedBackendUrl) return cachedBackendUrl;
  const saved = typeof window !== 'undefined' ? localStorage.getItem('TRADING_GURU_BACKEND_URL') : null;
  if (saved && saved.trim()) {
    let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const proto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https' : 'http';
    return `${proto}://${clean}`;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3002';
  }
  return 'https://christina-tip-garbage-module.trycloudflare.com';
}
