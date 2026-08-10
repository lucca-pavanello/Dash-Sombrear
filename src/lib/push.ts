/**
 * Web Push — inscrição do aparelho para receber avisos (ex.: orçamento aceito).
 * A chave VAPID pública identifica nosso servidor de push (o par privado vive
 * como secret da edge function push-aceite). Chave pública não é segredo.
 */
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = 'BEi3AA2KXuaZi_xJ56lLpXZOoKfTp9-RV3cUHK3hEfinFjwjlkQCZg6peGJhey5KS-zLg6YyV47QiAAUwt0LR_0'

function base64UrlParaUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function pushSuportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function estadoPush(): Promise<'ativo' | 'inativo' | 'bloqueado' | 'sem-suporte'> {
  if (!pushSuportado()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'ativo' : 'inativo'
}

/** Pede permissão, inscreve o aparelho e grava no banco. */
export async function ativarPush(userId: string): Promise<void> {
  if (!pushSuportado()) throw new Error('Este navegador não suporta notificações')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão de notificação negada')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlParaUint8(VAPID_PUBLIC_KEY),
  })
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Inscrição incompleta')

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

/** Remove a inscrição deste aparelho (local + banco). */
export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
