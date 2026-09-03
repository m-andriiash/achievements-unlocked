import { MODULE_ID, getAchievement, isUnlockedBy } from "../store.js";
import { describeUser, playerUsers } from "../users.js";
import { unlock } from "../unlock.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * "Unlocked!" dialog: pick the players who earned an achievement.
 */
export class GrantDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Set();

  static DEFAULT_OPTIONS = {
    classes: ["achievements-unlocked", "au-grant"],
    tag: "form",
    position: { width: 460, height: "auto" },
    window: { icon: "fas fa-unlock" },
    form: { handler: GrantDialog.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: {
      cancel: function () {
        this.close();
      }
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/grant.hbs` }
  };

  /**
   * @param {string} achievementId
   * @param {object} [options]
   * @param {string[]} [options.preselect]  user ids checked on open
   */
  constructor(achievementId, { preselect = [], ...options } = {}) {
    super({ id: `achievements-grant-${achievementId}`, ...options });
    this.achievementId = achievementId;
    this.preselect = new Set(preselect);
  }

  get title() {
    const a = getAchievement(this.achievementId);
    return game.i18n.format("ACHIEVEMENTS.Grant.Title", { name: a?.name ?? "" });
  }

  async _prepareContext() {
    const achievement = getAchievement(this.achievementId);
    const players = playerUsers().map((u) => {
      const owned = isUnlockedBy(achievement, u.id);
      return { ...describeUser(u), owned, checked: !owned && this.preselect.has(u.id) };
    });
    return { achievement, players, noPlayers: players.length === 0 };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    const all = root.querySelector(".au-select-all-box");
    const reannounce = root.querySelector("[name=reannounce]");
    const boxes = () => [...root.querySelectorAll("input[name=user]")];

    const syncAll = () => {
      const enabled = boxes().filter((b) => !b.disabled);
      const checked = enabled.filter((b) => b.checked).length;
      if (!all) return;
      all.checked = enabled.length > 0 && checked === enabled.length;
      all.indeterminate = checked > 0 && checked < enabled.length;
    };

    all?.addEventListener("change", () => {
      for (const b of boxes()) if (!b.disabled) b.checked = all.checked;
      syncAll();
    });
    reannounce?.addEventListener("change", () => {
      for (const b of boxes()) {
        if (!b.dataset.owned) continue;
        b.disabled = !reannounce.checked;
        if (!reannounce.checked) b.checked = false;
      }
      syncAll();
    });
    for (const b of boxes()) b.addEventListener("change", syncAll);
    syncAll();
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    GrantDialog.instances.add(this);
  }

  _onClose(options) {
    super._onClose?.(options);
    GrantDialog.instances.delete(this);
  }

  /* ---------------------------------------- */

  static async #onSubmit(_event, form) {
    const userIds = [...form.querySelectorAll("input[name=user]:checked")].map((b) => b.value);
    const reannounce = !!form.querySelector("[name=reannounce]")?.checked;
    if (!userIds.length) {
      ui.notifications.warn(game.i18n.localize("ACHIEVEMENTS.Api.NoUsers"));
      return;
    }
    try {
      await unlock(this.achievementId, userIds, { reannounce });
      await this.close();
    } catch (err) {
      console.error(`${MODULE_ID} |`, err);
      ui.notifications.error(err.message);
    }
  }
}
