async function searchTVDirect() {
  // Querying with "NIFTY26" to find Nifty 2026 option contracts
  const url = 'https://symbol-search.tradingview.com/symbol_search/?text=NIFTY26&exchange=NSE';
  
  try {
    console.log('Querying TradingView directly for NSE NIFTY26 options...');
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tradingview.com/',
        'Origin': 'https://www.tradingview.com'
      }
    });
    
    if (!res.ok) {
      console.log('API Error:', res.status, await res.text());
      return;
    }
    
    const data = await res.json();
    console.log(`Found ${data.length} symbols:`);
    data.slice(0, 30).forEach(m => {
      console.log(`  Symbol: ${m.symbol} | Description: ${m.description} | Type: ${m.type} | Exchange: ${m.exchange}`);
    });
  } catch (err) {
    console.error('Direct search failed:', err);
  }
}

searchTVDirect();
