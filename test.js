// Testes rápidos: node test.js
const assert = require('assert');
const { simulate } = require('./lib/simulate');

// 1) Caso básico: R$20, odd 1.90, 5 apostas/semana, 12 meses, Selic ~15% a.a.
const r = simulate({ stake: 20, odd: 1.9, betsPerWeek: 5, months: 12, annualRate: 0.15 });
assert.ok(r.ok);
assert.ok(r.simulation.valid, 'média simulada deve bater com a teórica');
assert.ok(r.expectedValue.roiPerBetPct < 0, 'ROI deve ser negativo sem vantagem');
assert.strictEqual(r.kelly.fraction, 0);
console.log('Básico:', JSON.stringify({ prob: r.probabilities, ev: r.expectedValue, sim: r.simulation, opp: r.opportunityCost }, null, 1));

// 2) Margem exata com todas as odds do mercado
const r2 = simulate({ stake: 50, odd: 2.1, allOdds: [2.1, 3.3, 3.6], betsPerWeek: 3, months: 6, bankroll: 1000 });
assert.ok(r2.ok && r2.probabilities.houseMarginPct > 0);
assert.ok(r2.simulation.probRuin >= 0);
console.log('Com banca:', r2.probabilities, r2.simulation.probRuin, r2.simulation.probDouble);

// 3) Reprodutibilidade (mesma semente → mesmo resultado)
assert.deepStrictEqual(simulate({ stake: 10, odd: 2, betsPerWeek: 2 }), simulate({ stake: 10, odd: 2, betsPerWeek: 2 }));

// 4) Erro de entrada
const bad = simulate({ odd: 0.5 });
assert.ok(!bad.ok && bad.errors.length >= 2);
console.log('Erros:', bad.errors);

// 5) Horizonte longo continua rápido
let t = Date.now();
simulate({ stake: 10, odd: 1.5, betsPerWeek: 30, months: 120 });
console.log('10 anos, 30/semana:', Date.now() - t, 'ms');

console.log('\nTodos os testes passaram.');
