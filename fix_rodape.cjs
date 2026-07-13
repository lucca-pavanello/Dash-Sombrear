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

async function fix() {
  const wf = await req('GET', '/api/v1/workflows/XTzhHWUmv0ewvhh4');
  const node = wf.nodes.find(n => n.name === 'Acumular_Mensagens');
  let code = node.parameters.jsCode;

  // 1. Adicionar constante RODAPE logo após a definição de parseMoney/fmtBRL
  const ANCHOR = 'function fmtBRL(v) {\n  return v.toLocaleString(\'pt-BR\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n}';
  const ANCHOR_NEW = ANCHOR + '\n\nconst RODAPE = \'email: *sombrear@ig.com.br*\\nAv. Dr. Fernando Costa, 984 \uD83D\uDCCD\';';

  if (!code.includes(ANCHOR)) {
    console.log('ANCHOR not found'); return;
  }
  if (code.includes('const RODAPE')) {
    console.log('RODAPE already defined, skipping anchor insert');
  } else {
    code = code.replace(ANCHOR, ANCHOR_NEW);
    console.log('Fix 1 (RODAPE const): OK');
  }

  // 2. sorted.length===1: substituir s1rodape por RODAPE
  // Antes: (s1rodape ? NL1 + NL1 + s1rodape : '')
  // Depois: NL1 + NL1 + RODAPE
  const OLD_S1_RODAPE = "(s1rodape ? NL1 + NL1 + s1rodape : '')";
  const NEW_S1_RODAPE = "NL1 + NL1 + RODAPE";
  if (code.includes(OLD_S1_RODAPE)) {
    code = code.replace(OLD_S1_RODAPE, NEW_S1_RODAPE);
    console.log('Fix 2 (s1rodape): OK');
  } else {
    console.log('Fix 2 (s1rodape): not found');
  }

  // 3. sorted.length>1: substituir rodape por RODAPE
  // Antes: (rodape    ? '\n\n' + rodape    : '')
  // Depois: '\n\n' + RODAPE
  const OLD_RODAPE = "(rodape    ? '\\n\\n' + rodape    : '')";
  const NEW_RODAPE = "'\\n\\n' + RODAPE";
  if (code.includes(OLD_RODAPE)) {
    code = code.replace(OLD_RODAPE, NEW_RODAPE);
    console.log('Fix 3 (rodape multi): OK');
  } else {
    // Try alternate spacing
    const alt = "(rodape ? '\\n\\n' + rodape : '')";
    if (code.includes(alt)) {
      code = code.replace(alt, NEW_RODAPE);
      console.log('Fix 3 (rodape multi alt): OK');
    } else {
      console.log('Fix 3 (rodape multi): not found');
      // Show context
      const idx = code.indexOf('rodape');
      console.log(JSON.stringify(code.substring(idx - 5, idx + 60)));
    }
  }

  node.parameters.jsCode = code;
  const res = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Save:', res.id ? 'OK' : JSON.stringify(res).slice(0, 120));
}

fix().catch(console.error);
