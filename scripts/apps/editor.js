import {
  MODULE_ID,
  DEFAULT_IMG,
  NAME_MAX,
  DESCRIPTION_MAX,
  getAchievement,
  createAchievement,
  updateAchievement
} from "../store.js";
import { filePickerClass } from "../compat.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Create / edit form for one achievement, with a live badge preview.
 */
export class AchievementEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["achievements-unlocked", "au-editor"],
    tag: "form",
    position: { width: 540, height: "auto" },
    window: { icon: "fas fa-pen-to-square" },
    form: { handler: AchievementEditor.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: {
      browse: AchievementEditor.#onBrowse,
      cancel: function () {
        this.close();
      }
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/editor.hbs` }
  };

  /** @param {string|null} achievementId  null creates a new achievement */
  constructor(achievementId = null, options = {}) {
    super({ id: `achievements-editor-${achievementId ?? "new"}`, ...options });
    this.achievementId = achievementId;
  }

  get isNew() {
    return !this.achievementId;
  }

  get title() {
    return game.i18n.localize(this.isNew ? "ACHIEVEMENTS.Editor.TitleCreate" : "ACHIEVEMENTS.Editor.TitleEdit");
  }

  async _prepareContext() {
    const achievement = (this.achievementId && getAchievement(this.achievementId)) ?? {
      name: "",
      description: "",
      img: DEFAULT_IMG,
      hidden: false
    };
    return {
      id: this.id,
      achievement,
      imgValue: achievement.img === DEFAULT_IMG ? "" : achievement.img,
      isNew: this.isNew,
      nameMax: NAME_MAX,
      descriptionMax: DESCRIPTION_MAX
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const input = this.element.querySelector("[name=img]");
    const preview = this.element.querySelector(".au-preview-badge img");
    if (!input || !preview) return;
    const update = () => {
      preview.src = input.value.trim() || DEFAULT_IMG;
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    preview.addEventListener("error", () => {
      if (preview.getAttribute("src") !== DEFAULT_IMG) preview.src = DEFAULT_IMG;
    });
  }

  /* ---------------------------------------- */

  static #onBrowse() {
    const input = this.element.querySelector("[name=img]");
    const FilePicker = filePickerClass();
    const picker = new FilePicker({
      type: "image",
      current: input.value || "",
      callback: (path) => {
        input.value = path;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    picker.render(true);
  }

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    if (!String(data.name ?? "").trim()) {
      ui.notifications.warn(game.i18n.localize("ACHIEVEMENTS.Editor.NameRequired"));
      return;
    }
    try {
      const saved = this.isNew
        ? await createAchievement(data)
        : await updateAchievement(this.achievementId, data);
      ui.notifications.info(
        game.i18n.format(this.isNew ? "ACHIEVEMENTS.Editor.Created" : "ACHIEVEMENTS.Editor.Saved", { name: saved.name })
      );
      await this.close();
    } catch (err) {
      console.error(`${MODULE_ID} |`, err);
      ui.notifications.error(err.message);
    }
  }
}
