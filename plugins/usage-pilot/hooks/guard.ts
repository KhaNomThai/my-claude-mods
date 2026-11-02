// The cost check before a send, and the handoff to a fresh chat.
import type { EngineInterface } from 'claude-code'

import { BIG_ASK_AT, COLD_ASK_AT, HANDOFF_TTL, MUTE_STEP } from './config'
import { duration, sendCost, tokens, usd } from './format'
import { getMeter, modelName, patchMeter, redraw, rt, toast } from './state'
import { loadFromLog } from './usage'

const SEND = 'Send'
const SEND_MUTE = "Send, don't ask until +50k"
const HANDOFF = 'Handoff to a new chat'
const CANCEL = 'Cancel'

export type Verdict = { send: true } | { send: false; drop: string }

/** Asks before a typed message goes out over a cold cache or a big context. */
export async function checkSend($: EngineInterface, text: string): Promise<Verdict> {
  let m = await getMeter($)
  // Sent before the start-up read of the log finished: read it now.
  if (!m?.lastEnd) {
    await loadFromLog($).catch(() => undefined)
    m = await getMeter($)
  }
  if (!m?.lastEnd) return { send: true }
  const now = await $.clock.now()
  const coldFor = now - (m.lastEnd + m.ttlMs)
  const isCold = coldFor > 0 && m.tokens >= COLD_ASK_AT
  const isBig = m.tokens >= BIG_ASK_AT && m.tokens >= rt.mutedBelow
  if (!isCold && !isBig) return { send: true }

  const cost = sendCost(await modelName($), m.tokens)
  const lines: string[] = []
  if (isCold) {
    const price = cost ? ` ≈ ${usd(cost.cold)} (warm would be ${usd(cost.warm)})` : ''
    lines.push(`• Cache went cold ${duration(coldFor)} ago — this message re-writes ${tokens(m.tokens)} tokens${price}`)
  }
  if (m.tokens >= BIG_ASK_AT) {
    const price = cost ? ` ≈ ${usd(cost.warm)} per message` : ''
    lines.push(`• Context is ${tokens(m.tokens)} tokens — every message re-sends all of it${price} and burns usage limit faster`)
  }

  let choice = CANCEL
  try {
    choice = await $.ui.ask(`This message is expensive\n${lines.join('\n')}\nSend it, or move to a new chat?`, {
      header: 'Cost',
      // A cold cache always asks: muting only covers the big-context question.
      options: isCold ? [SEND, HANDOFF, CANCEL] : [SEND, SEND_MUTE, HANDOFF, CANCEL],
    })
  } catch {
    choice = CANCEL
  }

  if (choice === SEND) return { send: true }
  if (choice === SEND_MUTE) {
    rt.mutedBelow = m.tokens + MUTE_STEP
    return { send: true }
  }
  if (choice === HANDOFF) {
    void handoff($, text).catch(() => undefined)
    return { send: false, drop: 'usage-pilot: not sent — writing a handoff; this message moves to the new chat' }
  }
  void $.prompt.fill({ text }).catch(() => undefined)
  return { send: false, drop: 'usage-pilot: cancelled — your message is back in the prompt box' }
}

const HANDOFF_PROMPT = `Write a handoff prompt for a fresh Claude Code session that continues this work. Do not call any tool. Reply with the prompt only: no preamble, no code fence.

The reader starts with an empty context. It can open files on this machine but cannot see this chat. It loads CLAUDE.md and its memory by itself, so do not repeat those. Write it in the language the user writes in.

# Handoff: <the goal, in a few words>

Working directory: <cwd>. Goal: <what the user is working toward right now>.

## What the user asked for
Every request in this chat, in order, with the user's key words, each marked done / in progress / not started.

## Where things stand
What is done and checked, key decisions and why, what was tested and what was not.

## Rules the user set
Standing constraints and preferences from this chat.

## Files to open first
Full paths, most important first, one line each on why.

## Next step
The single next thing to do.`

const handoffDir = () => `${rt.home}/.claude/handoffs`
const pendingPath = () => `${handoffDir()}/.usage-pilot-pending`

/** Writes a handoff of this chat, then readies /clear; the new chat finds it in its prompt box. */
export async function handoff($: EngineInterface, message = '') {
  if (rt.handingOff) return
  if (rt.working) return toast($, 'Wait for Claude to finish before handing off')
  rt.handingOff = true
  await patchMeter($, m => ({ ...m, note: 'writing handoff…' }))
  redraw($)
  try {
    const r = await $.model.fork({ prompt: HANDOFF_PROMPT })
    if (!r.isAnswered) throw new Error(r.reason)
    const text = r.text.trim().replace(/^```(?:markdown|md)?\n([\s\S]*)\n```$/, '$1')
    const now = await $.clock.now()
    const stamp = new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, '-')
    await $.process.run(['mkdir', '-p', handoffDir()])
    const path = `${handoffDir()}/${stamp}-handoff.md`
    await $.fs.write(path, `${text}\n`)
    await $.fs.write(pendingPath(), JSON.stringify({ path, at: now, message }))
    const { isCopied } = await $.ui.copy({ text }).catch(() => ({ isCopied: false }))
    await $.prompt.fill({ text: '/clear' }).catch(() => undefined)
    $.ui.log(
      `✓ Handoff written: ${path.replace(rt.home, '~')}${isCopied ? ' (copied to clipboard)' : ''}\n` +
        '  Press Enter to /clear — the new chat gets the handoff in its prompt box; press Enter again to start',
    )
  } catch (err) {
    toast($, `Handoff failed: ${String(err).slice(0, 120)}`)
  } finally {
    rt.handingOff = false
    await patchMeter($, m => ({ ...m, note: '' }))
    redraw($)
  }
}

/** At a session start (after /clear): puts a waiting handoff into the prompt box. */
export async function deliverPending($: EngineInterface) {
  const path = pendingPath()
  if (!(await $.fs.exists(path))) return
  const { path: file, at, message } = JSON.parse(String(await $.fs.read(path))) as { path: string; at: number; message?: string }
  if ((await $.clock.now()) - at > HANDOFF_TTL || !(await $.fs.exists(file))) {
    await $.process.run(['rm', '-f', path])
    return
  }
  const body = String(await $.fs.read(file)).trim()
  const text = message ? `${body}\n\n---\nMessage to continue with:\n${message}` : body
  // The prompt box may not be mounted yet right after /clear.
  for (let i = 0; i < 20; i += 1) {
    if ((await $.prompt.fill({ text })).isFilled) {
      await $.process.run(['rm', '-f', path])
      toast($, 'Handoff is in the prompt box — press Enter to start')
      return
    }
    await $.clock.sleep(500)
  }
}
