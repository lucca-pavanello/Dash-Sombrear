const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/Usuario/Dash-Sombrear/wf_fixed.json', 'utf8'));
const nodes = data.nodes || [];

const formatoJSON = "\n\n## FORMATO DE SAÍDA OBRIGATÓRIO\nSua resposta FINAL deve conter APENAS este bloco JSON, sem texto antes nem depois:\n```json\n{\n  \"responsavel\": \"<nome>\",\n  \"cliente\": \"<nome>\",\n  \"quantidade\": 1,\n  \"nomenclatura_comercial\": \"<tecido>\",\n  \"custos\": {\n    \"resumo_custos\": {\n      \"custo_rolo_total\": 0,\n      \"custo_por_m2\": 0,\n      \"custo_acabamento_total\": 0,\n      \"instalacao_total\": 0\n    }\n  }\n}\n```";

// Agent1
const a1 = nodes.find(x => x.name === 'Preificador_Rolo - Agent1');
let p1 = a1.parameters.text;
if (p1.startsWith('=')) p1 = p1.slice(1);
p1 = p1.replace(
  /⚠️ REGRA CRÍTICA[^\n]*/,
  '⚠️ REGRA CRÍTICA: Nunca escreva texto descrevendo chamadas de ferramentas. Use as ferramentas silenciosamente e aguarde o resultado antes de responder.'
);
p1 = p1 + formatoJSON;
a1.parameters.text = p1;
console.log('Agent1 ok, len=' + p1.length);

// Agente_Retry1
const r1 = nodes.find(x => x.name === 'Agente_Retry1');
let pr1 = r1.parameters.text;
if (pr1.startsWith('=')) pr1 = pr1.slice(1);
pr1 = 'TENTATIVA 2: A tentativa anterior retornou texto intermediario de ferramenta em vez do JSON final. Use as ferramentas e retorne SOMENTE o JSON resultado.\n\n' + pr1;
pr1 = pr1.replace(
  /⚠️ REGRA CRÍTICA[^\n]*/,
  '⚠️ REGRA CRÍTICA: Sua resposta deve comecar com { ou com ```json. ZERO texto fora do JSON.'
);
pr1 = pr1 + formatoJSON;
r1.parameters.text = pr1;
console.log('Agente_Retry1 ok, len=' + pr1.length);

// Agente_Retry2
const r2 = nodes.find(x => x.name === 'Agente_Retry2');
let pr2 = r2.parameters.text;
if (pr2.startsWith('=')) pr2 = pr2.slice(1);
pr2 = 'TENTATIVA 3 (ULTIMA): Duas tentativas anteriores falharam por retornar texto de ferramenta. APENAS o bloco JSON abaixo e aceito como resposta valida.\n\n' + pr2;
pr2 = pr2.replace(
  /⚠️ REGRA CRÍTICA[^\n]*/,
  '⚠️ REGRA CRÍTICA: Responda SOMENTE com o JSON. Sem introducao, sem explicacao. A resposta deve comecar com { ou ```json.'
);
pr2 = pr2 + formatoJSON;
r2.parameters.text = pr2;
console.log('Agente_Retry2 ok, len=' + pr2.length);

fs.writeFileSync('C:/Users/Usuario/Dash-Sombrear/wf_fixed.json', JSON.stringify(data, null, 2));
console.log('Salvo wf_fixed.json');
