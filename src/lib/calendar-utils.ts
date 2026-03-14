import type { CalendarInterval } from "@/types"

export type HourRangeResult = {
  base: CalendarInterval
  from: number
  to: number
}

/**
 * Detect if an array of CalendarIntervals represents a contiguous hour range
 * with the same minute/weekday/day/month values.
 */
export function detectHourRange(intervals: CalendarInterval[]): HourRangeResult | null {
  if (intervals.length < 2) return null

  // Check all intervals have the same minute/weekday/day/month
  const first = intervals[0]
  const allSameBase = intervals.every(
    (ci) =>
      ci.minute === first.minute &&
      ci.weekday === first.weekday &&
      ci.day === first.day &&
      ci.month === first.month &&
      ci.hour !== null &&
      ci.hour !== undefined
  )
  if (!allSameBase) return null

  // Extract hours and sort
  const hours = intervals.map((ci) => ci.hour as number).sort((a, b) => a - b)

  // Check hours are contiguous
  for (let i = 1; i < hours.length; i++) {
    if (hours[i] !== hours[i - 1] + 1) return null
  }

  return {
    base: {
      minute: first.minute,
      hour: null,
      weekday: first.weekday,
      day: first.day,
      month: first.month,
    },
    from: hours[0],
    to: hours[hours.length - 1],
  }
}

/**
 * Expand a base CalendarInterval with an hour range into individual intervals.
 */
export function expandHourRange(
  base: CalendarInterval,
  from: number,
  to: number
): CalendarInterval[] {
  const result: CalendarInterval[] = []
  for (let h = from; h <= to; h++) {
    result.push({ ...base, hour: h })
  }
  return result
}

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatDateTime(date: Date): string {
  const weekday = weekdayLabels[date.getDay()]
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}/${day} (${weekday}) ${hour}:${minute}`
}

/**
 * Get next N occurrences for a single CalendarInterval.
 */
export function getNextOccurrences(ci: CalendarInterval, count: number): Date[] {
  const results: Date[] = []
  const now = new Date()
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  const limit = 400 * 24 * 60
  for (let i = 0; i < limit && results.length < count; i++) {
    const matches =
      (ci.month === null || ci.month === undefined || candidate.getMonth() + 1 === ci.month) &&
      (ci.day === null || ci.day === undefined || candidate.getDate() === ci.day) &&
      (ci.weekday === null || ci.weekday === undefined || candidate.getDay() === ci.weekday) &&
      (ci.hour === null || ci.hour === undefined || candidate.getHours() === ci.hour) &&
      (ci.minute === null || ci.minute === undefined || candidate.getMinutes() === ci.minute)

    if (matches) {
      results.push(new Date(candidate))
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return results
}

/**
 * Get next N occurrences across multiple CalendarIntervals, merged and sorted.
 */
export function getNextOccurrencesMulti(intervals: CalendarInterval[], count: number): Date[] {
  // Collect candidates from all intervals
  const allDates: Date[] = []
  for (const ci of intervals) {
    allDates.push(...getNextOccurrences(ci, count))
  }

  // Deduplicate and sort
  const unique = new Map<number, Date>()
  for (const d of allDates) {
    unique.set(d.getTime(), d)
  }

  return Array.from(unique.values())
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, count)
}

/**
 * Format calendar intervals for display, detecting hour ranges.
 */
export function formatCalendarIntervals(intervals: CalendarInterval[]): string {
  const range = detectHourRange(intervals)
  if (range) {
    const parts: string[] = []
    if (range.base.weekday !== null && range.base.weekday !== undefined) {
      parts.push(`Every ${weekdayLabels[range.base.weekday]}`)
    } else if (range.base.day !== null && range.base.day !== undefined) {
      parts.push(`Day ${range.base.day} of each month`)
    } else if (range.base.month !== null && range.base.month !== undefined) {
      parts.push(`Month ${range.base.month}`)
    } else {
      parts.push("Every day")
    }
    const minute = String(range.base.minute ?? 0).padStart(2, "0")
    parts.push(`at :${minute} (${range.from}:00–${range.to}:00)`)
    return parts.join(" ")
  }
  // Fallback: format each individually
  return intervals.map(formatSingleCalendarInterval).join(", ")
}

function formatSingleCalendarInterval(ci: CalendarInterval): string {
  const parts: string[] = []
  if (ci.weekday !== null && ci.weekday !== undefined) {
    parts.push(`Every ${weekdayLabels[ci.weekday]}`)
  } else if (ci.day !== null && ci.day !== undefined) {
    parts.push(`Day ${ci.day} of each month`)
  } else if (ci.month !== null && ci.month !== undefined) {
    parts.push(`Month ${ci.month}`)
  } else {
    parts.push("Every day")
  }
  const hour = ci.hour ?? 0
  const minute = ci.minute ?? 0
  parts.push(`at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)
  return parts.join(" ")
}

export { formatDateTime }
