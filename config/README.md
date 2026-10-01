# config/

Old home of the bot's personality files and YouTube cookies. Everything now lives in the
database and is edited from the web app; the bot imports these files once on startup, for
anything the database doesn't have yet.

```
config/
├── music/cookies.txt         → setting "youtube-cookies"
└── personality/
    ├── persona.md            → setting "personality"
    ├── chat-rules.md         → setting "personality"
    ├── lore.md               → setting "personality"
    ├── issues.txt            → setting "personality"
    ├── examples.txt          → example table (liked)
    ├── disliked.txt          → example table (disliked)
    └── taste/
        ├── taste.json        → setting "taste"
        └── example-tags.json → example.tags
```

JSON files in `data/` (dials, lore, profiles) are imported the same way and renamed to `*.imported`.
