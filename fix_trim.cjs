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
  const old = node.parameters.jsCode;

  // Find the 'const corpo' line via regex and add .trim()
  const before = old;
  node.parameters.jsCode = old.replace(
    /const corpo = \(descParte \+ \(obsParte \? '\\n\\n' \+ obsParte : ''\)\);/,
    "const corpo = (descParte + (obsParte ? '\\n\\n' + obsParte : '')).trim();"
  ).replace(
    /const corpo = descParte \+ \(obsParte \? '\\n\\n' \+ obsParte : ''\);/,
    "const corpo = (descParte + (obsParte ? '\\n\\n' + obsParte : '')).trim();"
  );

  if (node.parameters.jsCode === before) {
    console.log('Pattern NOT matched by regex. corpo line repr:');
    const idx = old.indexOf('const corpo');
    console.log(JSON.stringify(old.substring(idx, idx + 90)));
    process.exit(1);
  }

  console.log('Replaced OK');

  // Verify
  const newCode = node.parameters.jsCode;
  const idx2 = newCode.indexOf('const corpo');
  console.log('New corpo line:', newCode.substring(idx2, idx2 + 90));

  const settings = {};
  for (const k of ['executionOrder', 'timezone', 'callerPolicy', 'errorWorkflow']) {
    if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  }

  const put = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings, staticData: wf.staticData || null
  });
  console.log('PUT status:', put.s);
  if (put.s === 200) console.log('Done!');
  else console.log(put.b.slice(0, 300));
})();
