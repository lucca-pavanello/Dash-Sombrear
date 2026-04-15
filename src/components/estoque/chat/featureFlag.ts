export const isAIEstoqueEnabled = () => {
  // Em produção: sempre ativo
  if (import.meta.env.PROD) return true
  // Em dev local: controlado por env var
  return import.meta.env.VITE_FEATURE_AI_ESTOQUE === 'true'
}
