import fetch from 'node-fetch';

async function verify() {
  // Wait 3 seconds to let subscriptions populate cache
  console.log('Waiting for background options cache to warm up...');
  await new Promise(r => setTimeout(r, 4000));
  
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    const json = await res.json();
    
    console.log('\n======================================================');
    console.log('🎯 REAL-TIME OPTIONS PRICE RESOLUTION STATUS');
    console.log('======================================================');
    
    console.log('\n🟢 NIFTY 50 Option LTP Status:');
    console.log(`  - Call LTP: ₹${json.nifty?.straddleSkew?.ceLtp}`);
    console.log(`  - Put LTP : ₹${json.nifty?.straddleSkew?.peLtp}`);
    console.log(`  - Total Straddle: ₹${json.nifty?.straddleSkew?.totalStraddle}`);
    
    console.log('\n🟢 BANKNIFTY Option LTP Status:');
    console.log(`  - Call LTP: ₹${json.banknifty?.straddleSkew?.ceLtp}`);
    console.log(`  - Put LTP : ₹${json.banknifty?.straddleSkew?.peLtp}`);
    console.log(`  - Total Straddle: ₹${json.banknifty?.straddleSkew?.totalStraddle}`);
    
    console.log('\n🟢 Stock Option Signals LTP Status:');
    if (json.stockSignals && json.stockSignals.length > 0) {
      json.stockSignals.forEach(stk => {
        console.log(`  - ${stk.symbol} ${stk.strike} -> LTP: ₹${stk.currentOptionPrice} (SL: ₹${stk.optionSL})`);
      });
    } else {
      console.log('  - No stock signals active right now.');
    }
    
  } catch (e) {
    console.error('Error querying api:', e);
  }
  process.exit(0);
}

verify();
