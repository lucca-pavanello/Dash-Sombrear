export default function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="h-2.5 w-20 rounded bg-muted mb-2.5" />
          <div className="h-6 w-28 rounded bg-muted mb-2" />
          <div className="h-2 w-16 rounded bg-muted" />
        </div>
        <div className="h-7 w-7 rounded-lg bg-muted shrink-0" />
      </div>
    </div>
  )
}
