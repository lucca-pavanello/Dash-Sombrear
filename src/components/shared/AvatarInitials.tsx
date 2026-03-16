interface AvatarInitialsProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export default function AvatarInitials({ name, size = 'md' }: AvatarInitialsProps) {
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const sz = size === 'lg' ? 'h-11 w-11 text-sm' : size === 'md' ? 'h-8 w-8 text-xs' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-5 w-5 text-[9px]'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-gradient font-bold text-white shadow-brand ${sz}`}>
      {initials}
    </span>
  )
}
