// /pilot: everything the one-line band leaves out.
import type { EngineInterface } from 'claude-code'

import { BIG_ASK_AT, COLD_ASK_AT, ONE_HOUR, WARM_LEAD, WARM_MAX_PINGS } from './config'
import { clock, duration, limitLabel, sendCost, tokens, usd } from './format'
import { getMeter, getWarm, modelName, rt } from './state'

export async function statusCard($: EngineInterface): Promise<string> {
  const m = await getMeter($)
  if (!m) return 'usage-pilot has no reading yet.'
  const now = await $.clock.now()
  const model = await modelName($)
  const cost = sendCost(model, m.tokens)
  const out: string[] = ['usage-pilot', '']

  for (const l of m.limits) {
    const reset = l.resetsAt ? Date.parse(l.resetsAt) - now : NaN
    // Past its reset the old reading is stale, as on the band.
    const p = reset <= 0 ? 0 : l.percent
    out.push(`${limitLabel(l.kind).padEnd(6)} ${String(Math.round(p)).padStart(3)}%${reset > 0 ? `   resets in ${duration(reset)}` : reset <= 0 ? '   reset, waiting for a new reading' : ''}`)
  }
  if (!m.limits.length) out.push('limits  no reading yet (shown after the first reply)')

  out.push(`ctx    ${String(m.percent).padStart(3)}%   ${tokens(m.tokens)} / ${tokens(m.window)}${cost ? `   ≈ ${usd(cost.warm)} per message warm, ${usd(cost.cold)} cold` : ''}`)

  const length = `${m.ttlMs === ONE_HOUR ? '1 hour' : '5 min'}${m.ttlDetected ? '' : ' (a guess until the first reply)'}`
  if (!m.lastEnd) out.push(`cache  no reply yet · ${length}`)
  else {
    const left = m.lastEnd + m.ttlMs - now
    out.push(`cache  ${left > 0 ? `warm, ${clock(left)} left` : `cold for ${duration(-left)}`} · ${length}`)
  }

  const w = await getWarm($)
  out.push(w ? `warm   on · ping ${w.pings}/${WARM_MAX_PINGS}${w.error ? ` · last ping failed (${w.error})` : ''}` : `warm   off · /keepwarm pings ${WARM_LEAD / 1000} s before the cache goes cold`)

  out.push('')
  out.push(`Asks before a send when the cache is cold at ${tokens(COLD_ASK_AT)}+ tokens, or the context is ${tokens(BIG_ASK_AT)}+.`)
  if (rt.mutedBelow > m.tokens) out.push(`Big-context question muted until ${tokens(rt.mutedBelow)}.`)
  out.push('Keys on the band: 1 Compact · 2 Warm · 3 Handoff (at ' + tokens(BIG_ASK_AT) + '+). Commands: /keepwarm, /handoff.')
  return out.join('\n')
}
