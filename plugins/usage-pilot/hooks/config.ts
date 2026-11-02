// Every number a person may want to tune lives here.

/** A cold cache asks before sending once the context is at least this big. */
export const COLD_ASK_AT = 100_000
/** A context this big asks before every send and shows the Handoff button. */
export const BIG_ASK_AT = 200_000
/** "Send, don't ask until +50k" stays quiet for this many more tokens. */
export const MUTE_STEP = 50_000

export const FIVE_MIN = 5 * 60_000
export const ONE_HOUR = 60 * 60_000

/** Keep warm pings this long before the cache would go cold. */
export const WARM_LEAD = 45_000
export const WARM_MAX_PINGS = 30
export const WARM_MAX_MS = 2 * 60 * 60_000
export const WARM_MAX_FAILS = 3
export const WARM_RETRY_MS = 20_000
export const PING_PROMPT = 'Reply with the single word: ok'

/** A waiting handoff is dropped if the new chat does not start within this. */
export const HANDOFF_TTL = 30 * 60_000

/** Usage figures are re-read at least this often, besides the engine's own pushes. */
export const USAGE_REFRESH_MS = 15_000

export const COLOR = {
  good: '#22c55e',
  warn: '#eab308',
  bad: '#ef4444',
  cold: '#3b82f6',
} as const

/** $ per million tokens: [cache read, cache write]. First match wins. */
export const PRICES: ReadonlyArray<readonly [string | RegExp, number, number]> = [
  ['fable-5-1', 0.25, 20],
  ['fable-5', 1, 20],
  ['opus-5-5', 0.2, 8],
  ['opus-5', 0.5, 10],
  [/opus-4(?:-[01])?(?:$|[^-\d]|-20\d{6})/, 1.5, 30],
  ['opus-4', 0.5, 10],
  ['sonnet-5-5', 0.1, 4],
  ['sonnet-5', 0.2, 4],
  ['sonnet', 0.3, 6],
  ['haiku-5-5', 0.01, 0.2],
  ['haiku', 0.1, 2],
]

/** Prompts nobody typed: they neither stop keep warm nor get asked about. */
export const BACKGROUND = new Set([
  'plugin', 'task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay',
  'channel', 'coordinator', 'observer', 'observer-activity', 'auto-continuation',
])

/** This mod's own commands. */
export const COMMANDS = ['pilot', 'keepwarm', 'handoff'] as const
