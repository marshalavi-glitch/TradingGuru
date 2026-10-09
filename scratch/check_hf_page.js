async function run() {
  const r = await fetch('https://huggingface.co/spaces/marshalavi/TradingGuru-Terminal');
  const html = await r.text();
  const iframeMatch = html.match(/iframe[^>]+src="([^"]+)"/i);
  console.log('iframe match:', iframeMatch ? iframeMatch[1] : 'None');
  const hfSpaceMatches = [...new Set(html.match(/https:\/\/[^"'\s]+\.hf\.space[^\s"']*/g) || [])];
  console.log('hf.space matches:', hfSpaceMatches);
}
run();
