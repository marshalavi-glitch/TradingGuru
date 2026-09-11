async function check() {
  const url = `https://huggingface.co/spaces/marshalavi/TradingGuru/raw/main/live_backend.json?_t=${Date.now()}`;
  console.log('Fetching:', url);
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  console.log('Published HF live_backend.json:', data);
}
check();
