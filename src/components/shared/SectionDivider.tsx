interface SectionDividerProps {
  label: string
}

export default function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-2">
      <div className="flex-1 border-t" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 border-t" />
    </div>
  )
}
