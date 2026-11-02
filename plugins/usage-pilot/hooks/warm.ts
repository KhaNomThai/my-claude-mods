// Keep warm: one small background ping shortly before the cache goes cold.
// $.model.fork repeats the main thread's last request with one extra line, so the
// API reads the chat from cache and the cache timer restarts. The transcript is untouched.
import type { EngineInterface, ModelForkResult } from 'claude-code'

import { PING_PROMPT, WARM_LEAD, WARM_MAX_FAILS, WARM_MAX_MS, WARM_MAX_PINGS, WARM_RETRY_MS } from './config'
import { getMeter, getWarm, patchMeter, rt, setWarm, toast } from './state'

/** False when there is no reply yet whose cache could be kept. */
export async function startWarm($: EngineInterface): Promise<boolean> {
  const m = await getMeter($)
  if (!m?.lastEnd) return false
  await setWarm($, { startedAt: await $.clock.now(), pings: 0, sending: false, failures: 0, retryAt: 0, error: '', read: 0 })
  return true
}

export async function stopWarm($: EngineInterface, why?: string) {
  if (!(await getWarm($))) return
  await setWarm($, null)
  if (why) toast($, why)
}

export async function toggleWarm($: EngineInterface): Promise<'on' | 'off' | 'none'> {
  if (await getWarm($)) {
    await stopWarm($)
    return 'off'
  }
  return (await startWarm($)) ? 'on' : 'none'
}

/** Once a second: sends the ping when it is due, and keeps the caps. */
export async function warmTick($: EngineInterface) {
  const w = await getWarm($)
  if (!w || rt.pinging || rt.working) return
  const now = await $.clock.now()
  if (now - w.startedAt >= WARM_MAX_MS) return stopWarm($, 'Keep warm stopped after 2 hours')
  if (w.pings >= WARM_MAX_PINGS) return stopWarm($, `Keep warm stopped after ${WARM_MAX_PINGS} pings`)
  if (now < w.retryAt) return
  const m = await getMeter($)
  if (!m?.lastEnd || m.lastEnd + m.ttlMs - now > WARM_LEAD) return
  rt.pinging = true
  void ping($, now).catch(() => {
    rt.pinging = false
  })
}

async function ping($: EngineInterface, start: number) {
  const before = await getWarm($)
  if (before) await setWarm($, { ...before, sending: true })
  let r: ModelForkResult | null = null
  try {
    r = await $.model.fork({ prompt: PING_PROMPT })
  } catch {
    r = null
  }
  rt.pinging = false
  if (r && !r.isAnswered && r.reason === 'nothing-to-fork') return stopWarm($, 'Keep warm stopped: no reply to keep warm yet')
  const w = await getWarm($)
  // Stopped while the ping was out.
  if (!w) return
  const now = await $.clock.now()
  const pings = w.pings + 1
  // A reply with no words still read the chat: the cache timer restarted.
  if (r && (r.isAnswered || r.reason === 'empty-reply')) {
    const read = 'usage' in r ? (r.usage?.cache_read_input_tokens ?? 0) : 0
    await setWarm($, { ...w, pings, sending: false, failures: 0, retryAt: 0, error: '', read })
    await patchMeter($, m => ({ ...m, lastEnd: Math.max(m.lastEnd, start), now }))
    return
  }
  const error = r && !r.isAnswered ? r.reason : 'error'
  const failures = w.failures + 1
  await setWarm($, { ...w, pings, sending: false, failures, retryAt: now + WARM_RETRY_MS, error })
  if (failures >= WARM_MAX_FAILS) await stopWarm($, `Keep warm stopped: ${WARM_MAX_FAILS} pings failed in a row (${error})`)
}
