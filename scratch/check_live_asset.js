async function run() {
  try {
    const res = await fetch('https://marshalavi-tradingguru-terminal.hf.space/assets/index-miYkzWwl.js');
    console.log('Main JS status:', res.status);
    const text = await res.text();
    console.log('Main JS length:', text.length);

    const cssRes = await fetch('https://marshalavi-tradingguru-terminal.hf.space/assets/index-B0PnlJq5.css');
    console.log('CSS status:', cssRes.status);

    const backendRes = await fetch('https://marshalavi-tradingguru-terminal.hf.space/live_backend.json');
    console.log('live_backend.json status:', backendRes.status);
    const backendJson = await backendRes.json();
    console.log('live_backend.json content:', backendJson);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
