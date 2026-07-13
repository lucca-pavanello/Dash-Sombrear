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
      let chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
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

async function fixMultiOption() {
  const wf = await req('GET', '/api/v1/workflows/XTzhHWUmv0ewvhh4');
  const node = wf.nodes.find(n => n.name === 'Acumular_Mensagens');
  let code = node.parameters.jsCode;

  // The actual text in the code (using real characters):
  // const opcoes = gi.map((item, idx) =>
  //         '*Opção ' + padNum(idx + 1) + ':*\n' + extrairCorpo(item.json.resumo_curto_valor_ao_cliente || '')
  //       );
  // We search for this and replace with a block version that appends valor + bando

  // Find the exact substring
  const marker = "const opcoes = gi.map((item, idx) =>";
  const idx = code.indexOf(marker);
  if (idx === -1) {
    console.log('multi-option marker not found');
    return;
  }

  // Find the end of the statement (the closing ");")
  const endMarker = ");\n      secao += ";
  const endIdx = code.indexOf(endMarker, idx);
  if (endIdx === -1) {
    console.log('multi-option end marker not found');
    return;
  }

  const OLD = code.substring(idx, endIdx + 2); // include ");"
  console.log('Found OLD block:', JSON.stringify(OLD));

  const NEW = `const opcoes = gi.map((item, idx) => {
        const opCorpo = extrairCorpo(item.json.resumo_curto_valor_ao_cliente || '');
        const opVenda = parseMoney(item.json.valor_venda) || 0;
        const opBando = parseMoney(item.json.valor_venda_acabamento) || 0;
        const opAcab  = item.json.acabamentos || '';
        let opVal = 'Valor total: R$ ' + fmtBRL(opVenda);
        if (opBando > 0 && opAcab && opAcab !== 'Sem') { opVal += '\\n\\n+ ' + opAcab + ' (opcional): R$ ' + fmtBRL(opBando); }
        return '*Op\u00e7\u00e3o ' + padNum(idx + 1) + ':*\\n' + opCorpo + '\\n\\n' + opVal;
      });`;

  code = code.slice(0, idx) + NEW + code.slice(idx + OLD.length);
  console.log('Fix 3 (multi-option valor): OK');

  node.parameters.jsCode = code;
  const res = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Acumular save:', res.id ? 'OK' : JSON.stringify(res).slice(0, 120));
}

fixMultiOption().catch(console.error);
