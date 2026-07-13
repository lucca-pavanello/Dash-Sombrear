'use strict';
const https = require('https');

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzM2QzZDk5YS00NjMyLTQyMmItOTZkZi03ZTc5M2Y5YzMwZjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RlNzMzM2MtMTJlMS00ZmJjLWE0OTItZDJhYjVkM2U5ZGE1IiwiaWF0IjoxNzczMTkwOTA0fQ.DI0te7DG89FQOywg1jdXRGbsV8udA-NuaEK88nvIYBs';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'n8n-n8n.yjlhot.easypanel.host',
      path, method,
      rejectUnauthorized: false,
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }
    }, resp => {
      let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve({ s: resp.statusCode, b: d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const get = await req('GET', '/api/v1/workflows/XTzhHWUmv0ewvhh4');
  const wf = JSON.parse(get.b);
  const node = wf.nodes.find(n => n.name === 'Acumular_Mensagens');
  let code = node.parameters.jsCode;

  // FIX A: usePrefix must hold the STRING, not boolean true/false
  // "s1prefix && s1prefix !== X" short-circuits to the boolean of the comparison
  const oldA = "usePrefix = s1prefix && s1prefix !== (s1.json.nome_do_cliente || '');";
  const newA  = "usePrefix = (s1prefix && s1prefix !== (s1.json.nome_do_cliente || '')) ? s1prefix : '';";
  if (!code.includes(oldA)) { console.log('Fix A not found!', JSON.stringify(oldA)); process.exit(1); }
  code = code.replace(oldA, newA);
  console.log('Fix A applied: usePrefix now holds the string value');

  // FIX B: also filter *Valor: R$ X* lines in extrairCorpo (Romana agent includes these)
  const oldB = "!/^\\+\\s/.test(l.trim()); }).m";
  const newB  = "!/^\\+\\s/.test(l.trim()) && !/^\\*?Valor[\\s:]/i.test(l.trim()); }).m";
  if (!code.includes(oldB)) { console.log('Fix B not found!', JSON.stringify(oldB)); process.exit(1); }
  code = code.replace(oldB, newB);
  console.log('Fix B applied: extrairCorpo now filters *Valor: R$ X* lines');

  node.parameters.jsCode = code;

  const settings = {};
  for (const k of ['executionOrder', 'timezone', 'callerPolicy', 'errorWorkflow']) {
    if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  }

  const put = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings, staticData: wf.staticData || null
  });
  console.log('PUT status:', put.s);
  if (put.s === 200) {
    console.log('Done!');
    const check = await req('GET', '/api/v1/workflows/XTzhHWUmv0ewvhh4');
    const c2 = JSON.parse(check.b).nodes.find(n => n.name === 'Acumular_Mensagens').parameters.jsCode;
    const upIdx = c2.indexOf('usePrefix');
    console.log('usePrefix now:', c2.substring(upIdx, upIdx + 80));
    const flIdx = c2.indexOf('test(l.trim()); })');
    console.log('Filter now:', c2.substring(flIdx - 60, flIdx + 20));
  } else {
    console.log(put.b.slice(0, 300));
  }
})();
