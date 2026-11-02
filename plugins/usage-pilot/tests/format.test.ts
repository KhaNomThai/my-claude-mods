import { expect, test } from 'claude-code/testing'

import { clock, duration, limitLabel, pie, priceOf, sendCost, tokens, usd } from '../hooks/format'

test('token counts read short', async () => {
  expect(tokens(41_200)).toBe('41k')
  expect(tokens(1_000_000)).toBe('1M')
  expect(tokens(1_500_000)).toBe('1.5M')
})

test('times read short', async () => {
  expect(clock(252_000)).toBe('4:12')
  expect(clock(-5)).toBe('0:00')
  expect(duration(12 * 60_000)).toBe('12m')
  expect(duration(192 * 60_000)).toBe('3h12m')
  expect(duration(52 * 60 * 60_000)).toBe('2d4h')
})

test('limits and pies', async () => {
  expect(limitLabel('five_hour')).toBe('5h')
  expect(limitLabel('seven_day')).toBe('7d')
  expect(pie(5)).toBe('○')
  expect(pie(50)).toBe('◑')
  expect(pie(95)).toBe('●')
})

test('prices follow the model', async () => {
  expect(priceOf('claude-opus-5-5')).toEqual([0.2, 8])
  expect(priceOf('Claude Sonnet 5.5')).toEqual([0.1, 4])
  expect(priceOf('some-other-model')).toBe(null)
  const c = sendCost('claude-opus-5-5', 341_000)
  expect(usd(c!.warm)).toBe('$0.07')
  expect(usd(c!.cold)).toBe('$2.73')
  expect(usd(0.001)).toBe('<$0.01')
})
