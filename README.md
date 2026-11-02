# my-mods

Personal Claude Code mods.

| Mod | What it does |
| --- | --- |
| [usage-pilot](plugins/usage-pilot) | One quiet line above the prompt (usage limits, context, cache timer) with Compact, Keep warm and Handoff, and a cost check before an expensive send |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-pilot --marketplace KhaNomThai/my-mods
```

Answer `y` to add the marketplace, then pick a scope (user = every project).

From a shell:

```sh
claude plugin install usage-pilot --marketplace KhaNomThai/my-mods
```

## Developing

Clone the repository, then use the clone as the marketplace so edits apply with `/reload-plugins`:

```sh
claude plugin marketplace add <path to clone>
claude plugin install usage-pilot@my-mods
```
