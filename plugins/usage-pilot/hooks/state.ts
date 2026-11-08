import type { EngineInterface } from 'claude-code'

import type { Meter, Warm } from '../types'
import { FIVE_MIN, ONE_HOUR } from './config'

const METER = { plugin: 'usage-pilot', key: 'meter' } as const
const WARM = { plugin: 'usage-pilot', key: 'warm' } as const

/** What this chat's module knows between hooks. A reload starts it over; $.state keeps the rest. */
export const rt = {
  sid: '',
  /** A handoff waiting for the /clear it readied. Memory only: nothing is saved to disk. */
  pending: null as { text: string; at: number; message: string } | null,
  /** A main-chat turn is running. */
  working: false,
  pinging: false,
  compacting: false,
  handingOff: false,
  /** Cache length read from this chat's log. */
  detected: 'unknown' as '5m' | '1h' | 'unknown',
  lastUsageAt: 0,
  /** The big-context question stays quiet below this many tokens. */
  mutedBelow: 0,
  /**
   * The engine's context figure is this chat's own: false after /resume or /clear until
   * the chat's first new reply, when it may still be the previous chat's.
   */
  trustUsage: true,
}

export const blank = (now: number): Meter => ({
  now, lastEnd: 0, ttlMs: FIVE_MIN, ttlDetected: false, tokens: 0, window: 0, percent: 0, limits: [], note: '',
})

export function ttl(): Pick<Meter, 'ttlMs' | 'ttlDetected'> {
  if (rt.detected === '1h') return { ttlMs: ONE_HOUR, ttlDetected: true }
  if (rt.detected === '5m') return { ttlMs: FIVE_MIN, ttlDetected: true }
  return { ttlMs: FIVE_MIN, ttlDetected: false }
}

export async function getMeter($: EngineInterface): Promise<Meter | null> {
  return (await $.state.get(METER)).value ?? null
}

export async function setMeter($: EngineInterface, m: Meter | null) {
  await $.state.set(METER, m)
}

export async function patchMeter($: EngineInterface, fn: (m: Meter) => Meter) {
  await setMeter($, fn((await getMeter($)) ?? blank(await $.clock.now())))
}

export async function getWarm($: EngineInterface): Promise<Warm | null> {
  return (await $.state.get(WARM)).value ?? null
}

export async function setWarm($: EngineInterface, w: Warm | null) {
  await $.state.set(WARM, w)
  redraw($)
}

export function redraw($: EngineInterface) {
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // the next tick redraws anyway
  }
}

export function toast($: EngineInterface, text: string) {
  try {
    $.ui.toast(text)
  } catch {
    // a toast is only a hint
  }
}

export async function modelName($: EngineInterface): Promise<string> {
  try {
    return String((await $.session.model()) ?? '')
  } catch {
    return ''
  }
}
