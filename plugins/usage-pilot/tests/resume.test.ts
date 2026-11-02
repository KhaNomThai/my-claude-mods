import { expect, mock, test } from 'claude-code/testing'

// A chat opened with /resume: the engine says its last reply ended two hours ago over 300k
// tokens. The very first send must be asked about, before any new reply has come in.
test('the first send after /resume is checked', async ($, on) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const asked: string[] = []

  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('session.id', () => ({ value: 'new-process' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  // Right after /resume the engine has no context figure for this chat yet.
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no log in a test', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.fill', () => ({ isFilled: true }))
  // The person picks Cancel in the question.
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    const question = e.questions[0]?.question ?? ''
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: 'Cancel' } } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(0)
  await $.classic.SessionStart({ source: 'resume', session_id: 'old-chat', seconds_since_last_response: 7200, context_tokens: 300_000 })
  await clock.advance(0)

  const sent = await $.prompt.submit({ text: 'carry on', wait: false, origin: { kind: 'composer' } })
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('300k')
  expect(asked[0]).toContain('Cache went cold')
  expect(JSON.stringify(sent)).toContain('cancelled')
})
