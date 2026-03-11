export default function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-3 w-24 rounded bg-muted mb-3" />
      <div className="h-7 w-32 rounded bg-muted mb-2" />
      <div className="h-3 w-20 rounded bg-muted" />
    </div>
  )
}
