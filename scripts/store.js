/**
 * Achievement pool storage.
 *
 * The whole pool lives in one world-scoped setting. Foundry only lets GMs
 * write world settings, every client can read them, and the setting's
 * onChange fires on all clients when it changes — so open windows simply
 * re-render and there is nothing else to sync.
 *
 * Shape (schema 1):
 *   { schema: 1, achievements: { [id]: { id, name, description, img, hidden, createdAt, grants: { [userId]: ts } } } }
 */

export const MODULE_ID = "achievements-unlocked";
export const POOL_SETTING = "pool";
export const DEFAULT_IMG = `modules/${MODULE_ID}/assets/star.svg`;
export const DEFAULT_SOUND = `modules/${MODULE_ID}/assets/unlock.wav`;
export const SCHEMA = 1;

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 300;

export function emptyPool() {
  return { schema: SCHEMA, achievements: {} };
}

/** Bring a stored pool up to the current schema. Cheap and idempotent. */
export function migrate(pool) {
  if (!pool || typeof pool !== "object") return emptyPool();
  const out = { schema: SCHEMA, achievements: {} };
  for (const [id, a] of Object.entries(pool.achievements ?? {})) {
    if (!a || typeof a !== "object") continue;
    out.achievements[id] = {
      id,
      name: String(a.name ?? ""),
      description: String(a.description ?? ""),
      img: a.img || DEFAULT_IMG,
      hidden: !!a.hidden,
      createdAt: Number(a.createdAt) || 0,
      grants: { ...(a.grants ?? {}) }
    };
  }
  return out;
}

/* -------------------------------------------- */
/*  Reads                                       */
/* -------------------------------------------- */

export function getPool() {
  return migrate(foundry.utils.deepClone(game.settings.get(MODULE_ID, POOL_SETTING)));
}

/** All achievements, oldest first. */
export function allAchievements() {
  return Object.values(getPool().achievements).sort((a, b) => a.createdAt - b.createdAt);
}

export function getAchievement(id) {
  return getPool().achievements[id] ?? null;
}

export function isUnlockedBy(achievement, userId) {
  return !!achievement?.grants?.[userId];
}

/** User documents that own an achievement (deleted users are skipped). */
export function ownersOf(achievement) {
  return Object.keys(achievement.grants ?? {})
    .map((id) => game.users.get(id))
    .filter(Boolean);
}

/**
 * What a user sees in their trophy case: every non-hidden achievement plus
 * hidden ones they unlocked, each tagged with unlock info. Newest unlocks
 * first, then locked ones in creation order.
 */
export function trophyCaseFor(userId, { includeLocked = true } = {}) {
  const items = [];
  for (const a of allAchievements()) {
    const unlockedAt = a.grants?.[userId];
    if (unlockedAt) items.push({ ...a, unlocked: true, unlockedAt });
    else if (includeLocked) items.push({ ...a, unlocked: false, unlockedAt: null });
  }
  return items.sort((x, y) => {
    if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1;
    if (x.unlocked) return y.unlockedAt - x.unlockedAt;
    return x.createdAt - y.createdAt;
  });
}

/* -------------------------------------------- */
/*  Writes (GM only)                            */
/* -------------------------------------------- */

function assertGM() {
  if (!game.user.isGM) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.GMOnly"));
}

async function savePool(pool) {
  assertGM();
  await game.settings.set(MODULE_ID, POOL_SETTING, pool);
  return pool;
}

function clean({ name, description, img, hidden }) {
  return {
    name: String(name ?? "").trim().slice(0, NAME_MAX),
    description: String(description ?? "").trim().slice(0, DESCRIPTION_MAX),
    img: String(img ?? "").trim() || DEFAULT_IMG,
    hidden: !!hidden
  };
}

export async function createAchievement(data) {
  assertGM();
  const fields = clean(data);
  if (!fields.name) throw new Error(game.i18n.localize("ACHIEVEMENTS.Editor.NameRequired"));
  const pool = getPool();
  const id = foundry.utils.randomID(16);
  pool.achievements[id] = { id, ...fields, createdAt: Date.now(), grants: {} };
  await savePool(pool);
  return pool.achievements[id];
}

export async function updateAchievement(id, changes) {
  assertGM();
  const pool = getPool();
  const current = pool.achievements[id];
  if (!current) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.NotFound"));
  const fields = clean({ ...current, ...changes });
  if (!fields.name) throw new Error(game.i18n.localize("ACHIEVEMENTS.Editor.NameRequired"));
  pool.achievements[id] = { ...current, ...fields };
  await savePool(pool);
  return pool.achievements[id];
}

export async function deleteAchievement(id) {
  assertGM();
  const pool = getPool();
  const removed = pool.achievements[id];
  if (!removed) return null;
  delete pool.achievements[id];
  await savePool(pool);
  return removed;
}

/** Record grants for users that don't have the achievement yet. Returns the ids newly granted. */
export async function grantAchievement(id, userIds, timestamp = Date.now()) {
  assertGM();
  const pool = getPool();
  const a = pool.achievements[id];
  if (!a) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.NotFound"));
  const newly = [];
  for (const userId of userIds) {
    if (!game.users.get(userId) || a.grants[userId]) continue;
    a.grants[userId] = timestamp;
    newly.push(userId);
  }
  if (newly.length) await savePool(pool);
  return newly;
}

export async function revokeAchievement(id, userIds) {
  assertGM();
  const pool = getPool();
  const a = pool.achievements[id];
  if (!a) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.NotFound"));
  let changed = false;
  for (const userId of userIds) {
    if (!(userId in a.grants)) continue;
    delete a.grants[userId];
    changed = true;
  }
  if (changed) await savePool(pool);
  return changed;
}
