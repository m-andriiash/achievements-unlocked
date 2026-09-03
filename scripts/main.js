/**
 * Achievements Unlocked — Steam / PlayStation-style achievements for the table.
 *
 * The GM authors achievements into a world pool and unlocks them for players.
 * Every connected client gets the popup; a chat card keeps the record.
 */

import {
  MODULE_ID,
  POOL_SETTING,
  DEFAULT_SOUND,
  emptyPool,
  getAchievement,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  revokeAchievement,
  allAchievements,
  trophyCaseFor
} from "./store.js";
import { SOCKET, unlock, onSocketMessage } from "./unlock.js";
import { loadTemplates } from "./compat.js";
import { AchievementManager } from "./apps/manager.js";
import { AchievementEditor } from "./apps/editor.js";
import { GrantDialog } from "./apps/grant.js";
import { TrophyCase } from "./apps/trophy-case.js";

export { MODULE_ID };
const TEMPLATES = `modules/${MODULE_ID}/templates`;

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(MODULE_ID, POOL_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: emptyPool(),
    onChange: () => rerenderAll()
  });

  game.settings.register(MODULE_ID, "chatCard", {
    name: "ACHIEVEMENTS.Settings.ChatCard.Name",
    hint: "ACHIEVEMENTS.Settings.ChatCard.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showLocked", {
    name: "ACHIEVEMENTS.Settings.ShowLocked.Name",
    hint: "ACHIEVEMENTS.Settings.ShowLocked.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => rerenderAll()
  });

  game.settings.register(MODULE_ID, "showCharacterName", {
    name: "ACHIEVEMENTS.Settings.ShowCharacterName.Name",
    hint: "ACHIEVEMENTS.Settings.ShowCharacterName.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "toastDuration", {
    name: "ACHIEVEMENTS.Settings.ToastDuration.Name",
    hint: "ACHIEVEMENTS.Settings.ToastDuration.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 2, max: 20, step: 1 },
    default: 6
  });

  game.settings.register(MODULE_ID, "toastPosition", {
    name: "ACHIEVEMENTS.Settings.ToastPosition.Name",
    hint: "ACHIEVEMENTS.Settings.ToastPosition.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      top: "ACHIEVEMENTS.Settings.ToastPosition.Top",
      bottomRight: "ACHIEVEMENTS.Settings.ToastPosition.BottomRight"
    },
    default: "top"
  });

  game.settings.register(MODULE_ID, "sparkle", {
    name: "ACHIEVEMENTS.Settings.Sparkle.Name",
    hint: "ACHIEVEMENTS.Settings.Sparkle.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "sound", {
    name: "ACHIEVEMENTS.Settings.Sound.Name",
    hint: "ACHIEVEMENTS.Settings.Sound.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "soundFile", {
    name: "ACHIEVEMENTS.Settings.SoundFile.Name",
    hint: "ACHIEVEMENTS.Settings.SoundFile.Hint",
    scope: "world",
    config: true,
    type: String,
    filePicker: "audio",
    default: DEFAULT_SOUND
  });
}

/** Re-render every open module window after the pool (or a display setting) changes. */
function rerenderAll() {
  const apps = [...AchievementManager.instances, ...TrophyCase.instances.values(), ...GrantDialog.instances];
  for (const app of apps) if (app.rendered) app.render();
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  loadTemplates({
    "achievements-unlocked.badge": `${TEMPLATES}/partials/badge.hbs`
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, onSocketMessage);

  game.modules.get(MODULE_ID).api = {
    // Windows
    openManager: () => AchievementManager.open(),
    openTrophyCase: (user = game.user) => TrophyCase.open(user),
    openEditor: (achievementId = null) => new AchievementEditor(achievementId).render(true),
    openGrant: (achievementId, userIds = []) => new GrantDialog(achievementId, { preselect: userIds }).render(true),
    // Data
    list: allAchievements,
    get: getAchievement,
    trophyCaseFor,
    create: createAchievement,
    update: updateAchievement,
    delete: deleteAchievement,
    revoke: revokeAchievement,
    // The main event
    unlock
  };
});

// Toolbar button in the token controls: GM → manager, player → own trophy case.
Hooks.on("getSceneControlButtons", (controls) => {
  const open = () => (game.user.isGM ? AchievementManager.open() : TrophyCase.open(game.user));
  const tool = {
    name: MODULE_ID,
    title: "ACHIEVEMENTS.ToolTitle",
    icon: "fas fa-trophy",
    button: true,
    visible: true,
    onChange: open
  };
  if (Array.isArray(controls)) {
    controls.find((c) => c.name === "token")?.tools.push(tool);
  } else {
    const group = controls.tokens ?? controls.token;
    if (group?.tools) group.tools[MODULE_ID] = { ...tool, order: Object.keys(group.tools).length };
  }
});

// Players list context menu: view anyone's trophy case; GMs can unlock from here.
Hooks.on("getUserContextOptions", (_html, options) => {
  const userFrom = (li) => {
    const el = li instanceof HTMLElement ? li : li?.[0];
    return game.users.get(el?.dataset.userId);
  };
  options.push(
    {
      name: "ACHIEVEMENTS.Context.TrophyCase",
      icon: '<i class="fas fa-trophy"></i>',
      condition: (li) => !!userFrom(li),
      callback: (li) => TrophyCase.open(userFrom(li))
    },
    {
      name: "ACHIEVEMENTS.Context.Unlock",
      icon: '<i class="fas fa-unlock"></i>',
      condition: (li) => game.user.isGM && !!userFrom(li) && !userFrom(li).isGM,
      callback: (li) => AchievementManager.open({ preselect: [userFrom(li).id] })
    }
  );
});
