import { MODULE_ID, allAchievements, trophyCaseFor } from "../store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A player's trophy case: the badges they earned, plus (optionally) the
 * ones still locked, greyed out. Hidden achievements stay secret until
 * unlocked (GMs see everything).
 */
export class TrophyCase extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Open windows keyed by user id, so pool changes can re-render them. */
  static instances = new Map();

  static DEFAULT_OPTIONS = {
    classes: ["achievements-unlocked", "au-trophy-case"],
    position: { width: 600, height: 540 },
    window: { icon: "fas fa-trophy", resizable: true }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/trophy-case.hbs`, scrollable: [".au-grid"] }
  };

  constructor(user, options = {}) {
    super({ id: `achievements-trophy-case-${user.id}`, ...options });
    this.user = user;
  }

  /** Open (or focus) a user's trophy case. */
  static open(user = game.user) {
    if (!user) return null;
    const app = TrophyCase.instances.get(user.id) ?? new TrophyCase(user);
    app.render(true);
    return app;
  }

  get title() {
    return game.i18n.format("ACHIEVEMENTS.TrophyCase.Title", { name: this.user.name });
  }

  async _prepareContext() {
    const isGM = game.user.isGM;
    const includeLocked = isGM || game.settings.get(MODULE_ID, "showLocked");
    const items = trophyCaseFor(this.user.id, { includeLocked })
      .filter((a) => a.unlocked || isGM || !a.hidden)
      .map((a) => {
        const secret = a.hidden && !a.unlocked && !isGM;
        const unlockedLabel = a.unlocked
          ? game.i18n.format("ACHIEVEMENTS.TrophyCase.UnlockedOn", { date: formatDate(a.unlockedAt) })
          : "";
        return {
          id: a.id,
          img: a.img,
          unlocked: a.unlocked,
          locked: !a.unlocked,
          secret,
          hidden: a.hidden,
          name: secret ? game.i18n.localize("ACHIEVEMENTS.TrophyCase.HiddenName") : a.name,
          description: secret ? game.i18n.localize("ACHIEVEMENTS.TrophyCase.HiddenDescription") : a.description,
          unlockedLabel
        };
      });

    const visibleTotal = allAchievements().filter((a) => !a.hidden || a.grants?.[this.user.id] || isGM).length;
    const unlockedCount = items.filter((i) => i.unlocked).length;
    return {
      items,
      empty: unlockedCount === 0 && items.length === 0,
      nothingUnlocked: unlockedCount === 0,
      progressText: game.i18n.format("ACHIEVEMENTS.TrophyCase.Progress", { unlocked: unlockedCount, total: visibleTotal }),
      percent: visibleTotal ? Math.round((unlockedCount / visibleTotal) * 100) : 0
    };
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    TrophyCase.instances.set(this.user.id, this);
  }

  _onClose(options) {
    super._onClose?.(options);
    if (TrophyCase.instances.get(this.user.id) === this) TrophyCase.instances.delete(this.user.id);
  }
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return new Date(ts).toDateString();
  }
}
