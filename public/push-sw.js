/* Web Push do Sombrear — importado pelo service worker gerado (workbox importScripts).
   Recebe o push do push-aceite (orçamento aceito) e mostra a notificação. */
self.addEventListener('push', (event) => {
  let dados = { title: 'Sombrear', body: '', url: '/' }
  try { dados = { ...dados, ...event.data.json() } } catch { /* payload não-JSON: usa defaults */ }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: dados.url },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('focus' in j) { j.navigate(url); return j.focus() }
      }
      return clients.openWindow(url)
    })
  )
})
