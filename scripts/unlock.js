/**
 * The main event: unlocking an achievement for players.
 * Stores the grant, broadcasts to every client, posts the chat card.
 */

import { MODULE_ID, getAchievement, grantAchievement } from "./store.js";
import { describeUser } from "./users.js";
import { showToast } from "./toast.js";
import { renderTemplate } from "./compat.js";

export const SOCKET = `module.${MODULE_ID}`;
const CHAT_TEMPLATE = `modules/${MODULE_ID}/templates/chat-card.hbs`;

/**
 * @param {string} achievementId
 * @param {string[]} userIds
 * @param {object} [options]
 * @param {boolean} [options.reannounce=false]  Also announce for users who already own it.
 * @returns {Promise<string[]>} ids of the users the unlock was announced for
 */
export async function unlock(achievementId, userIds, { reannounce = false } = {}) {
  if (!game.user.isGM) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.GMOnly"));
  const achievement = getAchievement(achievementId);
  if (!achievement) throw new Error(game.i18n.localize("ACHIEVEMENTS.Api.NotFound"));

  const targets = [...new Set(userIds)].filter((id) => game.users.get(id));
  if (!targets.length) {
    ui.notifications.warn(game.i18n.localize("ACHIEVEMENTS.Api.NoUsers"));
    return [];
  }

  const newly = await grantAchievement(achievementId, targets);
  const announce = reannounce ? targets : newly;
  if (!announce.length) {
    ui.notifications.info(game.i18n.localize("ACHIEVEMENTS.Api.AlreadyOwned"));
    return [];
  }

  const recipients = announce.map((id) => describeUser(game.users.get(id)));
  const payload = {
    achievementId,
    name: achievement.name,
    description: achievement.description,
    img: achievement.img,
    recipients
  };

  game.socket.emit(SOCKET, { type: "unlocked", payload });
  showToast(payload);
  if (game.settings.get(MODULE_ID, "chatCard")) await postChatCard(payload);

  ui.notifications.info(
    game.i18n.format("ACHIEVEMENTS.Grant.Done", {
      name: achievement.name,
      names: recipients.map((r) => r.name).join(", ")
    })
  );
  return announce;
}

async function postChatCard(payload) {
  const content = await renderTemplate(CHAT_TEMPLATE, {
    ...payload,
    header: game.i18n.localize("ACHIEVEMENTS.Chat.Header")
  });
  return ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("ACHIEVEMENTS.ChatAlias") },
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: {
      [MODULE_ID]: { achievementId: payload.achievementId, recipients: payload.recipients.map((r) => r.id) }
    }
  });
}

/** Socket handler for every client that did not initiate the unlock. */
export function onSocketMessage(message) {
  if (message?.type !== "unlocked" || !message.payload) return;
  const payload = message.payload;
  // Prefer the synced pool for name/description/image; fall back to the
  // inline copy in case the setting update hasn't landed yet.
  const fresh = getAchievement(payload.achievementId);
  showToast(fresh ? { ...payload, name: fresh.name, description: fresh.description, img: fresh.img } : payload);
}
