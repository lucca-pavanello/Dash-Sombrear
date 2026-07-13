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

  // Find the return line with dimensions and replace it
  // The line contains: ${l}\u00d7${a}m  (where \u00d7 is the literal 6-char escape in the code)
  // We find it by the unique pattern of the × escape sequence
  const dimPattern = '${l}\\u00d7${a}m';  // this is the literal text in the code
  const idx = code.indexOf(dimPattern);
  if (idx < 0) {
    console.log('dimension pattern not found');
    // Try with actual × char
    const idx2 = code.indexOf('${l}\u00d7${a}m');
    console.log('With actual × char:', idx2 >= 0 ? 'FOUND at ' + idx2 : 'not found');
    return;
  }

  // Find the start of this return statement (the backtick before •)
  const backtickBefore = code.lastIndexOf('`', idx);
  // Find the end of this statement (the backtick + ; after ${a}m)
  const backtickAfter = code.indexOf('`', idx + dimPattern.length);
  if (backtickBefore < 0 || backtickAfter < 0) {
    console.log('could not find template literal boundaries');
    return;
  }

  // The full template literal content that we want to replace
  const fullOld = code.substring(backtickBefore, backtickAfter + 2); // include `;
  console.log('OLD:', JSON.stringify(fullOld));

  // New: same template literal but without the dimension part
  // Find where ${l} starts (remove " ${l}\u00d7${a}m" from the end)
  const lExprStart = code.lastIndexOf(' ${l}', idx);
  const newTemplate = code.substring(backtickBefore, lExprStart) + '`';
  console.log('NEW:', JSON.stringify(newTemplate));

  code = code.substring(0, backtickBefore) + newTemplate + code.substring(backtickAfter + 1);
  console.log('Fix linhasMedidas: OK');

  node.parameters.jsCode = code;
  const res = await req('PUT', '/api/v1/workflows/XTzhHWUmv0ewvhh4', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: cleanSettings(wf.settings), staticData: wf.staticData
  });
  console.log('Save:', res.id ? 'OK' : JSON.stringify(res).slice(0, 120));
}

fix().catch(console.error);
