"""Reads this chat's log and prints, as JSON, what the last main-chat reply left behind:
ttl    the prompt-cache length it wrote with: "1h", "5m" or "unknown"
at     when it ended, in ms since the epoch (0 when there is none)
tokens the context it was answered over: input, cache-read and cache-write tokens together
A resumed chat has these before its first new reply, so the cost check works from the first send."""
import glob, json, os, sys
from datetime import datetime

sid = sys.argv[1] if len(sys.argv) > 1 else ''
out = {'ttl': 'unknown', 'at': 0, 'tokens': 0}
paths = glob.glob(os.path.expanduser(f'~/.claude/projects/*/{sid}.jsonl')) if sid else []
if paths:
    with open(max(paths, key=os.path.getmtime), 'rb') as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 3_000_000))
        tail = f.read().decode('utf-8', 'ignore').splitlines()[1:]
    for line in reversed(tail):
        try:
            j = json.loads(line)
        except Exception:
            continue
        if j.get('type') != 'assistant' or j.get('isSidechain'):
            continue
        msg = j.get('message') or {}
        usage = msg.get('usage') or {}
        if msg.get('model') == '<synthetic>' or not usage:
            continue
        if not out['at']:
            try:
                out['at'] = int(datetime.fromisoformat(j['timestamp'].replace('Z', '+00:00')).timestamp() * 1000)
            except Exception:
                pass
            out['tokens'] = sum(usage.get(k) or 0 for k in ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
        cc = usage.get('cache_creation') or {}
        if (cc.get('ephemeral_1h_input_tokens') or 0) > 0:
            out['ttl'] = '1h'
        elif (cc.get('ephemeral_5m_input_tokens') or 0) > 0:
            out['ttl'] = '5m'
        if out['ttl'] != 'unknown':
            break
print(json.dumps(out))
