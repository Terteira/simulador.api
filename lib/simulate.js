// Simulador de Monte Carlo — padrão de apostas vs. investimento
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function validate(input) {
  const errors = [];
  const num = (k, { min = -Infinity, max = Infinity, required = true } = {}) => {
    const v = input[k];
    if (v === undefined || v === null || v === '') {
      if (required) errors.push(`${k} é obrigatório`);
      return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) errors.push(`${k} inválido`);
    return n;
  };
  const params = {
    stake: num('stake', { min: 0.01 }),
    odd: num('odd', { min: 1.01, max: 1000 }),
    betsPerWeek: num('betsPerWeek', { min: 0.1, max: 500 }),
    months: num('months', { min: 1, max: 120, required: false }) ?? 12,
    bankroll: num('bankroll', { min: 0.01, required: false }),
    margin: num('margin', { min: 0, max: 0.5, required: false }) ?? 0.06,
    annualRate: num('annualRate', { min: 0, max: 1, required: false }) ?? 0,
    seed: num('seed', { required: false }) ?? 42,
    userProbability: num('userProbability', { min: 0.001, max: 0.999, required: false }),
  };
  let allOdds = input.allOdds;
  if (typeof allOdds === 'string' && allOdds.trim()) allOdds = allOdds.split(/[;,\s]+/);
  if (Array.isArray(allOdds) && allOdds.length > 1) {
    allOdds = allOdds.map(Number);
    if (allOdds.some(o => !Number.isFinite(o) || o <= 1)) errors.push('allOdds inválido');
  } else allOdds = null;
  params.allOdds = allOdds;
  return { params, errors };
}

function simulate(input) {
  const { params, errors } = validate(input || {});
  if (errors.length) return { ok: false, errors };
  const { stake, odd, betsPerWeek, months, bankroll, margin, annualRate, seed, allOdds, userProbability } = params;

  const pImplied = 1 / odd;
  let pFair, houseMargin;
  if (allOdds) {
    const sumInv = allOdds.reduce((s, o) => s + 1 / o, 0);
    pFair = pImplied / sumInv;
    houseMargin = sumInv - 1;
  } else {
    pFair = pImplied / (1 + margin);
    houseMargin = margin;
  }
  const hypothetical = userProbability != null;
  const p = hypothetical ? userProbability : pFair;

  const weeks = months * 52 / 12;
  const nBets = Math.max(1, Math.round(betsPerWeek * weeks));
  const evPerBet = p * odd - 1;
  const theoreticalMean = nBets * stake * evPerBet;

  const trials = Math.max(2000, Math.min(10000, Math.floor(2e7 / nBets)));
  const rand = mulberry32(seed);

  const finals = new Float64Array(trials);
  let ahead = 0, ruined = 0, doubled = 0;
  for (let t = 0; t < trials; t++) {
    let pnl = 0, busted = false;
    for (let i = 0; i < nBets; i++) {
      if (bankroll != null && bankroll + pnl < stake) { busted = true; break; }
      pnl += rand() < p ? stake * (odd - 1) : -stake;
    }
    finals[t] = pnl;
    if (pnl > 0) ahead++;
    if (busted) ruined++;
    if (bankroll != null && bankroll + pnl >= 2 * bankroll) doubled++;
  }
  finals.sort();
  const q = x => finals[Math.min(trials - 1, Math.floor(x * trials))];
  let sum = 0; for (const v of finals) sum += v;
  const mean = sum / trials;

  const sdBet = stake * odd * Math.sqrt(p * (1 - p));
  const se = sdBet * Math.sqrt(nBets) / Math.sqrt(trials);
  const valid = bankroll != null || Math.abs(mean - theoreticalMean) <= 3 * se + 1;

  const weekly = stake * betsPerWeek;
  const nW = Math.round(weeks);
  const wr = Math.pow(1 + annualRate, 1 / 52) - 1;
  const investedTotal = weekly * nW;
  const investmentFutureValue = wr === 0 ? investedTotal : weekly * ((Math.pow(1 + wr, nW) - 1) / wr) * (1 + wr);

  const r2 = v => Math.round(v * 100) / 100;
  const r4 = v => Math.round(v * 10000) / 10000;

  return {
    ok: true,
    hypothetical,
    inputs: { stake, odd, allOdds, betsPerWeek, months, bankroll, margin, annualRate, userProbability },
    probabilities: {
      implied: r4(pImplied), fair: r4(pFair), used: r4(p),
      houseMarginPct: r2(houseMargin * 100), breakEven: r4(pImplied),
    },
    expectedValue: {
      roiPerBetPct: r2(evPerBet * 100), nBets,
      totalWagered: r2(nBets * stake), theoreticalResult: r2(theoreticalMean),
    },
    simulation: {
      trials, seed, mean: r2(mean),
      p5: r2(q(0.05)), p25: r2(q(0.25)), median: r2(q(0.5)), p75: r2(q(0.75)), p95: r2(q(0.95)),
      worst: r2(finals[0]), best: r2(finals[trials - 1]),
      probAhead: r4(ahead / trials),
      probRuin: bankroll != null ? r4(ruined / trials) : null,
      probDouble: bankroll != null ? r4(doubled / trials) : null,
      valid,
    },
    opportunityCost: {
      annualRate, investedTotal: r2(investedTotal), futureValue: r2(investmentFutureValue),
      gain: r2(investmentFutureValue - investedTotal),
      differenceVsBettingMedian: r2(investmentFutureValue - investedTotal - q(0.5)),
    },
    kelly: { fraction: r4(Math.max(0, (p * odd - 1) / (odd - 1))) },
    assumptions: [
      'Apostas independentes, com a mesma odd e o mesmo valor',
      hypothetical ? 'Cenário HIPOTÉTICO com a probabilidade informada pelo usuário' : 'Probabilidade = odd sem a margem da casa',
      'Investimento comparado antes de impostos',
    ],
  };
}

module.exports = { simulate };
