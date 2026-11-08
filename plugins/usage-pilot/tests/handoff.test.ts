import { expect, mock, test } from 'claude-code/testing'

// A handoff lives in memory only: /clear gets it in the prompt box, nothing touches the disk.
test('handoff reaches the next chat without a file', async ($, on) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const filled: string[] = []
  const writes: string[] = []

  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('session.id', () => ({ value: 'chat-1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.write', (_, e) => {
    writes.push(String(e.path))
    return {}
  })
  on('model.fork', () => ({ value: { isAnswered: true, text: '# Handoff: test' } }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(0)
  await $.command.run({ command: 'handoff', args: '' })
  await clock.advance(0)
  expect(filled).toContain('/clear')

  await $.classic.SessionStart({ source: 'clear', session_id: 'chat-2' })
  await clock.advance(0)
  expect(filled).toContain('# Handoff: test')
  expect(writes.length).toBe(0)

  // Delivered once: a second /clear finds nothing waiting.
  const before = filled.length
  await $.classic.SessionStart({ source: 'clear', session_id: 'chat-3' })
  await clock.advance(0)
  expect(filled.length).toBe(before)
})
