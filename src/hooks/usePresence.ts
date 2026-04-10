import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/hooks/useProfile'

export type PresenceUser = { id: string; name: string; tab: string }

export function usePresence(profile: Profile | null, activeTab: string) {
  const [others, setOthers] = useState<PresenceUser[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!profile) return
    const ch = supabase.channel('dashboard:presence', {
      config: { presence: { key: profile.id } },
    })
    channelRef.current = ch

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceUser>()
      const all = Object.values(state).flat()
      setOthers(all.filter(u => u.id !== profile.id))
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          id: profile.id,
          name: profile.full_name ?? profile.email ?? 'Usuário',
          tab: activeTab,
        })
      }
    })

    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Re-track quando muda de aba sem recriar o canal
  useEffect(() => {
    const ch = channelRef.current
    if (!ch || !profile) return
    ch.track({
      id: profile.id,
      name: profile.full_name ?? profile.email ?? 'Usuário',
      tab: activeTab,
    })
  }, [activeTab, profile])

  return others
}
