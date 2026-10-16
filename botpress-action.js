// Botpress — Action "runBettingSimulation"
// Cole este código no editor da Action. Defina os inputs da Action com estes nomes:
//   stake (number, obrigatório)        valor médio por aposta, em R$
//   odd (number, obrigatório)          odd decimal típica (ex.: 1.90)
//   betsPerWeek (number, obrigatório)  apostas por semana
//   months (number)                    horizonte em meses (padrão 12)
//   allOdds (string)                   odds de todos os resultados, ex.: "2.10, 3.30, 3.60"
//   bankroll (number)                  dinheiro separado para apostar (opcional)
//   annualRate (number)                taxa de referência anual em decimal, ex.: 0.15
//   margin (number)                    margem padrão da casa, ex.: 0.06
//   userProbability (number)           só para o cenário hipotético do passo 7
//
// Em Configuration Variables do bot, crie SIMULATOR_URL (ex.: https://seu-projeto.vercel.app/api/simulate)
// e, se usar chave, SIMULATOR_API_KEY.

const url = env.SIMULATOR_URL;
const headers = { 'Content-Type': 'application/json' };
if (env.SIMULATOR_API_KEY) headers['x-api-key'] = env.SIMULATOR_API_KEY;

// Remove campos vazios para a API aplicar os valores padrão
const payload = {};
for (const [k, v] of Object.entries(input)) {
  if (v !== undefined && v !== null && v !== '') payload[k] = v;
}

try {
  const { data } = await axios.post(url, payload, { headers, timeout: 15000 });
  return data; // o agente lê probabilities, expectedValue, simulation, opportunityCost, kelly
} catch (err) {
  const detail = err.response?.data?.errors?.join('; ') || err.message;
  return { ok: false, errors: [`Falha ao rodar o simulador: ${detail}`] };
}
