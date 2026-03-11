const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-rose-500', 'bg-violet-500',
]

export function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

interface AvatarInitialsProps {
  name: string
  size?: 'sm' | 'md'
}

export default function AvatarInitials({ name, size = 'md' }: AvatarInitialsProps) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const sz = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${sz} ${avatarColor(name)}`}>
      {initials}
    </span>
  )
}
