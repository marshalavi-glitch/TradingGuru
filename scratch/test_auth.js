(async () => {
  try {
    const r1 = await fetch('http://localhost:3002/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sharath', password: 'sharath@2026' })
    });
    console.log('sharath status:', r1.status, await r1.json());

    const r2 = await fetch('http://localhost:3002/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sharathsg', password: 'sharath@2026' })
    });
    console.log('sharathsg status:', r2.status, await r2.json());

    const r3 = await fetch('http://localhost:3002/api/auth/session-control');
    console.log('session-control:', await r3.json());
  } catch (e) {
    console.error('Error:', e);
  }
})();
