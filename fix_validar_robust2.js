const https = require('https');
const fs = require('fs');
const path = require('path');

const N8N_HOST = 'n8n-n8n.yjlhot.easypanel.host';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOTBkYThiNS1lMDA1LTQzMzYtOGFiMy05ZDY1ZWZjNzQzYzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQzMTc3NzQyfQ.Koa_SgDf8WByJxNXmj6HtF8C_vqPwVH5JZKiGKlvQ5k';

// Read the code from separate file to avoid backtick/template-literal issues
const CODE_FILE = path.join(__dirname, 'validar_code_v3.js');
const NEW_CODE = fs.readFileSync(CODE_FILE, 'utf8');

const WORKFLOWS = [
  { id: 'ox3dY1ErAF7AflDS', name: 'Rolo' },
  { id: 'QdS7PySPhz7WBqOd', name: 'Double' },
  { id: 'TH6C2XH4DZpVNttx', name: 'Romana' },
  { id: 'RCb4YeZImv0SBTsK', name: 'PH Aluminio' },
  { id: 'hQnfyByL6TxRr0lN', name: 'PV' },
  { id: '6fhbRgLi0ocbiJFb', name: 'PH_50' },
  { id: 'EmxIkMe9qybzU20D', name: 'Rolo Motorizado' },
];

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_HOST,
      path: path,
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
    console.log(`  ERRO ao buscar: ${get.status}`);
    return;
  }

  const wf = get.body;
  let count = 0;

  for (const node of wf.nodes) {
    if (node.name && node.name.startsWith('Code_Validar_Output')) {
      console.log(`  Atualizando no: ${node.name}`);
      if (node.parameters && node.parameters.jsCode !== undefined) {
        node.parameters.jsCode = NEW_CODE;
        count++;
      } else if (node.parameters && node.parameters.functionCode !== undefined) {
        node.parameters.functionCode = NEW_CODE;
        count++;
      } else {
        console.log(`  AVISO: parametros do no: ${JSON.stringify(Object.keys(node.parameters || {}))}`);
      }
    }
  }

  if (count === 0) {
    console.log(`  Nenhum no Code_Validar_Output encontrado.`);
    const names = wf.nodes.map(n => n.name).join(', ');
    console.log(`  Nos existentes: ${names.slice(0, 300)}`);
    return;
  }

  const put = await apiRequest('PUT', `/api/v1/workflows/${wfId}`, wf);
  if (put.status === 200) {
    console.log(`  OK -- ${count} no(s) atualizado(s)`);
  } else {
    console.log(`  ERRO ao salvar: ${put.status} -- ${JSON.stringify(put.body).slice(0, 200)}`);
  }
}

(async () => {
  for (const wf of WORKFLOWS) {
    await fixWorkflow(wf.id, wf.name);
  }
  console.log('\nConcluido.');
})();
