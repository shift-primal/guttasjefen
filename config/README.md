# config/

Files the bot reads at runtime but that stay out of git. Mounted read-only into
Docker and pushed to the server by `pnpm deploy:vps` (empty files are skipped).

```
config/
├── music/
│   └── cookies.txt          YouTube cookies (Netscape format), src/music/extractors/youtube.ts
└── personality/             src/personality, `--config` in both scripts points here
    ├── persona.md           who the bot is, top of the system prompt (prompt.ts)
    ├── chat-rules.md        how it writes in chat, after the persona (prompt.ts)
    ├── lore.md              the start of its made-up life, always in the prompt (lore.ts)
    ├── examples.txt         liked "message → reply" lines, shown as examples and fed to distill:taste
    ├── disliked.txt         disliked "message → reply" lines, only fed to distill:taste
    ├── issues.txt           notes on bad replies, not read by any code
    └── taste/               written by `pnpm distill:taste`
        ├── taste.json       dial definitions and values, `enabled: false` turns dials off
        └── example-tags.json  dial scores per example, used to pick examples near the current dials
```

`pnpm test:prompt` appends the replies you rate to `examples.txt` and `disliked.txt`.
Dial changes made from Discord go to `data/dials.json`, and the life it makes up while chatting to
`data/lore.json` (see `-lore`), not here, since this folder is read-only in Docker.
