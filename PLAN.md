# Achievements Unlocked — module plan

A Foundry VTT module that gives a tabletop campaign Steam/PlayStation-style
achievements. The GM authors achievements (name, description, optional image),
keeps them in a per-world pool, and unlocks them for chosen players at the
table. Every connected client gets a celebratory "Achievement unlocked!"
popup; players collect what they earned in a trophy case.

Module id: `achievements-unlocked` · folder: `achievements_unlocked` ·
repo: `github.com/m-andriiash/achievements-unlocked` (same tag-push release
flow as dice-jail / foundry-deck).

---

## 1. Scope

### GM side
- **Manager window** — the hub. Lists every achievement in the world pool as a
  card (badge image, name, description, "unlocked by N players").
  Toolbar: *New achievement*, search box.
  Per card: **Unlocked!**, *Edit*, *Delete*, and the avatars of players who
  already own it.
- **Achievement editor** (create / edit) — form with:
  - Name (required, ≤ 60 chars)
  - Description (required, multi-line, ≤ 300 chars)
  - Image — Foundry FilePicker (browse / upload) with live badge preview;
    empty ⇒ the module's default gold star.
  - Optional: *Hidden* flag (players do not see it in the trophy case until
    unlocked; shows as "???" if the locked view is on).
- **Grant dialog** ("Unlocked!") — list of players with checkboxes, avatar,
  name, and the character they play (if any). *Select all* toggle. Players who
  already own it are pre-checked and disabled unless *Re-announce* is ticked.
  Offline players can be granted too (they get the popup next time they log
  in? — no: keep it simple, they see it in the trophy case; announcement is a
  live event only). Confirm with **Unlock**.
- **Re-order / bulk**: not in v1. Drag-sort can come later.

### Player side
- **Trophy case window** — grid of badges the player owns, newest first,
  with unlock date on hover / click. Header counter "3 / 12 unlocked".
  Setting-controlled *locked view*: unowned achievements shown greyed out
  (silhouette) so players know what's out there; hidden ones show as "???".
- **Unlock popup** — see §4. Appears for **everyone connected** (GM included),
  not only the recipients, exactly like a party-wide announcement.
- **Chat card** (optional, on by default) — a compact permanent record in the
  chat log so the moment survives after the popup fades and offline players
  see it later.

### Entry points
- Scene-controls tool button (token group, like dice-jail): GM → Manager,
  player → Trophy case.
- Players list context menu (right-click a player) → *Unlock achievement…*
  jumps straight to the grant dialog with that player pre-checked.
- Public API on `game.modules.get("achievements-unlocked").api` for macros /
  Stream Deck: `create()`, `grant(achievementId, userIds)`, `openManager()`,
  `openTrophyCase()`. (Later: a Foundry Deck action "Unlock achievement".)

---

## 2. Data model

One **world-scoped setting** holds the whole pool. Only a GM can write world
settings (Foundry enforces it), every client can read it, and the
`updateSetting` hook fires on all clients ⇒ open windows re-render live.
Nothing else to sync, no document permissions to manage.

```js
// game.settings.get("achievements-unlocked", "pool")
{
  schema: 1,
  achievements: {
    "<16-char id>": {
      id, name, description,
      img: "modules/achievements-unlocked/assets/star.svg" | "<user path>",
      hidden: false,
      createdAt: 1756900000000,
      grants: {            // userId -> unlock timestamp
        "<userId>": 1756901234567
      }
    }
  }
}
```

- IDs via `foundry.utils.randomID()`.
- Grants live *on the achievement*, keyed by **User id** (the user asked for
  players; the character name is shown as decoration, resolved from
  `user.character` at render time so re-assigning characters doesn't break
  anything).
- `schema` field + a `migrate()` step in `store.js` so later versions can
  reshape the data safely.
- Size: a campaign has tens of achievements — a single JSON setting is fine.
  (Alternative considered: a JournalEntry per achievement. Rejected: needs
  ownership juggling, clutters the journal sidebar, no upside at this scale.)

Deleting a User in Foundry leaves an orphan grant key; harmless, skipped on
render.

---

## 3. Runtime flow

```
GM clicks "Unlocked!" ──▶ grant dialog ──▶ Unlock
        │
        ├─ store.grant(id, userIds)          // writes setting (GM only)
        ├─ ChatMessage.create(card)          // if setting enabled
        └─ socket.emit("module.achievements-unlocked",
             { type: "unlocked", achievementId, userIds })
                     │
     every client (GM shows it locally, no self-socket)
                     ▼
              toast.enqueue(payload) ──▶ popup + sound
```

- Socket payload carries only ids; each client reads names/images from the
  freshly synced setting (the `updateSetting` broadcast lands before or with
  the socket message; the toast reads the pool lazily when it is displayed,
  and falls back to the payload's inline copy of name/description/img so
  ordering can never produce an empty popup).
- Toast queue: several grants in a row stack, one at a time, 600 ms gap.
- Non-GM clients ignore any socket message that would mutate data — the
  setting write is GM-only anyway, so no privilege escalation is possible.

---

## 4. Look & feel — the unlock popup

The centrepiece. Target: the feeling of a PlayStation trophy / Steam
achievement, adapted to Foundry's parchment-and-gold UI.

- **Placement**: top-centre banner, slides down from above the canvas
  (PlayStation-style), sits ~6 s (configurable), slides back up. Not a
  window: a fixed-position DOM element appended to `#interface` so it floats
  above everything and can't be dragged or lose focus.
