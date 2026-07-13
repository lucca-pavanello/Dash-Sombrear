const https = require('https');
const fs = require('fs');
const path = require('path');

const N8N_HOST = 'n8n-n8n.yjlhot.easypanel.host';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzM2QzZDk5YS00NjMyLTQyMmItOTZkZi03ZTc5M2Y5YzMwZjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RlNzMzM2MtMTJlMS00ZmJjLWE0OTItZDJhYjVkM2U5ZGE1IiwiaWF0IjoxNzczMTkwOTA0fQ.DI0te7DG89FQOywg1jdXRGbsV8udA-NuaEK88nvIYBs';

// Code lido de arquivo separado para evitar conflito com template literals
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'validar_code_v3.js'), 'utf8');

const WORKFLOWS = [
  { id: 'ox3dY1ErAF7AflDS', name: 'Rolo' },
  { id: 'QdS7PySPhz7WBqOd', name: 'Double' },
  { id: 'TH6C2XH4DZpVNttx', name: 'Romana' },
  { id: 'RCb4YeZImv0SBTsK', name: 'PH Aluminio' },
  { id: 'hQnfyByL6TxRr0lN', name: 'PV' },
  { id: '6fhbRgLi0ocbiJFb', name: 'PH_50' },
  { id: 'EmxIkMe9qybzU20D', name: 'Rolo Motorizado' },
];

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_HOST,
      path: apiPath,
      method: method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch(e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function fixWorkflow(wfId, wfName) {
  console.log(`\n=== ${wfName} (${wfId}) ===`);

  const get = await apiRequest('GET', `/api/v1/workflows/${wfId}`);
  if (get.status !== 200) {
    console.log(`  ERRO ao buscar: HTTP ${get.status}`);
    return;
  }

  const wf = get.body;
  let count = 0;

  for (const node of wf.nodes) {
    if (node.name && node.name.startsWith('Code_Validar_Output')) {
      console.log(`  -> Atualizando: ${node.name}`);
      const params = node.parameters || {};
      if (params.jsCode !== undefined) {
        params.jsCode = NEW_CODE;
        count++;
      } else if (params.functionCode !== undefined) {
        params.functionCode = NEW_CODE;
        count++;
      } else {
        console.log(`  AVISO: parametros encontrados: ${JSON.stringify(Object.keys(params))}`);
      }
    }
  }

  if (count === 0) {
    console.log(`  Nenhum Code_Validar_Output encontrado.`);
    const names = wf.nodes.map(n => n.name).join(' | ');
    console.log(`  Nos: ${names.slice(0, 400)}`);
    return;
  }

  function cleanSettings(s) {
    const clean = {};
    ['executionOrder','timezone','callerPolicy','saveManualExecutions','saveDataErrorExecution',
     'saveDataSuccessExecution','saveExecutionProgress','errorWorkflow'].forEach(k => {
      if ((s || {})[k] !== undefined) clean[k] = s[k];
    });
    return clean;
  }

  const putBody = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: cleanSettings(wf.settings),
    staticData: wf.staticData,
  };

  const put = await apiRequest('PUT', `/api/v1/workflows/${wfId}`, putBody);
  if (put.status === 200) {
    console.log(`  OK -- ${count} no(s) atualizados`);
  } else {
    console.log(`  ERRO ao salvar: HTTP ${put.status}`);
    console.log(`  Body: ${JSON.stringify(put.body).slice(0, 300)}`);
  }
}

(async () => {
  console.log(`Codigo a deploy (primeiros 100 chars): ${NEW_CODE.slice(0, 100)}`);
  for (const wf of WORKFLOWS) {
    await fixWorkflow(wf.id, wf.name);
  }
  console.log('\n=== Concluido ===');
})();
