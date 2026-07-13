// Code_Validar_Output v3 — strips markdown fences, string fallback
let rawOutput = $input.first().json.output || $input.first().json.text || '';

// 1. Remove markdown fences before parsing
const cleaned = rawOutput
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```\s*$/, '')
  .trim();

// 2. Parse: try cleaned first, then greedy regex
let jsonData = {};
try {
  jsonData = JSON.parse(cleaned);
} catch(e1) {
  try {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) jsonData = JSON.parse(m[0]);
  } catch(e2) {
    jsonData = {};
  }
}

// 3. Structural validation
const isToolCall = !!(jsonData.type && jsonData.type === 'tool_use');
const temResponsavel = !!(jsonData.responsavel && jsonData.responsavel !== null && jsonData.responsavel !== '');
const temCustos = !!(jsonData.custos && typeof jsonData.custos === 'object');
const temCampoAlternativo = !!(
  jsonData.custo_total !== undefined ||
  jsonData.valor_venda !== undefined ||
  jsonData.custo_rolo_total !== undefined ||
  jsonData.resumo_calculo !== undefined
);

// 4. String fallback (handles edge cases where JSON.parse fails in sandbox)
const strTemResponsavel = rawOutput.includes('"responsavel"') &&
  !rawOutput.includes('"responsavel": null') &&
  !rawOutput.includes('"responsavel":null');
const strTemCustos = rawOutput.includes('"custos"') && (
  rawOutput.includes('custo_rolo_total') ||
  rawOutput.includes('custo_double_total') ||
  rawOutput.includes('custo_romana_total') ||
  rawOutput.includes('custo_vertical_total') ||
  rawOutput.includes('custo_horizontal_total') ||
  rawOutput.includes('custo_painel_total') ||
  rawOutput.includes('custo_cortina_total') ||
  rawOutput.includes('custo_motorizado_total') ||
  rawOutput.includes('instalacao_total') ||
  rawOutput.includes('custo_total')
);

const isValido = (
  ((temResponsavel && (temCustos || temCampoAlternativo)) || (strTemResponsavel && strTemCustos))
  && !isToolCall
);

const dadosPedido = $('Edit Fields').first().json;

if (isValido) {
  return [{ json: { ...$input.first().json, _valido: true } }];
} else {
  const retryCount = (dadosPedido._retry_count || 0) + 1;
  return [{
    json: {
      ...dadosPedido,
      _valido: false,
      _output_invalido: rawOutput.slice(0, 400),
      _retry_count: retryCount,
      _parse_attempt: JSON.stringify({ temResponsavel, temCustos, temCampoAlternativo, strTemResponsavel, strTemCustos, isToolCall }),
    }
  }];
}
