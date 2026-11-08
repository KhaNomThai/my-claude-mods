// The one line above the prompt: numbers only, colour only where it means something.
import type { On } from 'claude-code'

import { BIG_ASK_AT, COLOR } from './config'
import { clock, duration, levelColor, limitLabel, pie, tokens } from './format'
import { getMeter, getWarm, rt, toast } from './state'
import { compact } from './usage'
import { handoff } from './guard'
import { toggleWarm } from './warm'

type Part = { key: string; label: string; value: string; color?: string; extra?: string }

export function band(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
  const m = await getMeter($)
  if (!m) return next(e)
  const rest = await next(e)
  const warm = await getWarm($)
  const { Box, Text, Button } = $.ui.resolve(e)
  const busy = rt.working || e.props.isWorking

  const parts: Part[] = m.limits.map(l => {
    const left = l.resetsAt ? Date.parse(l.resetsAt) - m.now : NaN
    // Past its reset the old reading is stale: the window is empty until the next refresh.
    const p = left <= 0 ? 0 : l.percent
    return {
      key: l.kind,
      label: limitLabel(l.kind),
      value: `${pie(p)} ${Math.round(p)}%`,
      color: levelColor(p),
      extra: left > 0 ? ` (${duration(left)})` : undefined,
    }
  })

  parts.push(
    m.note
      ? { key: 'ctx', label: 'ctx', value: m.note, color: COLOR.warn }
      : {
          key: 'ctx',
          label: 'ctx',
          value: `${pie(m.percent)} ${m.percent}%`,
          color: levelColor(m.percent),
          extra: m.window ? ` ${tokens(m.tokens)}/${tokens(m.window)}` : undefined,
        },
  )

  let cache: { value: string; color?: string } = { value: '—' }
  if (m.lastEnd && busy) cache = { value: '●', color: COLOR.good }
  else if (m.lastEnd) {
    const left = m.lastEnd + m.ttlMs - m.now
    cache =
      left > 0
        ? { value: clock(left), color: left <= 60_000 ? COLOR.bad : left / m.ttlMs < 0.5 ? COLOR.warn : COLOR.good }
        : { value: 'cold', color: COLOR.cold }
  }
  parts.push({ key: 'cache', label: 'cache', value: warm ? `${cache.value} ♨` : cache.value, color: cache.color })

  const onWarm = async () => {
    const r = await toggleWarm($)
    toast($, r === 'on' ? 'Keep warm on — stops when you send a message' : r === 'off' ? 'Keep warm off' : 'Keep warm needs a reply from Claude first')
  }

  return (
    <Box flexDirection="column">
      {rest}
      <Box flexDirection="row" justifyContent="space-between" gap={2}>
        <Text>
          {parts.map((p, i) => (
            <Text key={p.key}>
              {i ? <Text dimColor>{'  ·  '}</Text> : null}
              <Text dimColor>{`${p.label} `}</Text>
              <Text color={p.color}>{p.value}</Text>
              {p.extra ? <Text dimColor>{p.extra}</Text> : null}
            </Text>
          ))}
        </Text>
        <Box flexDirection="row" gap={2}>
          <Button key="compact" label="Compact" hotkey="1" plain dimColor onPress={() => compact($)} />
          <Button key="keepwarm" label={warm ? 'Stop warm' : 'Warm'} hotkey="2" plain dimColor onPress={onWarm} />
          {m.tokens >= BIG_ASK_AT ? <Button key="handoff" label="Handoff" hotkey="3" plain onPress={() => handoff($)} /> : null}
        </Box>
      </Box>
    </Box>
  )
  })
}
