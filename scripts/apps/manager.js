import { MODULE_ID, allAchievements, ownersOf, deleteAchievement } from "../store.js";
import { describeUser } from "../users.js";
import { dialogClass } from "../compat.js";
import { AchievementEditor } from "./editor.js";
import { GrantDialog } from "./grant.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The GM hub: every achievement in the world pool with Unlocked! / Edit / Delete.
 */
export class AchievementManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Open manager windows (there is normally one). */
  static instances = new Set();

  static DEFAULT_OPTIONS = {
    id: "achievements-manager",
    classes: ["achievements-unlocked", "au-manager"],
    position: { width: 660, height: 600 },
    window: { title: "ACHIEVEMENTS.Manager.Title", icon: "fas fa-trophy", resizable: true },
    actions: {
      create: AchievementManager.#onCreate,
      edit: AchievementManager.#onEdit,
      delete: AchievementManager.#onDelete,
      grant: AchievementManager.#onGrant
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/manager.hbs`, scrollable: [".au-list"] }
  };

  constructor({ preselect = [], ...options } = {}) {
    super(options);
    /** User ids to pre-check in the next grant dialog (from the players-list context menu). */
    this.preselect = preselect;
    this.search = "";
  }

  /** Open (or focus) the manager. */
  static open({ preselect } = {}) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("ACHIEVEMENTS.Api.GMOnly"));
      return null;
    }
    const app = AchievementManager.instances.values().next().value ?? new AchievementManager();
    if (preselect) app.preselect = preselect;
    app.render(true);
    return app;
  }

  async _prepareContext() {
    const achievements = allAchievements().map((a) => {
      const owners = ownersOf(a).map(describeUser);
      return {
        ...a,
        owners,
        ownersLabel: game.i18n.format("ACHIEVEMENTS.Manager.UnlockedBy", { count: owners.length }),
        searchText: `${a.name} ${a.description}`.toLowerCase()
      };
    });
    return { achievements, empty: achievements.length === 0, search: this.search };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const input = this.element.querySelector(".au-search");
    input?.addEventListener("input", () => {
      this.search = input.value;
      this.#applyFilter();
    });
    this.#applyFilter();
  }

  #applyFilter() {
    const q = this.search.trim().toLowerCase();
    let visible = 0;
    for (const card of this.element.querySelectorAll(".au-card")) {
      const match = !q || card.dataset.search.includes(q);
      card.hidden = !match;
      if (match) visible++;
    }
    const noMatch = this.element.querySelector(".au-no-match");
    if (noMatch) noMatch.hidden = visible > 0 || !q;
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    AchievementManager.instances.add(this);
  }

  _onClose(options) {
    super._onClose?.(options);
    AchievementManager.instances.delete(this);
  }

  /* ---------------------------------------- */

  static #idFrom(target) {
    return target.closest("[data-id]")?.dataset.id;
  }

  static #onCreate() {
    new AchievementEditor(null).render(true);
  }

  static #onEdit(_event, target) {
    const id = AchievementManager.#idFrom(target);
    if (id) new AchievementEditor(id).render(true);
  }

  static async #onDelete(_event, target) {
    const id = AchievementManager.#idFrom(target);
    const name = target.closest(".au-card")?.querySelector(".au-card-name")?.textContent?.trim() ?? "";
    if (!id) return;
    const ok = await dialogClass().confirm({
      window: { title: game.i18n.localize("ACHIEVEMENTS.Manager.DeleteTitle") },
      content: `<p>${game.i18n.format("ACHIEVEMENTS.Manager.DeleteConfirm", { name: foundry.utils.escapeHTML(name) })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!ok) return;
    const removed = await deleteAchievement(id);
    if (removed) ui.notifications.info(game.i18n.format("ACHIEVEMENTS.Manager.Deleted", { name: removed.name }));
  }

  static #onGrant(_event, target) {
    const id = AchievementManager.#idFrom(target);
    if (!id) return;
    const preselect = this.preselect;
    this.preselect = [];
    new GrantDialog(id, { preselect }).render(true);
  }
}
