#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const N8N_HOST = 'https://n8n-n8n.yjlhot.easypanel.host';
const N8N_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzM2QzZDk5YS00NjMyLTQyMmItOTZkZi03ZTc5M2Y5YzMwZjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RlNzMzM2MtMTJlMS00ZmJjLWE0OTItZDJhYjVkM2U5ZGE1IiwiaWF0IjoxNzczMTkwOTA0fQ.DI0te7DG89FQOywg1jdXRGbsV8udA-NuaEK88nvIYBs';
const WF_ID   = 'XTzhHWUmv0ewvhh4';

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
    };
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const NEW_CODE = `const itens = $input.all();
if (itens.length === 0) return [];

// === PRE-AGREGAÇÃO: combinar medidas da mesma persiana ===
function parseMoney(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\\./g, '').replace(',', '.')) || 0;
}
function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RODAPE = 'email: *sombrear@ig.com.br*\\nAv. Dr. Fernando Costa, 984 📍';

const grupoMap = new Map();
const grupoOrdem = [];
for (const item of itens) {
  const g = item.json.persiana_grupo;
  const key = g ? String(g) : ('_solo_' + grupoOrdem.length);
  if (!grupoMap.has(key)) { grupoMap.set(key, []); grupoOrdem.push(key); }
  grupoMap.get(key).push(item);
}

const itensBase = [];
for (const key of grupoOrdem) {
  const grupo = grupoMap.get(key);
  if (grupo.length === 1) {
    itensBase.push(grupo[0]);
    continue;
  }
  // Múltiplas medidas da mesma persiana — agregar em 1 item
  const ultimo     = grupo[grupo.length - 1];
  const totalVenda = grupo.reduce((s, i) => s + parseMoney(i.json.valor_venda), 0);
  const totalCusto = grupo.reduce((s, i) => s + parseMoney(i.json.custo), 0);
  const totalQtd   = grupo.reduce((s, i) => s + (parseInt(i.json.quantidade) || 1), 0);
  const modelo     = ultimo.json.modelo_persiana  || '';
  const tecido     = ultimo.json.tecido_original  || '';
  const ferragem   = ultimo.json.cor_ferragem     || '';
  const acabamento = ultimo.json.acabamentos      || '';
  const nomeCliente = ultimo.json.nome_do_cliente || '';

  // Extrai Condições e Rodapé do resumo do último item
  const resumoBase = ultimo.json.resumo_curto_valor_ao_cliente || '';
  const pCond  = resumoBase.indexOf('\\nCondições de Pagamento:');
  const pObs   = resumoBase.indexOf('\\nObservações Adicionais:');
  const pEmail = resumoBase.indexOf('\\nemail:');
  const condEnd = pObs >= 0 ? pObs : (pEmail >= 0 ? pEmail : resumoBase.length);
  const cond   = pCond >= 0 ? resumoBase.substring(pCond + 1, condEnd).trim() : '';
  const rodape = pEmail >= 0 ? resumoBase.substring(pEmail + 1).trim() : '';

  // FIX 1: linha única com quantidade total e nomenclatura_comercial
  const nomenclatura = ultimo.json.nomenclatura_comercial || (modelo + (tecido ? ' ' + tecido : ''));
  const linhasMedidas = '• ' + String(totalQtd).padStart(2, '0') + ' ' + nomenclatura;

  var totalBando = grupo.reduce(function(s, i) { return s + (parseMoney(i.json.valor_venda_acabamento) || 0); }, 0);
  var acabNomeGrupo = (ultimo.json.acabamentos || '');
  let textoAgregado = nomeCliente + '\\n\\nDescrição do Produto:\\n' + linhasMedidas;
  textoAgregado += '\\n\\nValor total: R$ ' + fmtBRL(totalVenda);
  if (totalBando > 0 && acabNomeGrupo && acabNomeGrupo !== 'Sem') {
    textoAgregado += '\\n\\n+ ' + acabNomeGrupo + ' (opcional): R$ ' + fmtBRL(totalBando);
  }
  if (cond) textoAgregado += '\\n\\n' + cond;
  const precoInst = ultimo.json.preco_instalacao_total;
  const sobCons   = ultimo.json.instalacao_sob_consulta === true;
  if (sobCons) {
    textoAgregado += '\\n\\nObservações Adicionais:\\n- Instalação sob consulta.';
  } else if (precoInst != null && precoInst > 0) {
    textoAgregado += '\\n\\nObservações Adicionais:\\n- Instalação opcional: acréscimo de R$ ' + fmtBRL(precoInst) + ' (sob consulta de localidade).';
  }
  if (rodape) textoAgregado += '\\n\\n' + rodape;

  itensBase.push({
    json: {
      ...ultimo.json,
      valor_venda:                   totalVenda,
      custo:                         totalCusto,
      quantidade:                    totalQtd,
      valor_venda_acabamento:         totalBando,
      largura:                       null,
      altura:                        null,
      ambiente_label:                ultimo.json.ambiente || ultimo.json.ambiente_label || '',
      resumo_curto_valor_ao_cliente: textoAgregado,
    }
  });
}
// === FIM PRE-AGREGAÇÃO ===

const whats = itensBase.some(i => i.json.whats === true || i.json.whats === 'true');

const sorted = [...itensBase].sort((a, b) =>
  (parseInt(a.json.ambiente_index) || 0) - (parseInt(b.json.ambiente_index) || 0)
);

function padNum(n) { return String(n).padStart(2, '0'); }
function normalizarQuantidades(msg) {
  return msg.replace(/• (\\d+)/g, (_, n) => '• ' + padNum(parseInt(n)));
}


function extrairCorpo(msg) {
  const descIdx  = msg.indexOf('Descrição do Produto:');
  const condIdx  = msg.indexOf('\\nCondições de Pagamento:');
  const obsIdx   = msg.indexOf('\\nObservações Adicionais:');
  const emailIdx = msg.indexOf('\\nemail:');

  const descEnd = condIdx >= 0 ? condIdx : (obsIdx >= 0 ? obsIdx : (emailIdx >= 0 ? emailIdx : msg.length));
  const descRaw = descIdx >= 0 ? msg.substring(descIdx, descEnd).trim() : '';
  const NL = String.fromCharCode(10);
  // FIX 2: filter "+ Bando..." lines from extrairCorpo to avoid duplication
  const descParte = descRaw.split(NL).filter(function(l) { return !l.includes('Ferragem:') && !l.includes('Acabamento:') && !/^Valor total:/i.test(l.trim()) && !/^\\+\\s/.test(l.trim()); }).map(function(l) {
    var x = l.indexOf('×');
    if (x < 0) return l;
    var sp = x - 1;
    while (sp > 0 && l[sp] !== ' ') sp--;
    var t = l.substring(0, sp);
    while (t.length > 0 && t[t.length - 1] === ' ') t = t.slice(0, -1);
    return t;
  }).join(NL);

  let obsParte = '';
  if (obsIdx >= 0) {
    const obsEnd = emailIdx >= 0 ? emailIdx : msg.length;
    const obsRaw = msg.substring(obsIdx + 1, obsEnd);
    const linhasConteudo = obsRaw.split('\\n').filter(l =>
      l.trim().startsWith('-') && !l.includes('Instalação opcional') && !l.includes('Acabamento opcional')
    );
    if (linhasConteudo.length > 0) {
      obsParte = 'Observações Adicionais:\\n' + linhasConteudo.join('\\n');
    }
  }

  const corpo = descParte + (obsParte ? '\\n\\n' + obsParte : '');
  return normalizarQuantidades(corpo);
}

function extrairCondicoes(msg) {
  const condIdx  = msg.indexOf('\\nCondições de Pagamento:');
  const obsIdx   = msg.indexOf('\\nObservações Adicionais:');
  const emailIdx = msg.indexOf('\\nemail:');
  if (condIdx < 0) return '';
  const condEnd = obsIdx >= 0 ? obsIdx : (emailIdx >= 0 ? emailIdx : msg.length);
  return msg.substring(condIdx + 1, condEnd).trim();
}

function extrairRodape(msg) {
  const emailIdx = msg.indexOf('\\nemail:');
  return emailIdx >= 0 ? msg.substring(emailIdx + 1).trim() : '';
}

let mensagemFinal;

if (sorted.length === 1) {
  var s1 = sorted[0];
  var s1msg    = s1.json.resumo_curto_valor_ao_cliente || '';
  var s1descIdx = s1msg.indexOf('Descrição do Produto:');
  var s1prefix = s1descIdx > 0 ? s1msg.substring(0, s1descIdx).trim() : '';
  var s1corpo  = extrairCorpo(s1msg);
  var s1cond   = extrairCondicoes(s1msg);
  var s1rodape = extrairRodape(s1msg);
  var s1venda  = parseMoney(s1.json.valor_venda) || 0;
  var s1bando  = parseMoney(s1.json.valor_venda_acabamento) || 0;
  var s1acab   = s1.json.acabamentos || '';
  var s1inst   = s1.json.preco_instalacao_total;
  var s1sob    = s1.json.instalacao_sob_consulta === true;
  var NL1 = String.fromCharCode(10);
  // FIX 3: skip prefix if it equals nome_do_cliente (WhatsApp node already adds client name)
  var usePrefix = s1prefix && s1prefix !== (s1.json.nome_do_cliente || '');
  // FIX 4: add Valor total line (s1venda was computed but never included)
  var s1valTotal = s1venda > 0 ? 'Valor total: R$ ' + fmtBRL(s1venda) : '';
  var s1val = '';
  if (s1bando > 0 && s1acab && s1acab !== 'Sem') { s1val = '+ ' + s1acab + ' (opcional): R$ ' + fmtBRL(s1bando); }
  var s1obs = '';
  if (s1sob) { s1obs = 'Observações Adicionais:' + NL1 + '- Instalação sob consulta.'; }
  else if (s1inst != null && s1inst > 0) { s1obs = 'Observações Adicionais:' + NL1 + '- Instalação opcional: acréscimo de R$ ' + fmtBRL(s1inst) + ' (sob consulta de localidade).'; }
  mensagemFinal = (usePrefix ? usePrefix + NL1 + NL1 : '') + s1corpo + (s1valTotal ? NL1 + NL1 + s1valTotal : '') + (s1val ? NL1 + NL1 + s1val : '') + (s1obs ? NL1 + NL1 + s1obs : '') + (s1cond ? NL1 + NL1 + s1cond : '') + NL1 + NL1 + RODAPE;
  mensagemFinal = normalizarQuantidades(mensagemFinal);
} else {
  const nomeCliente     = sorted[0].json.nome_do_cliente || '';
  const precoInstalacao = sorted[0].json.preco_instalacao_total;
  const sobConsulta     = sorted[0].json.instalacao_sob_consulta === true;
  const msg0            = sorted[0].json.resumo_curto_valor_ao_cliente || '';

  const grupos = [];
  const vistos = {};
  for (const item of sorted) {
    const amb = item.json.ambiente || item.json.ambiente_label || '';
    if (!vistos[amb]) {
      vistos[amb] = [];
      grupos.push({ ambiente: amb, itens: vistos[amb] });
    }
    vistos[amb].push(item);
  }

  const secoes = grupos.map(grupo => {
    const { ambiente, itens: gi } = grupo;
    let secao = '*' + ambiente + ':*';
    if (gi.length === 1) {
      var giItem = gi[0];
      var giCorpo = extrairCorpo(giItem.json.resumo_curto_valor_ao_cliente || '');
      var giVenda = parseMoney(giItem.json.valor_venda) || 0;
      var giBando = parseMoney(giItem.json.valor_venda_acabamento) || 0;
      var giAcab  = giItem.json.acabamentos || '';
      if (giVenda > 0) { giCorpo += '\\n\\nValor total: R$ ' + fmtBRL(giVenda); }
      if (giBando > 0 && giAcab && giAcab !== 'Sem') {
        giCorpo += '\\n\\n+ ' + giAcab + ' (opcional): R$ ' + fmtBRL(giBando);
      }
      secao += '\\n' + giCorpo;
    } else {
      const opcoes = gi.map((item, idx) => {
        const opCorpo = extrairCorpo(item.json.resumo_curto_valor_ao_cliente || '');
        const opVenda = parseMoney(item.json.valor_venda) || 0;
        const opBando = parseMoney(item.json.valor_venda_acabamento) || 0;
        const opAcab  = item.json.acabamentos || '';
        let opVal = 'Valor total: R$ ' + fmtBRL(opVenda);
        if (opBando > 0 && opAcab && opAcab !== 'Sem') { opVal += '\\n\\n+ ' + opAcab + ' (opcional): R$ ' + fmtBRL(opBando); }
        return '*Opção ' + padNum(idx + 1) + ':*\\n' + opCorpo + '\\n\\n' + opVal;
      });
      secao += '\\n\\n' + opcoes.join('\\n\\n---\\n\\n');
    }
    return secao;
  });

  const condicoes = extrairCondicoes(msg0);
  const rodape    = extrairRodape(msg0);

  let linhaInstalacao = '';
  if (sobConsulta) {
    linhaInstalacao = '- Instalação sob consulta.';
  } else if (precoInstalacao != null && precoInstalacao > 0) {
    linhaInstalacao = '- Instalação opcional: acréscimo de R$ ' + fmtBRL(precoInstalacao) + ' (sob consulta de localidade).';
  }

  const obsFinal = linhaInstalacao
    ? 'Observações Adicionais:\\n' + linhaInstalacao
    : '';

  mensagemFinal =
    '*ORÇAMENTO - ' + nomeCliente + '*\\n\\n' +
    secoes.join('\\n\\n') +
    (obsFinal  ? '\\n\\n' + obsFinal  : '') +
    (condicoes ? '\\n\\n' + condicoes : '') +
    '\\n\\n' + RODAPE;
}

const ultimo = sorted.length - 1;
return sorted.map((item, idx) => ({
  json: {
    ...item.json,
    resumo_curto_valor_ao_cliente: idx === ultimo ? mensagemFinal : item.json.resumo_curto_valor_ao_cliente,
    enviar_whats_agora: idx === ultimo && whats,
  }
}));`;

