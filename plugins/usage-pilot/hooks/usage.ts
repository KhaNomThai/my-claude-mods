// Usage limits, context and the cache length: read from the engine, kept in $.state.
import type { EngineInterface } from 'claude-code'

import type { Limit } from '../types'
import { patchMeter, redraw, rt, toast, ttl } from './state'

export async function refreshUsage($: EngineInterface) {
  const u = await $.session.usage()
  rt.lastUsageAt = await $.clock.now()
  const limits: Limit[] = u.rateLimits.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt }))
  await patchMeter($, m => {
    // A resumed chat has no reading until its first new reply: keep what the log said.
    const tokens = rt.trustUsage ? (u.context.tokens ?? m.tokens) : m.tokens
    const window = u.context.window || m.window
    const percent = rt.trustUsage && u.context.percent !== undefined ? u.context.percent : window ? Math.round((tokens / window) * 100) : 0
    return { ...m, tokens, window, percent, limits: limits.length ? limits : m.limits }
  })
}

type LastReply = { ttl: '1h' | '5m' | 'unknown'; at: number; tokens: number }

/** What this chat's log says about its last reply: cache length, when it ended, its context size. */
async function readLog($: EngineInterface): Promise<LastReply | null> {
  if (!rt.sid) return null
  const r = await $.process.run(['python3', '-I', `${$.plugin.root}/bin/last_reply.py`, rt.sid])
  if (r.exitCode !== 0) return null
  const out = JSON.parse(r.stdout) as LastReply
  if (out.ttl !== 'unknown') rt.detected = out.ttl
  return out
}

/** At a session start: a resumed chat picks up where its last reply left the cache. */
export async function loadFromLog($: EngineInterface) {
  const last = await readLog($)
  await patchMeter($, m =>
    last && last.at > m.lastEnd
      ? { ...m, lastEnd: last.at, tokens: m.tokens || last.tokens, ...ttl() }
      : { ...m, ...ttl() },
  )
  redraw($)
}

/** A main-chat reply just ended: the cache is warm from now. */
export async function replyEnded($: EngineInterface) {
  const now = await $.clock.now()
  rt.trustUsage = true
  await readLog($).catch(() => undefined)
  await patchMeter($, m => ({ ...m, lastEnd: now, now, ...ttl() }))
  await refreshUsage($)
}

export async function compact($: EngineInterface) {
  if (rt.compacting) return
  if (rt.working) return toast($, 'Wait for Claude to finish before compacting')
  rt.compacting = true
  await patchMeter($, m => ({ ...m, note: 'compacting…' }))
  redraw($)
  try {
    const res = (await $.session.compact()) as { skip?: string } | undefined
    toast($, res?.skip ? `Compact skipped: ${res.skip}` : 'Compact done')
  } catch (err) {
    toast($, `Compact failed: ${String(err).slice(0, 120)}`)
  } finally {
    rt.compacting = false
    await patchMeter($, m => ({ ...m, note: '' }))
    await refreshUsage($).catch(() => undefined)
    redraw($)
  }
}