- **Layout** (≈ 460 × 110 px):

  ```
  ┌─────────────────────────────────────────────────┐
  │ ╭─────╮  ACHIEVEMENT UNLOCKED!                  │
  │ │ img │  Dragon Slayer                          │
  │ │  ★  │  Landed the killing blow on an adult    │
  │ ╰─────╯  dragon.               — Bob (Thorin)   │
  └─────────────────────────────────────────────────┘
  ```
  - Badge: 84 px circle, gold ring (`conic-gradient` for a brushed-metal
    look), radial dark centre, image inside with `object-fit: cover`;
    default star is an SVG shipped in `assets/`.
  - Header line "ACHIEVEMENT UNLOCKED!" in small caps, gold, letter-spaced,
    Modesto Condensed (Foundry's own display font).
  - Name in large white/parchment, description below in Signika, muted.
  - Recipients right-aligned: player name, character in parentheses when
    present; "Alice, Bob & 2 more" when many.
- **Animation**: a diagonal shine sweep across the card once on entry
  (`::after` gradient translated with a keyframe), badge scales in with a
  slight overshoot, faint particle sparkle is optional and behind a setting.
- **Sound**: short chime (`assets/unlock.ogg`, ~1 s, CC0). Played via
  `foundry.audio.AudioHelper.play({ src, volume }, false)` per client so it
  respects each user's interface volume. Setting: on/off + custom file.
- **Chat card**: same badge at 48 px, header, name, description, recipients.
  Uses a module CSS class so it renders identically in every theme.
- **Trophy case badge**: same ring; locked ones desaturated + 40 % opacity +
  a small padlock; hidden ones a "?" glyph.
- Respect `prefers-reduced-motion` (fade instead of slide/shine).

---

## 5. Settings

| key | scope | default | purpose |
|---|---|---|---|
| `pool` | world, hidden | `{schema:1, achievements:{}}` | the data |
| `chatCard` | world | true | post a chat message on unlock |
| `showLocked` | world | true | players see unowned (non-hidden) achievements greyed out |
| `toastDuration` | world | 6 (s) | how long the popup stays |
| `toastPosition` | world | "top" | top / bottom-right |
| `sound` | client | true | play the chime |
| `soundFile` | world | default ogg | custom chime |
| `showCharacterName` | world | true | "Bob (Thorin)" vs "Bob" |

---

## 6. File layout

```
achievements_unlocked/
├── module.json                 id, esmodules, styles, languages, socket: true,
│                               compatibility { minimum: "13", verified: "14" }
├── README.md  INSTALL.md  LICENSE (MIT)  .gitignore
├── .github/workflows/release.yml   copy of dice-jail's (tag v* → zip + release)
├── lang/en.json                ACHIEVEMENTS.* keys
├── scripts/
│   ├── main.js                 init/ready hooks, settings, scene-control button,
│   │                           players-list context entry, socket wiring, api
│   ├── store.js                pool read/write, create/update/delete/grant,
│   │                           migrate(), helpers (isUnlockedBy, ownersOf)
│   ├── toast.js                popup queue + DOM + sound
│   └── apps/
│       ├── manager.js          GM hub (ApplicationV2 + Handlebars)
│       ├── editor.js           create/edit form (FilePicker, preview)
│       ├── grant.js            player picker
│       └── trophy-case.js      player view
├── templates/
│   ├── manager.hbs  editor.hbs  grant.hbs  trophy-case.hbs
│   ├── toast.hbs    chat-card.hbs
│   └── partials/badge.hbs      the ring+image badge, reused everywhere
├── styles/achievements-unlocked.css
└── assets/star.svg  unlock.ogg  (+ locked.svg, hidden.svg)
```

All apps use `HandlebarsApplicationMixin(ApplicationV2)` with `actions`
maps, matching dice-jail. FilePicker via
`foundry.applications.apps.FilePicker.implementation` (v13+ namespace).
Scene-control hook: the v13 object form only (min 13).

Compatibility target: **minimum 13, verified 14** — the game server is
v14.367; v12 support isn't worth the dual code paths (scene controls, chat
context, FilePicker all changed in 13).

---

## 7. Milestones

1. **Skeleton + data** — module.json, lang, settings, `store.js` with tests
   run from the console, scene-control button. Manager window listing
   achievements; editor with FilePicker; delete with confirmation.
2. **Unlock** — grant dialog, socket broadcast, toast popup with animation
   and sound, chat card. This is the "wow" milestone: demo it at the table.
3. **Trophy case** — player window, locked/hidden views, counters, unlock
   dates. Players-list context-menu shortcut.
4. **Polish + release** — settings page, reduced-motion, i18n pass, README
   with screenshots, INSTALL.md, release workflow, tag `v0.1.0`, manifest
   URL `https://github.com/m-andriiash/achievements-unlocked/releases/latest/download/module.json`.

Later ideas (not v1): Foundry Deck action to fire an achievement from the
Stream Deck; import/export the pool as JSON; achievement "tiers" (bronze /
silver / gold ring colours); per-actor instead of per-user grants; rarity
stat ("unlocked by 25 % of players").

---

## 8. Open decisions (defaults I'll take unless told otherwise)

- Popup shown to **everyone**, including players not granted (as requested).
- Grants keyed by **User**, character shown as decoration.
- Popup position **top-centre**, PlayStation-style; bottom-right as option.
- Default badge: **gold star**; tiers/colours later.
- Foundry **13+** only.
