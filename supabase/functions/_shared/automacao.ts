/**
 * Autenticação de máquina-chamando-máquina.
 *
 * Quando quem dispara é o banco (trigger ou pg_cron), não existe JWT de
 * usuário — a prova é um segredo compartilhado. O banco lê o valor do
 * `supabase_vault` e manda no corpo; a function compara com o env.
 *
 * O env ainda se chama PUSH_TRIGGER_SECRET por herança: nasceu para a
 * `push-aceite` e hoje vale para toda automação. Renomear custaria um segredo
 * novo no painel e um redeploy de três functions para ganhar só clareza de
 * nome, então fica — e fica escrito aqui para ninguém procurar outro.
 */
export function segredoConfere(body: unknown): boolean {
  const esperado = Deno.env.get('PUSH_TRIGGER_SECRET')
  if (!esperado) return false // sem segredo configurado, ninguém entra
  const enviado = (body as { segredo?: unknown } | null)?.segredo
  return typeof enviado === 'string' && enviado === esperado
}
