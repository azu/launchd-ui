import { describe, it, expect } from "vitest"
import {
  detectHourRange,
  expandHourRange,
  getNextOccurrences,
  getNextOccurrencesMulti,
  formatCalendarIntervals,
} from "@/lib/calendar-utils"
import type { CalendarInterval } from "@/types"

describe("detectHourRange", () => {
  it("returns null for a single interval", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
    ]
    expect(detectHourRange(intervals)).toBeNull()
  })

  it("detects contiguous hour range", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 7, day: null, weekday: null, month: null },
      { minute: 0, hour: 8, day: null, weekday: null, month: null },
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
    ]
    const result = detectHourRange(intervals)
    expect(result).toEqual({
      base: { minute: 0, hour: null, day: null, weekday: null, month: null },
      from: 7,
      to: 9,
    })
  })

  it("detects range even when intervals are unordered", () => {
    const intervals: CalendarInterval[] = [
      { minute: 30, hour: 10, day: null, weekday: 1, month: null },
      { minute: 30, hour: 8, day: null, weekday: 1, month: null },
      { minute: 30, hour: 9, day: null, weekday: 1, month: null },
    ]
    const result = detectHourRange(intervals)
    expect(result).toEqual({
      base: { minute: 30, hour: null, day: null, weekday: 1, month: null },
      from: 8,
      to: 10,
    })
  })

  it("returns null for non-contiguous hours", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 7, day: null, weekday: null, month: null },
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
      { minute: 0, hour: 10, day: null, weekday: null, month: null },
    ]
    expect(detectHourRange(intervals)).toBeNull()
  })

  it("returns null when base fields differ", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 7, day: null, weekday: null, month: null },
      { minute: 30, hour: 8, day: null, weekday: null, month: null },
    ]
    expect(detectHourRange(intervals)).toBeNull()
  })

  it("returns null when hour is null", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: null, day: null, weekday: null, month: null },
      { minute: 0, hour: null, day: null, weekday: null, month: null },
    ]
    expect(detectHourRange(intervals)).toBeNull()
  })
})

describe("expandHourRange", () => {
  it("expands hour range into individual intervals", () => {
    const base: CalendarInterval = {
      minute: 0,
      hour: null,
      day: null,
      weekday: null,
      month: null,
    }
    const result = expandHourRange(base, 7, 9)
    expect(result).toEqual([
      { minute: 0, hour: 7, day: null, weekday: null, month: null },
      { minute: 0, hour: 8, day: null, weekday: null, month: null },
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
    ])
  })

  it("preserves weekday and other fields", () => {
    const base: CalendarInterval = {
      minute: 30,
      hour: null,
      day: null,
      weekday: 1,
      month: null,
    }
    const result = expandHourRange(base, 9, 10)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ minute: 30, hour: 9, day: null, weekday: 1, month: null })
    expect(result[1]).toEqual({ minute: 30, hour: 10, day: null, weekday: 1, month: null })
  })

  it("handles single hour (from === to)", () => {
    const base: CalendarInterval = {
      minute: 0,
      hour: null,
      day: null,
      weekday: null,
      month: null,
    }
    const result = expandHourRange(base, 9, 9)
    expect(result).toHaveLength(1)
    expect(result[0].hour).toBe(9)
  })

  it("returns empty array when from > to", () => {
    const base: CalendarInterval = {
      minute: 0,
      hour: null,
      day: null,
      weekday: null,
      month: null,
    }
    const result = expandHourRange(base, 23, 7)
    expect(result).toEqual([])
  })
})

describe("getNextOccurrences", () => {
  it("returns future occurrences for specific hour and minute", () => {
    const ci: CalendarInterval = {
      minute: 30,
      hour: 14,
      day: null,
      weekday: null,
      month: null,
    }
    const results = getNextOccurrences(ci, 3)
    expect(results).toHaveLength(3)
    for (const d of results) {
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
    }
  })

  it("returns occurrences matching every hour when hour is null", () => {
    const ci: CalendarInterval = {
      minute: 0,
      hour: null,
      day: null,
      weekday: null,
      month: null,
    }
    const results = getNextOccurrences(ci, 3)
    expect(results).toHaveLength(3)
    for (const d of results) {
      expect(d.getMinutes()).toBe(0)
    }
  })

  it("returns occurrences for specific weekday", () => {
    const ci: CalendarInterval = {
      minute: 0,
      hour: 9,
      day: null,
      weekday: 1, // Monday
      month: null,
    }
    const results = getNextOccurrences(ci, 3)
    expect(results).toHaveLength(3)
    for (const d of results) {
      expect(d.getDay()).toBe(1)
      expect(d.getHours()).toBe(9)
    }
  })
})

describe("getNextOccurrencesMulti", () => {
  it("merges and sorts occurrences from multiple intervals", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
      { minute: 0, hour: 10, day: null, weekday: null, month: null },
    ]
    const results = getNextOccurrencesMulti(intervals, 3)
    expect(results).toHaveLength(3)
    // Should be sorted chronologically
    for (let i = 1; i < results.length; i++) {
      expect(results[i].getTime()).toBeGreaterThan(results[i - 1].getTime())
    }
  })

  it("deduplicates same timestamps", () => {
    // Two identical intervals should not produce duplicate times
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
    ]
    const results = getNextOccurrencesMulti(intervals, 3)
    const times = results.map((d) => d.getTime())
    const unique = new Set(times)
    expect(unique.size).toBe(times.length)
  })
})

describe("formatCalendarIntervals", () => {
  it("formats hour range as summary", () => {
    const intervals: CalendarInterval[] = expandHourRange(
      { minute: 0, hour: null, day: null, weekday: null, month: null },
      7,
      23
    )
    const result = formatCalendarIntervals(intervals)
    expect(result).toBe("Every day at :00 (7:00–23:00)")
  })

  it("formats hour range with weekday", () => {
    const intervals: CalendarInterval[] = expandHourRange(
      { minute: 30, hour: null, day: null, weekday: 1, month: null },
      9,
      17
    )
    const result = formatCalendarIntervals(intervals)
    expect(result).toBe("Every Monday at :30 (9:00–17:00)")
  })

  it("formats hour range with month", () => {
    const intervals: CalendarInterval[] = expandHourRange(
      { minute: 0, hour: null, day: null, weekday: null, month: 3 },
      9,
      17
    )
    const result = formatCalendarIntervals(intervals)
    expect(result).toBe("Month 3 at :00 (9:00–17:00)")
  })

  it("formats single interval normally", () => {
    const intervals: CalendarInterval[] = [
      { minute: 0, hour: 9, day: null, weekday: null, month: null },
    ]
    const result = formatCalendarIntervals(intervals)
    expect(result).toBe("Every day at 09:00")
  })
})
