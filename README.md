# Achievements Unlocked

Steam / PlayStation-style achievements for the tabletop, inside Foundry VTT.

The GM authors achievements — a name, a description and an optional badge
image — into a pool for the world. When a player earns one, the GM hits
**Unlocked!**, picks who, and everyone at the table gets the popup:

```
┌─────────────────────────────────────────────────┐
│ ╭─────╮  ACHIEVEMENT UNLOCKED!                  │
│ │  ★  │  Dragon Slayer                          │
│ ╰─────╯  Landed the killing blow on an adult    │
│          dragon.                — Bob (Thorin)  │
└─────────────────────────────────────────────────┘
```

…with a chime, a shine sweep, and a chat card for the record. Players keep
what they earned in a trophy case.

## Features

- **Achievement pool** per world: name, description, badge image (any image
  Foundry can serve; defaults to a gold star), optional *hidden* flag.
- **Unlock dialog**: pick players (avatars, character names, online status),
  *Select all*, players who already own it are marked, optional re-announce.
- **Popup for everyone** connected — top-centre banner (PlayStation style) or
  bottom-right (Steam style), with sound. Several unlocks queue up.
- **Chat card** so the moment survives after the popup fades and offline
  players see it when they log in.
- **Trophy case**: each player's earned badges, newest first, with unlock
  dates and a progress bar. Locked achievements can show greyed out; hidden
  ones stay "???" until unlocked. Anyone can peek at anyone's trophy case
  from the Players list.
- **Macro / API** access for automation (see below).

## Install

Foundry → *Add-on Modules* → *Install Module* → paste the manifest URL:

```
https://github.com/m-andriiash/achievements-unlocked/releases/latest/download/module.json
```

Enable the module in your world. Requires Foundry VTT **13 or newer**
(verified on 14). See [INSTALL.md](INSTALL.md) for a manual install.

## Using it

### GM

- Click the **trophy** button in the token controls (left toolbar) to open
  the **Achievements** manager.
- **New achievement** → name, description, badge image (*Browse* opens the
  file picker so you can upload one), *Hidden* if it should be a secret.
- On any card: **Unlocked!** opens the player picker. **Edit** / **Delete**
  do what they say. Avatars on the card show who already owns it.
- Right-click a player in the Players list → **Unlock achievement…** opens
  the manager with that player pre-selected in the next unlock dialog.

### Players

- The **trophy** button in the token controls opens your trophy case.
- Right-click anyone in the Players list → **View achievements**.

### Settings

| Setting | Scope | Default |
|---|---|---|
| Post a chat card | world | on |
| Show locked achievements (greyed out in the trophy case) | world | on |
| Show character names next to player names | world | on |
| Popup duration | world | 6 s |
| Popup position (top centre / bottom right) | world | top centre |
| Sparkle effect (shine sweep + badge pop) | world | on |
| Play unlock sound | client | on |
| Unlock sound file | world | built-in chime |

## API

```js
const api = game.modules.get("achievements-unlocked").api;

// Windows
api.openManager();
api.openTrophyCase(game.user);               // any user
api.openGrant(achievementId, [userId, ...]); // picker with users pre-checked

// Data (writes are GM-only)
api.list();                                  // all achievements
api.get(id);
api.trophyCaseFor(userId);                   // [{...achievement, unlocked, unlockedAt}]
await api.create({ name, description, img, hidden });
await api.update(id, { description: "..." });
await api.delete(id);
await api.revoke(id, [userId]);

// The main event: store the grant, popup for everyone, chat card
await api.unlock(id, [userId, ...], { reannounce: false });
```

Data lives in the world setting `achievements-unlocked.pool`
(`{ schema, achievements: { [id]: { id, name, description, img, hidden, createdAt, grants: { [userId]: timestamp } } } }`).
Only GMs can write it; every client reads it and open windows refresh live.

## Development

Plain ES modules, no build step. Symlink or copy the folder into
`<FoundryData>/modules/achievements-unlocked` and reload. Releases: push a
`v*` tag and the GitHub workflow stamps `module.json`, zips the module and
publishes the release behind the manifest URL above.

## License

MIT
