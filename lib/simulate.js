// Simulador de Monte Carlo — padrão de apostas vs. investimento
// Função pura: recebe parâmetros, devolve resultados + link do gráfico (QuickChart). Sem dependências.

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
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) errors.push(`${k} inválido`);
    return n;
  };
  const params = {
    stake: num('stake', { min: 0.01 }),
    odd: num('odd', { min: 1.01, max: 1000 }),
    betsPerWeek: num('betsPerWeek', { min: 0.1, max: 500 }),
    months: Math.round(num('months', { min: 1, max: 120, required: false }) || 12),
    bankroll: num('bankroll', { min: 0, required: false }) || null, // 0 ou vazio = não informado
    margin: num('margin', { min: 0, max: 0.5, required: false }) ?? 0.06,
    annualRate: num('annualRate', { min: 0, max: 1, required: false }) ?? 0,
    seed: num('seed', { required: false }) ?? 42,
    userProbability: num('userProbability', { min: 0, max: 0.999, required: false }) || null,
  };
  let allOdds = input.allOdds;
  if (typeof allOdds === 'string' && allOdds.trim()) allOdds = allOdds.split(/[;\s]+|,(?=\s)/).filter(Boolean);
  if (Array.isArray(allOdds) && allOdds.length > 1) {
    allOdds = allOdds.map(o => Number(String(o).replace(',', '.')));
    if (allOdds.some(o => !Number.isFinite(o) || o <= 1)) errors.push('allOdds inválido');
  } else allOdds = null;
  params.allOdds = allOdds;
  return { params, errors };
}

const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

function buildChartUrl({ labels, p5, median, p95, invest, title }) {
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Cenário de azar (5%)', data: p5, borderColor: 'rgba(214,69,65,0.5)', backgroundColor: 'rgba(214,69,65,0.12)', borderWidth: 1, pointRadius: 0, fill: false },
        { label: 'Cenário de sorte (95%)', data: p95, borderColor: 'rgba(214,69,65,0.5)', backgroundColor: 'rgba(214,69,65,0.12)', borderWidth: 1, pointRadius: 0, fill: '-1' },
        { label: 'Apostando (resultado típico)', data: median, borderColor: 'rgb(214,69,65)', borderWidth: 3, pointRadius: 0, fill: false },
        { label: 'Investindo o mesmo valor (Selic)', data: invest, borderColor: 'rgb(38,140,90)', borderWidth: 3, pointRadius: 0, fill: false },
      ],
    },
    options: {
      title: { display: true, text: title, fontSize: 15 },
      legend: { position: 'bottom', labels: { boxWidth: 14 } },
      scales: {
        xAxes: [{ scaleLabel: { display: true, labelString: 'Meses' } }],
        yAxes: [{ scaleLabel: { display: true, labelString: 'Ganho ou perda acumulada (R$)' } }],
      },
    },
  };
  return 'https://quickchart.io/chart?w=700&h=420&bkg=white&f=png&c=' + encodeURIComponent(JSON.stringify(config));
}

