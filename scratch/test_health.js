async function testHealth() {
  const url = 'https://monday-willing-kills-aerial.trycloudflare.com/health';
  try {
    const res = await fetch(url, { headers: { 'bypass-tunnel-reminder': 'true' } });
    console.log('Health status:', res.status);
    console.log('Health response:', await res.json());
  } catch (e) {
    console.error('Health error:', e.message);
  }
}
testHealth();
