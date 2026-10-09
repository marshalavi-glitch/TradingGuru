async function verify() {
  const rIndex = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/index.html?_t=' + Date.now());
  console.log('Index status:', rIndex.status);
  const html = await rIndex.text();
  const scriptMatch = html.match(/src="([^"]+)"/);
  console.log('Script tag in live HTML:', scriptMatch ? scriptMatch[1] : 'None');

  if (scriptMatch) {
    const jsUrl = new URL(scriptMatch[1], 'https://marshalavi-tradingguru-terminal.static.hf.space/').href;
    const rJs = await fetch(jsUrl);
    console.log('Main JS status:', rJs.status, 'Content-Type:', rJs.headers.get('content-type'), 'Length:', (await rJs.text()).length);
  }

  const rBackend = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/live_backend.json?_t=' + Date.now());
  console.log('Backend status:', rBackend.status);
  console.log('Backend data:', await rBackend.json());
}
verify().catch(console.error);
