

async function main() {
  console.log('--- 1st 5-Minute Option Premium Levels Scanner ---');
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }
    const data = await res.json();
    
    console.log(`Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    
    if (data.nifty && data.nifty.optionPremiumLevels) {
      const n = data.nifty.optionPremiumLevels;
      console.log('\n🔹 NIFTY 1st 5-Min Levels:');
      console.log(`  - 1st 5-Min Spot Open: ${n.open}`);
      console.log(`  - 1st 5-Min Spot High: ${n.high}`);
      console.log(`  - 1st 5-Min Spot Low: ${n.low}`);
      console.log(`  - Selected CE Strike: ${n.ceStrike} CE | Support Level: ${n.ceLevel}`);
      console.log(`  - Selected PE Strike: ${n.peStrike} PE | Support Level: ${n.peLevel}`);
    } else {
      console.log('\n⚠️ NIFTY Option Premium Levels: Not Available / Pending 09:20 AM close.');
    }
    
    if (data.banknifty && data.banknifty.optionPremiumLevels) {
      const b = data.banknifty.optionPremiumLevels;
      console.log('\n🔹 BANKNIFTY 1st 5-Min Levels:');
      console.log(`  - 1st 5-Min Spot Open: ${b.open}`);
      console.log(`  - 1st 5-Min Spot High: ${b.high}`);
      console.log(`  - 1st 5-Min Spot Low: ${b.low}`);
      console.log(`  - Selected CE Strike: ${b.ceStrike} CE | Support Level: ${b.ceLevel}`);
      console.log(`  - Selected PE Strike: ${b.peStrike} PE | Support Level: ${b.peLevel}`);
    } else {
      console.log('\n⚠️ BANKNIFTY Option Premium Levels: Not Available / Pending 09:20 AM close.');
    }
  } catch (err) {
    console.error('Error fetching levels:', err.message);
  }
}

main();
