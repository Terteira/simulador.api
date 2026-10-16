# API do Simulador de Apostas (Monte Carlo)

API sem dependências que roda o simulador do playbook e devolve os resultados em JSON para o Botpress.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `lib/simulate.js` | O simulador (Monte Carlo, valor esperado, custo de oportunidade, Kelly) |
| `api/simulate.js` | Endpoint pronto para a Vercel |
| `server.js` | Servidor alternativo (Render, Railway ou local) |
| `botpress-action.js` | Código da Action que chama a API de dentro do Botpress |
| `test.js` | Testes: `npm test` |

## 1. Publicar na Vercel (grátis, ~5 min)

1. Crie um repositório no GitHub e suba esta pasta inteira.
2. Em vercel.com, entre com o GitHub → **Add New → Project** → importe o repositório → **Deploy** (não precisa mudar nenhuma configuração).
3. Opcional: em **Settings → Environment Variables**, crie `API_KEY` com uma senha qualquer e faça **Redeploy**.
4. Sua URL fica: `https://NOME-DO-PROJETO.vercel.app/api/simulate`

Alternativa (Render): **New → Web Service** → repositório → Start command `npm start`. URL: `https://NOME.onrender.com/api/simulate`. No plano grátis, a primeira chamada depois de um tempo parado demora ~30 s.

## 2. Testar a URL

```bash
curl -X POST https://NOME-DO-PROJETO.vercel.app/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"stake":20,"odd":1.9,"betsPerWeek":5,"months":12,"annualRate":0.15}'
```

## 3. Ligar no Botpress

1. **Bot Settings → Configuration Variables**: crie `SIMULATOR_URL` (e `SIMULATOR_API_KEY` se configurou a chave).
2. Crie uma **Action** chamada `runBettingSimulation`, com os inputs listados no topo de `botpress-action.js`, e cole o código.
3. No playbook, passo 5, troque "Call the simulator (Execute Code card, appendix)" por: "Call the `runBettingSimulation` action". Se a resposta vier com `ok: false`, o agente explica o erro em vez de inventar números.

## Entrada (POST JSON)

| Campo | Obrigatório | Exemplo | Observação |
|---|---|---|---|
| `stake` | sim | 20 | R$ por aposta |
| `odd` | sim | 1.9 | odd decimal |
| `betsPerWeek` | sim | 5 | |
| `months` | não | 12 | padrão 12 |
| `allOdds` | não | `[2.1, 3.3, 3.6]` ou `"2.1, 3.3, 3.6"` | calcula a margem exata |
| `margin` | não | 0.06 | usada se `allOdds` faltar — **ajuste para o valor do seu PDF** |
| `bankroll` | não | 1000 | ativa probabilidade de ruína e de dobrar |
| `annualRate` | não | 0.15 | taxa de referência (Selic/CDI) em decimal |
| `userProbability` | não | 0.6 | cenário hipotético (passo 7) |
| `seed` | não | 42 | semente fixa = resultados reproduzíveis |

## Saída (resumo)

- `probabilities`: implícita, justa, usada, margem da casa (%), probabilidade de empate
- `expectedValue`: ROI por aposta (%), nº de apostas, total apostado, resultado teórico
- `simulation`: média, P5, P25, mediana, P75, P95, pior, melhor, chance de terminar no lucro, ruína, dobrar, `valid`
- `opportunityCost`: total investido, valor futuro, ganho do investimento, diferença vs. mediana das apostas
- `kelly.fraction`: fração ótima da banca (0 quando o valor esperado é negativo)

Exemplo real (R$20, odd 1,90, 5/semana, 12 meses, 15% a.a.): total apostado R$5.200; perda esperada ≈ R$294; mediana −R$298; 17,8% de chance de terminar no lucro; o mesmo dinheiro investido renderia ≈ R$388.
