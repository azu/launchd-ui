import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LaunchdJob } from "@/types"

type CommandPanelProps = {
  job: LaunchdJob
}

type CommandRow = {
  label: string
  command: string
  destructive?: boolean
}

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

function domainFor(job: LaunchdJob): string {
  if (job.source === "SystemDaemon") return "system"
  return "gui/$(id -u)"
}

function sudoPrefix(job: LaunchdJob): string {
  return job.source === "UserAgent" ? "" : "sudo "
}

export function buildCommands(job: LaunchdJob): CommandRow[] {
  const prefix = sudoPrefix(job)
  const domain = domainFor(job)
  const target = `${domain}/${shellQuote(job.label)}`
  const plistPath = shellQuote(job.plist_path)

  return [
    { label: "Start", command: `${prefix}launchctl bootstrap ${domain} ${plistPath}` },
    { label: "Stop", command: `${prefix}launchctl bootout ${domain} ${plistPath}` },
    { label: "Kickstart", command: `${prefix}launchctl kickstart -k ${target}` },
    { label: "Enable", command: `${prefix}launchctl enable ${target}` },
    { label: "Disable", command: `${prefix}launchctl disable ${target}` },
    {
      label: "Remove",
      command: `${prefix}rm ${plistPath}`,
      destructive: true,
    },
  ]
}

export function CommandPanel({ job }: CommandPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const commands = buildCommands(job)

  const copyCommand = async (command: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable")
      }
      await navigator.clipboard.writeText(command)
      setCopied(command)
      window.setTimeout(() => setCopied(null), 1200)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">Commands</h4>
      <div className="space-y-2">
        {commands.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2"
          >
            <span
              className={
                item.destructive
                  ? "text-sm font-medium text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {item.label}
            </span>
            <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm">
                {item.command}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Copy ${item.label.toLowerCase()} command`}
                onClick={() => void copyCommand(item.command)}
              >
                {copied === item.command ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
