import { RESPONSAVEIS } from '@/lib/constants'

// Lista de responsáveis dos forms de orçamento.
//
// IMPORTANTE: esta lista deve espelhar as rotas do switch Qual_Responsavel
// no n8n (Supervisor) — o nome do responsável decide para qual WhatsApp o
// orçamento é enviado. Por isso ela é FIXA: perfis aprovados no Admin NÃO
// entram aqui (um usuário do dash sem rota no n8n geraria orçamento sem
// destino). Para adicionar alguém: criar a rota no n8n e incluir o nome
// em RESPONSAVEIS (src/lib/constants.ts).
export function useResponsaveis(): string[] {
  return RESPONSAVEIS
}
