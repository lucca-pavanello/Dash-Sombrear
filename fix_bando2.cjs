const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzM2QzZDk5YS00NjMyLTQyMmItOTZkZi03ZTc5M2Y5YzMwZjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RlNzMzM2MtMTJlMS00ZmJjLWE0OTItZDJhYjVkM2U5ZGE1IiwiaWF0IjoxNzczMTkwOTA0fQ.DI0te7DG89FQOywg1jdXRGbsV8udA-NuaEK88nvIYBs';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'n8n-n8n.yjlhot.easypanel.host', port: 443, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
      rejectUnauthorized: false
    };
    const r = https.request(opts, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function cleanSettings(s) {
  const clean = {};
  ['executionOrder','timezone','callerPolicy','saveManualExecutions','saveDataErrorExecution',
   'saveDataSuccessExecution','saveExecutionProgress','errorWorkflow'].forEach(k => {
    if ((s || {})[k] !== undefined) clean[k] = s[k];
  });
  return clean;
}

// ─── Passo 1: Rolo → adicionar valor_venda_acabamento no return ───────────────
// valorAcabVenda já existe como: const valorAcabVenda = dadosCalculo?.vendas?.acabamento_4x || 0;
// Só precisamos adicionar ao objeto de retorno.
async function fixRoloReturn() {
  const wf = await req('GET', '/api/v1/workflows/ox3dY1ErAF7AflDS');
  const node = wf.nodes.find(n => n.name === 'Extrair_Menssagem - Script');
  let code = node.parameters.jsCode;

  const OLD_RET = '    valor_venda: formatarMoeda(valorVenda),';
  const NEW_RET = '    valor_venda: formatarMoeda(valorVenda),\n    valor_venda_acabamento: formatarMoeda(valorAcabVenda),';

  if (code.includes('valor_venda_acabamento')) {
    console.log('Rolo: valor_venda_acabamento já existe, pulando');
    return;
  }
  if (!code.includes(OLD_RET)) {
    console.log('Rolo: OLD_RET nao encontrado:', JSON.stringify(OLD_RET.slice(0,60)));
    return;
  }

  code = code.replace(OLD_RET, NEW_RET);
  node.parameters.jsCode = code;

  const res = await req('PUT', '/api/v1/workflows/ox3dY1ErAF7AflDS', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Rolo Extrair_Menssagem:', res.id ? 'OK' : JSON.stringify(res).slice(0,120));
}

// ─── Passo 2: Acumular_Mensagens ──────────────────────────────────────────────
async function fixAcumular() {
  const wf = await req('GET', '/api/v1/workflows/XTzhHWUmv0ewvhh4');
  const node = wf.nodes.find(n => n.name === 'Acumular_Mensagens');
  let code = node.parameters.jsCode;

  // 2a. Grouped textoAgregado: remover ferragem/acabamento, adicionar bando separado
  const OLD_AGG = `  let textoAgregado = \`\${nomeCliente}\\n\\nDescrição do Produto:\\n\${linhasMedidas}\`;
  if (ferragem && ferragem !== 'Sem') textoAgregado += \`\\n• Ferragem: \${ferragem}\`;
  if (acabamento && acabamento !== 'Sem') textoAgregado += \`\\n• Acabamento: \${acabamento}\`;
  textoAgregado += \`\\n\\nValor total: R$ \${fmtBRL(totalVenda)}\`;
  if (cond) textoAgregado += \`\\n\\n\${cond}\`;`;

  const NEW_AGG = `  var totalBando = grupo.reduce(function(s, i) { return s + (parseMoney(i.json.valor_venda_acabamento) || 0); }, 0);
  var acabNomeGrupo = (ultimo.json.acabamentos || '');
  let textoAgregado = \`\${nomeCliente}\\n\\nDescrição do Produto:\\n\${linhasMedidas}\`;
  textoAgregado += \`\\n\\nValor total: R$ \${fmtBRL(totalVenda)}\`;
  if (totalBando > 0 && acabNomeGrupo && acabNomeGrupo !== 'Sem') {
    textoAgregado += \`\\n\\n+ \${acabNomeGrupo} (opcional): R$ \${fmtBRL(totalBando)}\`;
  }
  if (cond) textoAgregado += \`\\n\\n\${cond}\`;`;

  // 2b. Push: adicionar valor_venda_acabamento antes de largura
  const OLD_PUSH = '      largura:                       null,\n      altura:                        null,';
  const NEW_PUSH = '      valor_venda_acabamento:         totalBando,\n      largura:                       null,\n      altura:                        null,';

  // 2c. extrairCorpo filter: também remove linhas "Valor total:"
  const OLD_FILT = "  const descParte = descRaw.split(NL).filter(function(l) { return !l.includes('Ferragem:') && !l.includes('Acabamento:'); }).join(NL);";
  const NEW_FILT = "  const descParte = descRaw.split(NL).filter(function(l) { return !l.includes('Ferragem:') && !l.includes('Acabamento:') && !/^Valor/i.test(l.trim()); }).join(NL);";

  // 2d. gi.length===1: reconstruir com valor + bando separado
  // Actual indentation is 4 spaces before "if"
  const OLD_GI1 = "    if (gi.length === 1) {\n      secao += '\\n' + extrairCorpo(gi[0].json.resumo_curto_valor_ao_cliente || '');\n    } else {";
  const NEW_GI1 = [
    "    if (gi.length === 1) {",
    "      var giItem = gi[0];",
    "      var giCorpo = extrairCorpo(giItem.json.resumo_curto_valor_ao_cliente || '');",
    "      var giVenda = parseMoney(giItem.json.valor_venda) || 0;",
    "      var giBando = parseMoney(giItem.json.valor_venda_acabamento) || 0;",
    "      var giAcab  = giItem.json.acabamentos || '';",
    "      giCorpo += '\\n\\nValor total: R$ ' + fmtBRL(giVenda);",
    "      if (giBando > 0 && giAcab && giAcab !== 'Sem') {",
    "        giCorpo += '\\n\\n+ ' + giAcab + ' (opcional): R$ ' + fmtBRL(giBando);",
    "      }",
    "      secao += '\\n' + giCorpo;",
    "    } else {"
  ].join('\n');

  // 2e. sorted.length===1: reconstruir com bando
  const OLD_S1 = "  mensagemFinal = normalizarQuantidades(sorted[0].json.resumo_curto_valor_ao_cliente || '');";
  const NEW_S1 = [
    "  var s1 = sorted[0];",
    "  var s1corpo  = extrairCorpo(s1.json.resumo_curto_valor_ao_cliente || '');",
    "  var s1cond   = extrairCondicoes(s1.json.resumo_curto_valor_ao_cliente || '');",
    "  var s1rodape = extrairRodape(s1.json.resumo_curto_valor_ao_cliente || '');",
    "  var s1venda  = parseMoney(s1.json.valor_venda) || 0;",
    "  var s1bando  = parseMoney(s1.json.valor_venda_acabamento) || 0;",
    "  var s1acab   = s1.json.acabamentos || '';",
    "  var s1inst   = s1.json.preco_instalacao_total;",
    "  var s1sob    = s1.json.instalacao_sob_consulta === true;",
    "  var NL1 = String.fromCharCode(10);",
    "  var s1val = 'Valor total: R$ ' + fmtBRL(s1venda);",
    "  if (s1bando > 0 && s1acab && s1acab !== 'Sem') { s1val += NL1 + NL1 + '+ ' + s1acab + ' (opcional): R$ ' + fmtBRL(s1bando); }",
    "  var s1obs = '';",
    "  if (s1sob) { s1obs = 'Observa\u00e7\u00f5es Adicionais:' + NL1 + '- Instala\u00e7\u00e3o sob consulta.'; }",
    "  else if (s1inst != null && s1inst > 0) { s1obs = 'Observa\u00e7\u00f5es Adicionais:' + NL1 + '- Instala\u00e7\u00e3o opcional: acr\u00e9scimo de R$ ' + fmtBRL(s1inst) + ' (sob consulta de localidade).'; }",
    "  mensagemFinal = s1corpo + NL1 + NL1 + s1val + (s1obs ? NL1 + NL1 + s1obs : '') + (s1cond ? NL1 + NL1 + s1cond : '') + (s1rodape ? NL1 + NL1 + s1rodape : '');",
    "  mensagemFinal = normalizarQuantidades(mensagemFinal);"
  ].join('\n');

  const steps = [
    [OLD_AGG,  NEW_AGG,  '2a grouped'],
    [OLD_PUSH, NEW_PUSH, '2b push'],
    [OLD_FILT, NEW_FILT, '2c filter'],
    [OLD_GI1,  NEW_GI1,  '2d gi single'],
    [OLD_S1,   NEW_S1,   '2e sorted1'],
  ];

  let allFound = true;
  for (const [search, , label] of steps) {
    if (label === '2b push' && code.includes('valor_venda_acabamento')) {
      console.log('SKIP (already applied):', label);
      continue;
    }
    if (label === '2c filter' && code.includes('!/^Valor/i')) {
      console.log('SKIP (already applied):', label);
      continue;
    }
    if (label === '2e sorted1' && code.includes('var s1 =')) {
      console.log('SKIP (already applied):', label);
      continue;
    }
    if (!code.includes(search)) {
      console.log('NAO ENCONTRADO:', label);
      console.log('Busca (primeiros 100 chars):', JSON.stringify(search.slice(0, 100)));
      // Print what the code actually has around the expected area
      allFound = false;
    } else {
      console.log('OK:', label);
    }
  }
  if (!allFound) {
    console.log('\n--- ABORTANDO: nem todos os padrões encontrados ---');
    return;
  }

  for (const [search, replace, label] of steps) {
    if (label === '2b push' && code.includes('valor_venda_acabamento')) continue;
    if (label === '2c filter' && code.includes('!/^Valor/i')) continue;
    if (label === '2e sorted1' && code.includes('var s1 =')) continue;
    code = code.replace(search, replace);
  }
  node.parameters.jsCode = code;

  const res = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Supervisor Acumular:', res.id ? 'OK' : JSON.stringify(res).slice(0, 120));
}

(async () => {
  await fixRoloReturn();
  await fixAcumular();
})().catch(console.error);
