# my-claude-mods

Personal Claude Code mods.

| Mod | What it does |
| --- | --- |
| [usage-pilot](plugins/usage-pilot) | One quiet line above the prompt (usage limits, context, cache timer) with Compact, Keep warm and Handoff, and a cost check before an expensive send |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-pilot --marketplace KhaNomThai/my-claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user = every project).

From a shell:

```sh
claude plugin install usage-pilot --marketplace KhaNomThai/my-claude-mods
```

## Developing

Clone the repository, then use the clone as the marketplace so edits apply with `/reload-plugins`:

```sh
claude plugin marketplace add <path to clone>
claude plugin install usage-pilot@my-claude-mods
```

## Versions

A git hook bumps the patch version of each plugin a commit touches (in its `plugin.json` and in `marketplace.json`). For a minor or major bump, change `plugin.json` by hand: the hook sets the numbers after it to 0 (1.1.3 → 1.2.0) and keeps `marketplace.json` in step. Enable it once per clone:

```
git config core.hooksPath .githooks
```
