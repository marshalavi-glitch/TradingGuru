let cachedBackendUrl: string | null = (typeof window !== 'undefined' ? (sessionStorage.getItem('TRADING_GURU_RESOLVED_BACKEND') || null) : null);
let lastFetchTime = 0; // Force immediate verification on first call
let pendingResolvePromise: Promise<string> | null = null;

export const DEFAULT_FALLBACK_URLS = [
  'https://grip-codes-way-cigarettes.trycloudflare.com',
  'https://fresh-candies-think.loca.lt'
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
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('TRADING_GURU_RESOLVED_BACKEND');
    }
  } catch (e) {}
}

export function reportBackendFetchError(failedUrl?: string): void {
  if (!failedUrl || !cachedBackendUrl || failedUrl.includes(cachedBackendUrl) || cachedBackendUrl.includes(failedUrl)) {
    console.warn(`[Config] Fetch failure on active backend (${failedUrl || cachedBackendUrl}). Invalidation triggered.`);
    clearBackendUrlCache();
  }
}

export async function pingHealth(url: string, timeoutMs = 3500): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

  // Never allow insecure HTTP on an HTTPS origin
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    return false;
  }

  try {
    const clean = url.replace(/\/+$/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let res = await fetch(`${clean}/api/health?_t=${Date.now()}`, {
      signal: ctrl.signal,
      headers: { 'bypass-tunnel-reminder': 'true' }
    }).catch(() => null);

    if (!res || !res.ok) {
      res = await fetch(`${clean}/health?_t=${Date.now()}`, {
        signal: ctrl.signal,
        headers: { 'bypass-tunnel-reminder': 'true' }
      }).catch(() => null);
    }
    clearTimeout(timer);

    if (res && res.ok) {
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
  } else if (cachedBackendUrl) {
    // Quickly check if cached URL is actually alive
    const alive = await pingHealth(cachedBackendUrl, 2500);
    if (alive) {
      lastFetchTime = now;
      return cachedBackendUrl;
    }
    console.warn(`[Config] Cached backend ${cachedBackendUrl} is unresponsive. Refreshing tunnel...`);
    clearBackendUrlCache();
  }

  if (pendingResolvePromise) {
    return pendingResolvePromise;
  }

  pendingResolvePromise = (async () => {
    try {
      // 0. Priority: If frontend is loaded directly on a custom VPS or domain (not on localhost and not on HF space)
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('hf.space')) {
        const selfOrigin = window.location.origin;
        const isSelfAlive = await pingHealth(selfOrigin, 1200);
        if (isSelfAlive) {
          cachedBackendUrl = selfOrigin;
          lastFetchTime = now;
          try { sessionStorage.setItem('TRADING_GURU_RESOLVED_BACKEND', selfOrigin); } catch (e) {}
          console.log(`✅ [Config] Connected directly to self-hosted VPS backend: ${selfOrigin}`);
          return cachedBackendUrl;
        }
      }

      // 1. Check if user explicitly set a custom backend URL in localStorage
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('TRADING_GURU_BACKEND_URL');
        if (saved && saved.trim()) {
          if (saved.includes('bore.pub') || saved.includes('serveousercontent') || saved.includes('undefined')) {
            localStorage.removeItem('TRADING_GURU_BACKEND_URL');
          } else {
            let clean = saved.trim().replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
            const proto = window.location.protocol === 'https:' ? 'https' : 'http';
            const candidate = `${proto}://${clean}`;
            
            const isAlive = await pingHealth(candidate, 1500);
            if (isAlive) {
              cachedBackendUrl = candidate;
              lastFetchTime = now;
              try { sessionStorage.setItem('TRADING_GURU_RESOLVED_BACKEND', candidate); } catch (e) {}
              return cachedBackendUrl;
            } else {
              localStorage.removeItem('TRADING_GURU_BACKEND_URL');
            }
          }
        }
      }

      // 1.5. If running on localhost / 127.0.0.1, check active local backend ports (3002, 3005)
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const candidatePorts = ['3002', '3005'];
        if (window.location.port && window.location.port !== '3000' && window.location.port !== '5173' && window.location.port !== '5175') {
          if (!candidatePorts.includes(window.location.port)) {
            candidatePorts.unshift(window.location.port);
          }
        }
        for (const port of candidatePorts) {
          const localCandidate = `${window.location.protocol}//${window.location.hostname}:${port}`;
          const isAlive = await pingHealth(localCandidate, 800);
          if (isAlive) {
            cachedBackendUrl = localCandidate;
            lastFetchTime = now;
            try { sessionStorage.setItem('TRADING_GURU_RESOLVED_BACKEND', localCandidate); } catch (e) {}
            return cachedBackendUrl;
          }
        }
      }

      // 2. Fetch live_backend.json from endpoints in parallel
      const fetchUrls = [
        typeof window !== 'undefined' ? `${window.location.origin}/live_backend.json` : null,
        'https://marshalavi-tradingguru-terminal.static.hf.space/live_backend.json',
        'https://huggingface.co/spaces/marshalavi/TradingGuru-Terminal/raw/main/live_backend.json',
        'https://marshalavi-tradingguru.static.hf.space/live_backend.json'
      ].filter(Boolean) as string[];

      let discoveredJson: any = null;

      try {
        discoveredJson = await Promise.any(fetchUrls.map(async (url) => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 2000);
          try {
            const res = await fetch(`${url}?_t=${now}`, {
              cache: 'no-store',
              signal: ctrl.signal,
              headers: { 'bypass-tunnel-reminder': 'true' }
            });
            if (res.ok) {
              const json = await res.json();
              if (json && (json.backendUrl || json.backupUrl || json.cloudflareUrl)) {
                return json;
              }
            }
            throw new Error('Invalid JSON');
          } finally {
            clearTimeout(timer);
          }
        }));
      } catch (e) {}

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
        const alive = await pingHealth(candidate, 1500);
        if (alive) {
          cachedBackendUrl = candidate;
          lastFetchTime = now;
          try { sessionStorage.setItem('TRADING_GURU_RESOLVED_BACKEND', candidate); } catch (e) {}
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
        try { sessionStorage.setItem('TRADING_GURU_RESOLVED_BACKEND', cachedBackendUrl); } catch (e) {}
        return cachedBackendUrl;
      }

      // 4. Localhost Fallback
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const localPort = (window.location.port && window.location.port !== '5175' && window.location.port !== '5173') ? window.location.port : '3002';
        cachedBackendUrl = `${window.location.protocol}//${window.location.hostname}:${localPort}`;
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
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const localPort = (window.location.port && window.location.port !== '5175' && window.location.port !== '5173') ? window.location.port : '3002';
      return `${window.location.protocol}//${window.location.hostname}:${localPort}`;
    }
    if (!window.location.hostname.includes('hf.space')) {
      return window.location.origin;
    }
  }
  return DEFAULT_FALLBACK_URLS[0];
}