async function main() {
  // 1. Fetch workflow
  console.log('Fetching workflow...');
  const getRes = await request('GET', `${N8N_HOST}/api/v1/workflows/${WF_ID}`);
  if (getRes.status !== 200) {
    console.error('GET failed:', getRes.status, getRes.body.slice(0, 200));
    process.exit(1);
  }
  const wf = JSON.parse(getRes.body);
  console.log('Workflow:', wf.name, '| nodes:', wf.nodes.length);

  // 2. Find and update Acumular_Mensagens
  const node = wf.nodes.find(n => n.name === 'Acumular_Mensagens');
  if (!node) {
    console.error('Node Acumular_Mensagens not found!');
    process.exit(1);
  }
  console.log('Found node:', node.name, '| type:', node.type);

  const oldCode = node.parameters.jsCode || node.parameters.functionCode || '';
  console.log('Old code length:', oldCode.length);

  if (node.parameters.jsCode !== undefined) {
    node.parameters.jsCode = NEW_CODE;
  } else {
    node.parameters.functionCode = NEW_CODE;
  }
  console.log('New code length:', NEW_CODE.length);

  // 3. PUT workflow (only required fields — n8n rejects unknown settings props)
  const allowedSettings = ['executionOrder', 'timezone', 'callerPolicy', 'errorWorkflow', 'saveManualExecutions', 'saveExecutionProgress', 'saveDataSuccessExecution', 'saveDataErrorExecution'];
  const filteredSettings = {};
  for (const k of allowedSettings) {
    if (wf.settings && wf.settings[k] !== undefined) filteredSettings[k] = wf.settings[k];
  }
  const putBody = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: filteredSettings,
    staticData: wf.staticData || null,
  };

  console.log('Putting workflow...');
  const putRes = await request('PUT', `${N8N_HOST}/api/v1/workflows/${WF_ID}`, putBody);
  console.log('PUT status:', putRes.status);
  if (putRes.status !== 200) {
    console.error('PUT failed:', putRes.body.slice(0, 500));
    process.exit(1);
  }
  const updated = JSON.parse(putRes.body);
  const updNode = updated.nodes.find(n => n.name === 'Acumular_Mensagens');
  const updCode = updNode?.parameters?.jsCode || updNode?.parameters?.functionCode || '';
  console.log('Updated code length:', updCode.length);
  console.log('Fix 1 (single linhasMedidas):', updCode.includes("'• ' + String(totalQtd).padStart(2, '0')") ? 'OK' : 'MISSING');
  console.log('Fix 2 (filter + lines):', updCode.includes('/^\\\\+\\\\s/') ? 'OK' : 'MISSING');
  console.log('Fix 3 (usePrefix):', updCode.includes('usePrefix') ? 'OK' : 'MISSING');
  console.log('Fix 4 (s1valTotal):', updCode.includes('s1valTotal') ? 'OK' : 'MISSING');
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
