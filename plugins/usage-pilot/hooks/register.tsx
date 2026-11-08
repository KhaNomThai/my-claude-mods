// usage-pilot: one quiet line above the prompt (usage limits, context, cache timer),
// a cost check before an expensive send, keep warm, and a handoff to a fresh chat.
import type { Register } from 'claude-code'

import { band } from './band'
import { BACKGROUND, COMMANDS, PING_PROMPT, USAGE_REFRESH_MS } from './config'
import { startChat } from './chat'
import { checkSend, handoff } from './guard'
import { statusCard } from './status'
import { getWarm, patchMeter, rt } from './state'
import { refreshUsage, replyEnded } from './usage'
import { startWarm, stopWarm, warmTick } from './warm'

export const register: Register = on => {
  // Once per process: commands and the clock. Per-chat state is startChat's.
  on('session.start', async ($, e, next) => {
    void (async () => startChat($, { sessionId: await $.session.id(), source: 'startup' }))().catch(() => undefined)

    await $.command.register({ name: 'pilot', description: 'usage-pilot: usage limits, context, cache and keep warm in detail', immediate: true })
    await $.command.register({
      name: 'keepwarm',
      description: 'usage-pilot: keep the prompt cache warm with a small ping before it goes cold',
      argumentHint: '[on|off]',
      immediate: true,
    })
    await $.command.register({ name: 'handoff', description: 'usage-pilot: write a handoff of this chat and move to a fresh one', immediate: true })

    $.clock.every(1000, () => {
      void (async () => {
        const now = await $.clock.now()
        if (now - rt.lastUsageAt > USAGE_REFRESH_MS) await refreshUsage($).catch(() => undefined)
        await patchMeter($, m => ({ ...m, now }))
        await warmTick($)
      })().catch(() => undefined)
    })
    return next(e)
  })

  // Each chat this process opens: launch, /resume, /clear, a fork.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.source !== 'compact') {
      void startChat($, {
        sessionId: e.session_id,
        source: e.source,
        secondsSinceReply: e.seconds_since_last_response,
        contextTokens: e.context_tokens,
      }).catch(() => undefined)
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    void refreshUsage($).catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!(rt.pinging && e.text === PING_PROMPT)) rt.working = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // A subagent's turn does not touch the main chat's cache.
    if (e.agentId === undefined) {
      rt.working = false
      void replyEnded($).catch(() => undefined)
    }
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    const isOwn = COMMANDS.some(c => text.startsWith(`/${c}`))
    if (BACKGROUND.has(e.origin?.kind ?? '') || isOwn) return next(e)
    // The person is back: keep warm has done its job.
    void stopWarm($, 'Keep warm stopped: you sent a message').catch(() => undefined)
    if (text.startsWith('/')) return next(e)
    const verdict = await checkSend($, e.text)
    return verdict.send ? next(e) : { drop: verdict.drop }
  })
    // Whatever goes wrong in the check, the message still goes out.
    .catch(($, e, next) => next(e))

  on('command.run', { command: 'pilot' }, async $ => ({ text: await statusCard($) }))

  on('command.run', { command: 'keepwarm' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const isOn = (await getWarm($)) !== null
    if (arg === 'off' || (arg === '' && isOn)) {
      await stopWarm($)
      return { text: 'Keep warm off.' }
    }
    if (isOn) return { text: 'Keep warm is already on. /keepwarm off stops it.' }
    if (!(await startWarm($))) return { text: 'Nothing to keep warm yet: it needs a reply from Claude first.' }
    return { text: 'Keep warm on: a small ping about 45 s before the cache goes cold. Stops after 2 hours, 30 pings, or when you send a message.' }
  })

  on('command.run', { command: 'handoff' }, async $ => {
    if (rt.working) return { text: 'Wait for Claude to finish before handing off.' }
    void handoff($).catch(() => undefined)
    return { text: 'Writing the handoff… this takes a moment.' }
  })

  band(on)
}
