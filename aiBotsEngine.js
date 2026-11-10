class AISpeedBotsEngine {
  constructor(derivApiEngine, logCallback) {
    this.api = derivApiEngine;
    this.log = logCallback || console.log;
    this.activeBot = null; 
    this.lastDigits = [];
    this.tickHistory = [];
    this.isExecuting = false;
  }

  setBot(botType) {
    this.activeBot = botType;
    this.lastDigits = [];
    this.tickHistory = [];
    this.isExecuting = false;
    this.log(`[AI Speed Boat] Activated high-winrate strategy: ${botType.toUpperCase()}`, 'bot');
  }

  stopBot() {
    this.activeBot = null;
    this.isExecuting = false;
    this.log("[AI Speed Boat] All speed boats disengaged.", 'warning');
  }

  async processTick(tick) {
    if (!this.activeBot || this.isExecuting || !this.api.authorized) return;

    const priceStr = tick.quote.toString();
    const decimalSplit = priceStr.split('.');
    const fractionalPart = decimalSplit[1] || '0';
    const lastDecimal = parseInt(fractionalPart.slice(-1));
    const currentPrice = parseFloat(tick.quote);

    this.lastDigits.push(lastDecimal);
    if (this.lastDigits.length > 50) this.lastDigits.shift();

    this.tickHistory.push(currentPrice);
    if (this.tickHistory.length > 20) this.tickHistory.shift();

    if (this.activeBot === 'even_odd') {
      await this.runEvenOddSpeedBoat();
    } else if (this.activeBot === 'matches') {
      await this.runMatchesSpeedBoat();
    } else if (this.activeBot === 'rise_fall') {
      await this.runRiseFallSpeedBoat();
    } else if (this.activeBot === 'over3_under6') {
      await this.runOver3Under6SpeedBoat(lastDecimal);
    } else if (this.activeBot === 'multi_low_digits') {
      await this.runMultiLowDigitsSpeedBoat();
    } else if (this.activeBot === 'extreme_edges') {
      await this.runExtremeEdgesSpeedBoat(lastDecimal);
    }
  }

  // 1. Even / Odd Speed Boat
  async runEvenOddSpeedBoat() {
    if (this.lastDigits.length < 10) return;
    const recent10 = this.lastDigits.slice(-10);
    const evens = recent10.filter(d => d % 2 === 0).length;
    const odds = 10 - evens;

    let contractType = null;
    if (evens >= 8) contractType = 'DIGITODD';
    else if (odds >= 8) contractType = 'DIGITEVEN';

    if (contractType) {
      this.isExecuting = true;
      const symbol = document.getElementById('select-market').value;
      const stake = document.getElementById('input-stake').value;
      try {
        const res = await this.api.executeTrade({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: contractType });
        this.log(`[Even/Odd Success] ID: ${res.contract_id} | Payout: $${res.payout}`, 'success');
      } catch (err) { this.log(`[Even/Odd Error]: ${err.message || err.code}`, 'error'); }
      setTimeout(() => { this.isExecuting = false; }, 2000);
    }
  }

  // 2. Matches Speed Boat
  async runMatchesSpeedBoat() {
    if (this.lastDigits.length < 20) return;
    const counts = {};
    this.lastDigits.slice(-20).forEach(d => { counts[d] = (counts[d] || 0) + 1; });
    let targetDigit = 0, maxFreq = 0;
    for (let d in counts) {
      if (counts[d] > maxFreq) { maxFreq = counts[d]; targetDigit = parseInt(d); }
    }

    if (maxFreq >= 5) {
      this.isExecuting = true;
      const symbol = document.getElementById('select-market').value;
      const stake = document.getElementById('input-stake').value;
      try {
        const res = await this.api.executeTradeWithBarrier({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: 'DIGITMATCH', barrier: targetDigit.toString() });
        this.log(`[Matches Success] Digit ${targetDigit} | ID: ${res.contract_id}`, 'success');
      } catch (err) { this.log(`[Matches Error]: ${err.message || err.code}`, 'error'); }
      setTimeout(() => { this.isExecuting = false; }, 2500);
    }
  }

  // 3. Rise / Fall Speed Boat
  async runRiseFallSpeedBoat() {
    if (this.tickHistory.length < 3) return;
    const p1 = this.tickHistory[this.tickHistory.length - 1];
    const p2 = this.tickHistory[this.tickHistory.length - 2];
    const p3 = this.tickHistory[this.tickHistory.length - 3];

    let contractType = null;
    if (p1 > p2 && p2 > p3) contractType = 'CALL';
    else if (p1 < p2 && p2 < p3) contractType = 'PUT';

    if (contractType) {
      this.isExecuting = true;
      const symbol = document.getElementById('select-market').value;
      const stake = document.getElementById('input-stake').value;
      try {
        const res = await this.api.executeTrade({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: contractType });
        this.log(`[Rise/Fall Success] ${contractType} | ID: ${res.contract_id}`, 'success');
      } catch (err) { this.log(`[Rise/Fall Error]: ${err.message || err.code}`, 'error'); }
      setTimeout(() => { this.isExecuting = false; }, 1500);
    }
  }

  // 4. Over 3 / Under 6 Speed Boat
  async runOver3Under6SpeedBoat(lastDigit) {
    if (this.lastDigits.length < 10) return;
    let contractType = lastDigit <= 3 ? 'DIGITOVER' : lastDigit >= 6 ? 'DIGITUNDER' : null;
    let barrier = lastDigit <= 3 ? '3' : '6';

    if (contractType) {
      this.isExecuting = true;
      const symbol = document.getElementById('select-market').value;
      const stake = document.getElementById('input-stake').value;
      try {
        const res = await this.api.executeTradeWithBarrier({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: contractType, barrier: barrier });
        this.log(`[Over3/Under6 Success] ${contractType} Barrier ${barrier} | ID: ${res.contract_id}`, 'success');
      } catch (err) { this.log(`[Over3/Under6 Error]: ${err.message || err.code}`, 'error'); }
      setTimeout(() => { this.isExecuting = false; }, 2000);
    }
  }

  // 5. Simultaneous Over 0, Over 1, & Over 2 Speed Boat
  async runMultiLowDigitsSpeedBoat() {
    this.isExecuting = true;
    const symbol = document.getElementById('select-market').value;
    const stake = document.getElementById('input-stake').value;
    const barriers = ['0', '1', '2'];

    this.log(`[Multi-Low Speed Boat] Firing simultaneous Over 0, 1, & 2 at millisecond speed...`, 'bot');
    for (let b of barriers) {
      try {
        this.api.executeTradeWithBarrier({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: 'DIGITOVER', barrier: b })
          .then(res => this.log(`[Over ${b} Success] ID: ${res.contract_id}`, 'success'))
          .catch(e => {});
      } catch(e) {}
    }
    setTimeout(() => { this.isExecuting = false; }, 3000);
  }

  // 6. Over 6,7 & Under 2,3 Edge Speed Boat
  async runExtremeEdgesSpeedBoat(lastDigit) {
    if (this.lastDigits.length < 5) return;
    let contractType = null, barrier = null;

    if (lastDigit >= 7) { contractType = 'DIGITOVER'; barrier = '6'; }
    else if (lastDigit <= 2) { contractType = 'DIGITUNDER'; barrier = '3'; }

    if (contractType) {
      this.isExecuting = true;
      const symbol = document.getElementById('select-market').value;
      const stake = document.getElementById('input-stake').value;
      try {
        const res = await this.api.executeTradeWithBarrier({ symbol, amount: stake, duration: 1, duration_unit: 't', contract_type: contractType, barrier: barrier });
        this.log(`[Edge Speed Boat Success] ${contractType} ${barrier} | ID: ${res.contract_id}`, 'success');
      } catch (err) { this.log(`[Edge Error]: ${err.message || err.code}`, 'error'); }
      setTimeout(() => { this.isExecuting = false; }, 2000);
    }
  }
}