function simulate(input) {
  const { params, errors } = validate(input || {});
  if (errors.length) return { ok: false, errors };
  const { stake, odd, betsPerWeek, months, bankroll, margin, annualRate, seed, allOdds, userProbability } = params;

  // Probabilidade justa (sem a margem da casa)
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
  // Cenário hipotético (passo 7 do playbook): usa a probabilidade do usuário
  const hypothetical = userProbability != null;
  const p = hypothetical ? userProbability : pFair;

  const weeks = months * 52 / 12;
  const nBets = Math.max(1, Math.round(betsPerWeek * weeks));
  const evPerBet = p * odd - 1;
  const theoreticalMean = nBets * stake * evPerBet;

  const trials = Math.max(2000, Math.min(10000, Math.floor(2e7 / nBets)));
  const rand = mulberry32(seed);

  // Pontos mensais para o gráfico (nº de apostas acumuladas ao fim de cada mês)
  const checkpoints = [];
  for (let m = 1; m <= months; m++) checkpoints.push(Math.round(m * nBets / months));
  const paths = new Float64Array(trials * months);

  const finals = new Float64Array(trials);
  let ahead = 0, ruined = 0, doubled = 0;
  for (let t = 0; t < trials; t++) {
    let pnl = 0, busted = false, c = 0;
    for (let i = 1; i <= nBets; i++) {
      if (!busted) {
        if (bankroll != null && bankroll + pnl < stake) busted = true;
        else pnl += rand() < p ? stake * (odd - 1) : -stake;
      }
      while (c < months && checkpoints[c] === i) paths[t * months + c++] = pnl;
    }
    while (c < months) paths[t * months + c++] = pnl;
    finals[t] = pnl;
    if (pnl > 0) ahead++;
    if (busted) ruined++;
    if (bankroll != null && bankroll + pnl >= 2 * bankroll) doubled++;
  }
  const sorted = Float64Array.from(finals).sort();
  const q = x => sorted[Math.min(trials - 1, Math.floor(x * trials))];
  let sum = 0; for (const v of finals) sum += v;
  const mean = sum / trials;

  // Validação: média simulada vs. teórica (≈3 erros-padrão). Com banca, a ruína trunca a média.
  const sdBet = stake * odd * Math.sqrt(p * (1 - p));
  const se = sdBet * Math.sqrt(nBets) / Math.sqrt(trials);
  const valid = bankroll != null || Math.abs(mean - theoreticalMean) <= 3 * se + 1;

  // Custo de oportunidade: mesmo valor semanal investido à taxa de referência
  const weekly = stake * betsPerWeek;
  const wr = Math.pow(1 + annualRate, 1 / 52) - 1;
  const investGainAt = nW => {
    const invested = weekly * nW;
    const fv = wr === 0 ? invested : weekly * ((Math.pow(1 + wr, nW) - 1) / wr) * (1 + wr);
    return { invested, fv, gain: fv - invested };
  };
  const inv = investGainAt(Math.round(weeks));

  // Séries do gráfico (no máximo ~24 pontos para o link não ficar enorme)
  const step = Math.ceil(months / 24);
  const labels = ['0'], s5 = [0], s50 = [0], s95 = [0], sInv = [0];
  const col = new Float64Array(trials);
  for (let m = step; m <= months; m += step) {
    for (let t = 0; t < trials; t++) col[t] = paths[t * months + m - 1];
    col.sort();
    const cq = x => Math.round(col[Math.min(trials - 1, Math.floor(x * trials))]);
    labels.push(String(m)); s5.push(cq(0.05)); s50.push(cq(0.5)); s95.push(cq(0.95));
    sInv.push(Math.round(investGainAt(Math.round(m * 52 / 12)).gain));
  }
  if (labels[labels.length - 1] !== String(months)) {
    labels.push(String(months)); s5.push(Math.round(q(0.05))); s50.push(Math.round(q(0.5))); s95.push(Math.round(q(0.95)));
    sInv.push(Math.round(inv.gain));
  }
  const chartUrl = buildChartUrl({
    labels, p5: s5, median: s50, p95: s95, invest: sInv,
    title: `${brl(stake)} por aposta, odd ${odd}, ${betsPerWeek}x/semana — ${months} meses`,
  });

  const r2 = v => Math.round(v * 100) / 100;
  const r4 = v => Math.round(v * 10000) / 10000;

  return {
    ok: true,
    hypothetical,
    inputs: { stake, odd, allOdds, betsPerWeek, months, bankroll, margin, annualRate, userProbability },
    probabilities: {
      implied: r4(pImplied),
      fair: r4(pFair),
      used: r4(p),
      houseMarginPct: r2(houseMargin * 100),
      breakEven: r4(pImplied),
    },
    expectedValue: {
      roiPerBetPct: r2(evPerBet * 100),
      nBets,
      totalWagered: r2(nBets * stake),
      theoreticalResult: r2(theoreticalMean),
    },
    simulation: {
      trials,
      seed,
      mean: r2(mean),
      p5: r2(q(0.05)),
      p25: r2(q(0.25)),
      median: r2(q(0.5)),
      p75: r2(q(0.75)),
      p95: r2(q(0.95)),
      worst: r2(sorted[0]),
      best: r2(sorted[trials - 1]),
      probAhead: r4(ahead / trials),
      probRuin: bankroll != null ? r4(ruined / trials) : null,
      probDouble: bankroll != null ? r4(doubled / trials) : null,
      valid,
    },
    opportunityCost: {
      annualRate,
      investedTotal: r2(inv.invested),
      futureValue: r2(inv.fv),
      gain: r2(inv.gain),
      differenceVsBettingMedian: r2(inv.gain - q(0.5)),
    },
    kelly: { fraction: r4(Math.max(0, (p * odd - 1) / (odd - 1))) },
    chartUrl,
    chartMarkdown: `![Gráfico da simulação](${chartUrl})`,
    assumptions: [
      'Apostas independentes, com a mesma odd e o mesmo valor',
      hypothetical ? 'Cenário HIPOTÉTICO com a probabilidade informada pelo usuário' : 'Probabilidade = odd sem a margem da casa',
      'Investimento comparado antes de impostos',
    ],
  };
}

module.exports = { simulate };
