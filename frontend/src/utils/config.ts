let cachedBackendUrl: string | null = null;
let lastFetchTime = 0;
let pendingResolvePromise: Promise<string> | null = null;

export const DEFAULT_FALLBACK_URLS = [
  'https://monday-willing-kills-aerial.trycloudflare.com',
  'https://revenue-substantially-advantages-expanded.trycloudflare.com',
  'https://lists-characterized-patients-appreciated.trycloudflare.com',
  'https://sharp-taxis-smash.loca.lt'
];

// Global fetch interceptor: Automatically attaches 'bypass-tunnel-reminder: true'
// so Localtunnel never serves the HTML landing page to ANY container
if (typeof window !== 'undefined' && !(window as any).__fetchBypassInstalled) {
  (window as any).__fetchBypassInstalled = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const urlStr = typeof input === 'string'
        ? input
        : (input instanceof Request ? input.url : input.toString());

      if (
        urlStr.includes('/api/') ||
        urlStr.includes('loca.lt') ||
        urlStr.includes('trycloudflare.com') ||
        urlStr.includes('tunnelmole')
      ) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
        if (!headers.has('bypass-tunnel-reminder')) {
          headers.set('bypass-tunnel-reminder', 'true');
        }
        init = { ...init, headers };
      }
    } catch (e) {}
    return originalFetch.call(this, input, init);
  };
}

export function clearBackendUrlCache(): void {
  cachedBackendUrl = null;
  lastFetchTime = 0;
  pendingResolvePromise = null;
}

export async function pingHealth(url: string, timeoutMs = 2500): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

  // Never allow insecure HTTP on an HTTPS origin
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    return false;
  }

  try {
    const clean = url.replace(/\/+$/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    const res = await fetch(`${clean}/health?_t=${Date.now()}`, {
      signal: ctrl.signal,
      headers: { 'bypass-tunnel-reminder': 'true' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'OK' || data.project)) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

export async function resolveBackendUrl(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (forceRefresh) {
    clearBackendUrlCache();
  } else if (cachedBackendUrl && (now - lastFetchTime < 15000)) {
    return cachedBackendUrl;
  }

  if (pendingResolvePromise) {
    return pendingResolvePromise;
  }

  pendingResolvePromise = (async () => {
    try {
      // 1. Check if user explicitly set a custom backend URL in localStorage
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('TRADING_GURU_BACKEND_URL');
        if (saved && saved.trim()) {
          // Immediately purge old broken tunnels (like bore.pub)
          if (saved.includes('bore.pub') || saved.includes('serveousercontent') || saved.includes('undefined')) {
            localStorage.removeItem('TRADING_GURU_BACKEND_URL');
          } else {
            let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
            const proto = window.location.protocol === 'https:' ? 'https' : 'http';
            const candidate = `${proto}://${clean}`;
            
            // Verify it is actually responding
            const isAlive = await pingHealth(candidate, 2000);
            if (isAlive) {
              cachedBackendUrl = candidate;
              lastFetchTime = now;
              return cachedBackendUrl;
            } else {
              console.warn(`[Config] Saved backend URL ${candidate} unreachable, clearing...`);
              localStorage.removeItem('TRADING_GURU_BACKEND_URL');
            }
          }
        }
      }

      // 1.5. If running on localhost / 127.0.0.1, prioritize local server for 0ms latency
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const localCandidate = 'http://localhost:3002';
        const isLocalAlive = await pingHealth(localCandidate, 1500);
        if (isLocalAlive) {
          cachedBackendUrl = localCandidate;
          lastFetchTime = now;
          return cachedBackendUrl;
        }
      }

      // 2. Fetch live_backend.json from high-priority accessible endpoints
      const fetchUrls = [
        typeof window !== 'undefined' ? `${window.location.origin}/live_backend.json` : null,
        'https://marshalavi-tradingguru-terminal.static.hf.space/live_backend.json',
        'https://huggingface.co/spaces/marshalavi/TradingGuru-Terminal/raw/main/live_backend.json',
        'https://marshalavi-tradingguru.hf.space/live_backend.json',
        'https://marshalavi-tradingguru.static.hf.space/live_backend.json',
        'https://huggingface.co/spaces/marshalavi/TradingGuru/raw/main/live_backend.json'
      ].filter(Boolean) as string[];

      let discoveredJson: any = null;

      for (const url of fetchUrls) {
        try {
          const res = await fetch(`${url}?_t=${now}`, {
            cache: 'no-store',
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          if (res.ok) {
            const json = await res.json();
            if (json && (json.backendUrl || json.backupUrl || json.cloudflareUrl)) {
              discoveredJson = json;
              break;
            }
          }
        } catch (e) {
          // Continue to next URL
        }
      }

      // 3. Test discovered candidates + built-in fallback tunnels with pingHealth
      const rawCandidates: string[] = [];
      if (discoveredJson) {
        if (discoveredJson.backendUrl) rawCandidates.push(discoveredJson.backendUrl);
        if (discoveredJson.backupUrl) rawCandidates.push(discoveredJson.backupUrl);
        if (discoveredJson.cloudflareUrl) rawCandidates.push(discoveredJson.cloudflareUrl);
        if (discoveredJson.localtunnelUrl) rawCandidates.push(discoveredJson.localtunnelUrl);
      }
      for (const defUrl of DEFAULT_FALLBACK_URLS) {
        if (!rawCandidates.includes(defUrl)) {
          rawCandidates.push(defUrl);
        }
      }

      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

      for (const raw of rawCandidates) {
        let clean = raw.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const proto = isHttpsPage ? 'https' : (raw.startsWith('http://') ? 'http' : 'https');
        const candidate = `${proto}://${clean}`;

        // Avoid plain HTTP on HTTPS pages
        if (isHttpsPage && candidate.startsWith('http://')) continue;

        console.log(`[Config] Testing candidate backend URL: ${candidate}...`);
        const alive = await pingHealth(candidate, 5000);
        if (alive) {
          cachedBackendUrl = candidate;
          lastFetchTime = now;
          console.log(`✅ [Config] Connected to verified LIVE backend: ${cachedBackendUrl}`);
          return cachedBackendUrl;
        }
      }

      // If none responded to pingHealth (e.g. transient network latency), fallback to the first HTTPS candidate
      for (const raw of rawCandidates) {
        let clean = raw.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const proto = isHttpsPage ? 'https' : 'http';
        cachedBackendUrl = `${proto}://${clean}`;
        lastFetchTime = now;
        return cachedBackendUrl;
      }

      // 4. Localhost Fallback
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        cachedBackendUrl = 'http://localhost:3002';
      } else {
        cachedBackendUrl = DEFAULT_FALLBACK_URLS[0];
      }

      lastFetchTime = now;
      return cachedBackendUrl;
    } finally {
      pendingResolvePromise = null;
    }
  })();

  return pendingResolvePromise;
}

// Background auto-healer: Periodically verifies active backend health
if (typeof window !== 'undefined') {
  resolveBackendUrl().catch(() => {});
  setInterval(async () => {
    if (cachedBackendUrl) {
      const alive = await pingHealth(cachedBackendUrl, 5000);
      if (!alive) {
        console.warn(`[Config Auto-Healer] Active backend ${cachedBackendUrl} unresponsive. Re-resolving...`);
        resolveBackendUrl(true).catch(() => {});
      }
    }
  }, 20000);
}

export function getBackendHttpUrlSync(): string {
  if (cachedBackendUrl) return cachedBackendUrl;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3002';
  }
  return DEFAULT_FALLBACK_URLS[0];
}
