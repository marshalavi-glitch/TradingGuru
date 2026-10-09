async function test() {
  const rIndex = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/index.html');
  console.log('Index status:', rIndex.status);
  
  const rJs = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/assets/index-miYkzWwl.js');
  console.log('Main JS status:', rJs.status);
  console.log('JS content-type:', rJs.headers.get('content-type'));
  console.log('JS length:', (await rJs.text()).length);

  const rBackend = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/live_backend.json');
  console.log('Backend status:', rBackend.status);
  console.log('Backend data:', await rBackend.json());
}
test().catch(console.error);
