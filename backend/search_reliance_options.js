import fetch from 'node-fetch';

async function search() {
  const url = `https://symbol-search.tradingview.com/symbol_search/?text=RELIANCE&type=options&country=IN`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tradingview.com/',
        'Origin': 'https://www.tradingview.com'
      }
    });
    const data = await res.json();
    console.log(`Found ${data.length} symbols:`);
    data.slice(0, 15).forEach(item => {
      console.log(`- ${item.symbol}: ${item.description}`);
    });
  } catch (e) {
    console.error('Error searching:', e);
  }
}

search();
