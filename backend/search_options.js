async function searchOptions() {
  const backendUrl = 'http://localhost:3002';
  
  // Let's search for "NIFTY" with type = option to see the exact syntax
  const url = `${backendUrl}/api/search?query=NIFTY`;
  
  try {
    console.log(`Searching symbols on TV for "NIFTY"...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log('Error status:', res.status);
      return;
    }
    const data = await res.json();
    console.log(`Found ${data.length} matches:`);
    
    // Print the first 25 matches
    data.slice(0, 25).forEach(m => {
      console.log(`  Symbol: ${m.value} | Label: ${m.label} | Type: ${m.type} | Exchange: ${m.exchange}`);
    });
  } catch (err) {
    console.error('Search failed:', err);
  }
}

searchOptions();
