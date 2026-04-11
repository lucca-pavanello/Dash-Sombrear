interface SparklineProps {
  values: number[]
  width?: number
  height?: number
}

export default function Sparkline({ values, width = 48, height = 20 }: SparklineProps) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const trending = values[values.length - 1] >= values[0]
  const lastPt = pts[pts.length - 1].split(',')
  return (
    <svg
      width={width}
      height={height}
      className="inline-block align-middle ml-2 opacity-60 shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={trending ? '#34D399' : '#F87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPt[0]}
        cy={lastPt[1]}
        r="2"
        fill={trending ? '#34D399' : '#F87171'}
      />
    </svg>
  )
}
