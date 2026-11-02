// Pure helpers: no $ here, so the tests cover them directly.
import { COLOR, PRICES } from './config'

export const tokens = (t: number) =>
  t >= 1_000_000 ? `${(t / 1_000_000).toFixed(t % 1_000_000 ? 1 : 0)}M` : `${Math.round(t / 1000)}k`

export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const duration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

export const limitLabel = (kind: string) =>
  kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7d' : kind === 'spend_limit' ? '$' : kind.replace(/_/g, ' ')

export const pie = (p: number) => (p < 12.5 ? '○' : p < 37.5 ? '◔' : p < 62.5 ? '◑' : p < 87.5 ? '◕' : '●')

export const levelColor = (p: number) => (p >= 85 ? COLOR.bad : p >= 60 ? COLOR.warn : COLOR.good)

export const usd = (n: number) => (n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`)

/** [cache read, cache write] in $ per million tokens, or null for a model not in the table. */
export function priceOf(model: string): readonly [number, number] | null {
  const m = model.toLowerCase().replace(/[\s.]+/g, '-')
  for (const [family, read, write] of PRICES) {
    if (typeof family === 'string' ? m.includes(family) : family.test(m)) return [read, write]
  }
  return null
}

/** What re-sending `n` tokens costs: from a warm cache, and written again to a cold one. */
export function sendCost(model: string, n: number): { warm: number; cold: number } | null {
  const p = priceOf(model)
  return p ? { warm: (n * p[0]) / 1e6, cold: (n * p[1]) / 1e6 } : null
}
