import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useProcessStats } from "@/hooks/useProcessStats"

type ResourceMonitorProps = {
  pid: number | null
  enabled: boolean
}

const cpuChartConfig = {
  cpu_percent: {
    label: "CPU %",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

const memoryChartConfig = {
  memory_mb: {
    label: "Memory (MB)",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${m}:${s}`
}

function formatMemoryMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function ResourceMonitor({ pid, enabled }: ResourceMonitorProps) {
  const { data, latest, error } = useProcessStats(pid, enabled)

  if (pid === null) {
    return (
      <div className="text-sm text-muted-foreground py-4" data-testid="not-running-message">
        Process is not running. Start the agent to monitor resource usage.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    time: formatTime(d.timestamp),
    cpu_percent: Math.round(d.cpu_percent * 10) / 10,
    memory_mb: Number(formatMemoryMB(d.memory_bytes)),
  }))

  return (
    <div className="space-y-4">
      {/* Current values summary */}
      <div className="flex gap-4">
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">CPU: </span>
          <span className="font-mono font-medium" data-testid="cpu-value">
            {latest ? `${latest.cpu_percent.toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Memory: </span>
          <span className="font-mono font-medium" data-testid="memory-value">
            {latest ? `${formatMemoryMB(latest.memory_bytes)} MB` : "—"}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive" data-testid="error-message">
          {error}
        </div>
      )}

      {/* CPU Chart */}
      <div>
        <h4 className="text-sm font-medium mb-2">CPU Usage</h4>
        <ChartContainer config={cpuChartConfig} className="h-[180px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              domain={[0, "auto"]}
              unit="%"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="cpu_percent"
              stroke="var(--color-cpu_percent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* Memory Chart */}
      <div>
        <h4 className="text-sm font-medium mb-2">Memory Usage</h4>
        <ChartContainer config={memoryChartConfig} className="h-[180px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              domain={[0, "auto"]}
              unit=" MB"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="memory_mb"
              stroke="var(--color-memory_mb)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}
