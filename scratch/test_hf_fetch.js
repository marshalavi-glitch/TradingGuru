async function test() {
  const r = await fetch('https://marshalavi-tradingguru-terminal.hf.space/');
  console.log('Status:', r.status);
  const text = await r.text();
  console.log('HTML:\n', text.substring(0, 500));

  const jsUrl = 'https://marshalavi-tradingguru-terminal.hf.space/assets/index-miYkzWwl.js';
  const jsR = await fetch(jsUrl);
  console.log('JS Status:', jsR.status);
  console.log('JS Content-Type:', jsR.headers.get('content-type'));

  const backendUrl = 'https://marshalavi-tradingguru-terminal.hf.space/live_backend.json';
  const bR = await fetch(backendUrl);
  console.log('Backend Status:', bR.status);
}
test().catch(console.error);
