export type Limit = {
  /** `five_hour`, `seven_day`, or a gateway's `spend_limit`. */
  kind: string
  /** 0 to 100. */
  percent: number
  /** ISO time the window resets. */
  resetsAt?: string
}

export type Meter = {
  /** Last tick, ms: the band redraws once a second. */
  now: number
  /** When the last main-chat reply ended, ms. 0 before the first reply. */
  lastEnd: number
  /** How long the cache stays warm after a reply, ms. */
  ttlMs: number
  /** True when ttlMs was read from this chat's log, false for the 5 min guess. */
  ttlDetected: boolean
  /** Context tokens, the model's window, and their share as a whole percent. */
  tokens: number
  window: number
  percent: number
  limits: Limit[]
  /** Shown in place of the context figure while busy ('compacting…'), '' for none. */
  note: string
}

export type Warm = {
  startedAt: number
  pings: number
  sending: boolean
  failures: number
  /** No ping before this time, ms (after a failure). */
  retryAt: number
  error: string
  /** Cache-read tokens of the last ping. */
  read: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-pilot': { meter: Meter | null; warm: Warm | null }
  }
}
