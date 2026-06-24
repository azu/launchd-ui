import { useMemo } from "react"
import type { ReactNode } from "react"
import { useProcessStats, type ProcessStatsPoint } from "@/hooks/useProcessStats"

type ResourceMonitorProps = {
  pid: number | null
  enabled: boolean
}

type MetricChartProps = {
  data: ProcessStatsPoint[]
  valueKey: "cpu_percent" | "memory_bytes"
  color: string
  formatValue: (value: number) => string
}

const SVG_WIDTH = 420
const SVG_HEIGHT = 120
const CHART_PADDING = 12

function formatMemory(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatCpu(value: number): string {
  return `${value.toFixed(1)}%`
}

function MetricChart({ data, valueKey, color, formatValue }: MetricChartProps) {
  const values = data.map((point) => point[valueKey])
  const maxValue = Math.max(...values, valueKey === "cpu_percent" ? 100 : 1)
  const minValue = Math.min(...values, 0)

  const points = useMemo(() => {
    if (data.length === 0) return ""

    const usableWidth = SVG_WIDTH - CHART_PADDING * 2
    const usableHeight = SVG_HEIGHT - CHART_PADDING * 2
    const range = maxValue - minValue || 1

    return data
      .map((point, index) => {
        const x =
          CHART_PADDING +
          (data.length === 1 ? usableWidth : (index / (data.length - 1)) * usableWidth)
        const normalized = (point[valueKey] - minValue) / range
        const y = CHART_PADDING + usableHeight - normalized * usableHeight
        return `${x},${y}`
      })
      .join(" ")
  }, [data, maxValue, minValue, valueKey])

  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Waiting for samples...
      </div>
    )
  }

  return (
    <div>
      <svg
        className="h-[120px] w-full rounded-md border bg-muted/20"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={`History chart, latest value ${formatValue(values[values.length - 1])}`}
      >
        <line
          x1={CHART_PADDING}
          x2={SVG_WIDTH - CHART_PADDING}
          y1={SVG_HEIGHT - CHART_PADDING}
          y2={SVG_HEIGHT - CHART_PADDING}
          className="stroke-border"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatValue(minValue)}</span>
        <span>{formatValue(maxValue)}</span>
      </div>
    </div>
  )
}

function MetricPanel({
  title,
  value,
  children,
  testId,
}: {
  title: string
  value: string
  children: ReactNode
  testId: string
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className="font-mono text-sm" data-testid={testId}>
          {value}
        </span>
      </div>
      {children}
    </section>
  )
}

export function ResourceMonitor({ pid, enabled }: ResourceMonitorProps) {
  const { data, latest, error } = useProcessStats(pid, enabled)

  if (pid === null) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
        data-testid="not-running-message"
      >
        Process is not running. Start the job to monitor CPU and memory usage.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <MetricPanel
        title="CPU Usage"
        value={latest ? formatCpu(latest.cpu_percent) : "-"}
        testId="cpu-value"
      >
        <MetricChart
          data={data}
          valueKey="cpu_percent"
          color="var(--chart-2)"
          formatValue={formatCpu}
        />
      </MetricPanel>

      <MetricPanel
        title="Memory Usage"
        value={latest ? formatMemory(latest.memory_bytes) : "-"}
        testId="memory-value"
      >
        <MetricChart
          data={data}
          valueKey="memory_bytes"
          color="var(--chart-1)"
          formatValue={formatMemory}
        />
      </MetricPanel>
    </div>
  )
}
