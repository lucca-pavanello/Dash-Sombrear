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

  // Fix 1: grouped linhasMedidas — remove dimensions (l×am)
  const OLD_LINHAS = "    return `\u2022 ${q} ${modelo} ${tecido} ${l}\u00d7${a}m`;";
  const NEW_LINHAS = "    return `\u2022 ${q} ${modelo} ${tecido}`;";

  if (code.includes(OLD_LINHAS)) {
    code = code.replace(OLD_LINHAS, NEW_LINHAS);
    console.log('Fix 1 (linhasMedidas): OK');
  } else {
    console.log('Fix 1 (linhasMedidas): NOT FOUND');
    const idx = code.indexOf('return `\u2022');
    if (idx >= 0) console.log('Found bullet line:', JSON.stringify(code.substring(idx, idx + 80)));
  }

  // Fix 2: extrairCorpo — strip dimensions from bullet lines
  // Current filter line:
  const OLD_FILTER = "  const descParte = descRaw.split(NL).filter(function(l) { return !l.includes('Ferragem:') && !l.includes('Acabamento:') && !/^Valor total:/i.test(l.trim()); }).join(NL);";
  // New: filter + map to remove "NUMBER×NUMBERm" suffix from bullet lines (no regex)
  const NEW_FILTER = [
    "  const descParte = descRaw.split(NL).filter(function(l) { return !l.includes('Ferragem:') && !l.includes('Acabamento:') && !/^Valor total:/i.test(l.trim()); }).map(function(l) {",
    "    var x = l.indexOf('\u00d7');",
    "    if (x < 0) return l;",
    "    var sp = x - 1;",
    "    while (sp > 0 && l[sp] !== ' ') sp--;",
    "    var t = l.substring(0, sp);",
    "    while (t.length > 0 && t[t.length - 1] === ' ') t = t.slice(0, -1);",
    "    return t;",
    "  }).join(NL);"
  ].join('\n');

  if (code.includes(OLD_FILTER)) {
    code = code.replace(OLD_FILTER, NEW_FILTER);
    console.log('Fix 2 (extrairCorpo strip dim): OK');
  } else {
    console.log('Fix 2 (extrairCorpo strip dim): NOT FOUND');
    const idx = code.indexOf('descParte');
    if (idx >= 0) console.log('descParte line:', JSON.stringify(code.substring(idx, idx + 120)));
  }

  node.parameters.jsCode = code;
  const res = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Save:', res.id ? 'OK' : JSON.stringify(res).slice(0, 120));
}

fix().catch(console.error);
