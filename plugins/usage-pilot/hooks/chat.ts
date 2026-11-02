// A chat starting in this process: launch, /resume, /clear, a fork.
// `session.start` fires once per process; `classic.SessionStart` fires for each of these,
// so per-chat state is reset here, never left over from the chat before.
import type { EngineInterface } from 'claude-code'

import { deliverPending } from './guard'
import { blank, rt, setMeter, setWarm, ttl } from './state'
import { loadFromLog, refreshUsage } from './usage'

export type ChatStart = {
  sessionId: string
  source: string
  /** resume/fork: how long ago the transcript's last reply ended. */
  secondsSinceReply?: number
  /** resume/fork: the context that last reply was answered over. */
  contextTokens?: number
}

export async function startChat($: EngineInterface, chat: ChatStart) {
  rt.sid = chat.sessionId
  rt.working = false
  rt.pinging = false
  rt.compacting = false
  rt.handingOff = false
  rt.mutedBelow = 0
  rt.detected = 'unknown'
  rt.lastUsageAt = 0
  rt.trustUsage = chat.source === 'startup'

  const now = await $.clock.now()
  const fresh = { ...blank(now), ...ttl() }
  // The engine already knows a resumed chat's last reply: the first send is checked against it.
  if (chat.secondsSinceReply !== undefined) fresh.lastEnd = now - chat.secondsSinceReply * 1000
  if (chat.contextTokens) fresh.tokens = chat.contextTokens
  await setMeter($, fresh)
  await setWarm($, null)

  // The log adds the cache length (5 min or 1 hour), and the figures where the engine gave none.
  await loadFromLog($).catch(() => undefined)
  await refreshUsage($).catch(() => undefined)
  // Only the /clear a handoff readied: a later launch elsewhere must not pick it up.
  if (chat.source === 'clear') await deliverPending($).catch(() => undefined)
}
