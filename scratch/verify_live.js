(async () => {
  try {
    const res = await fetch('https://marshalavi-tradingguru-terminal.static.hf.space/index.html');
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML snippet:', html.slice(0, 300));
    console.log('Script tag in HTML:', html.match(/<script[^>]+src="([^"]+)"/)?.[1]);
  } catch (err) {
    console.error('Error fetching live:', err);
  }
})();
