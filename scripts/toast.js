/**
 * The "Achievement unlocked!" popup: a fixed-position banner that slides in,
 * shines, and slides out. Not a window — it can't be dragged or lose focus.
 * Several unlocks in a row queue up and play one after another.
 */

import { MODULE_ID, DEFAULT_SOUND } from "./store.js";
import { renderTemplate } from "./compat.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/toast.hbs`;
const GAP_MS = 600;

const queue = [];
let showing = false;

/**
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.description
 * @param {string} payload.img
 * @param {{name: string, character: string|null}[]} payload.recipients
 */
export function showToast(payload) {
  queue.push(payload);
  if (!showing) void next();
}

async function next() {
  const payload = queue.shift();
  if (!payload) {
    showing = false;
    return;
  }
  showing = true;
  try {
    await display(payload);
  } catch (err) {
    console.error(`${MODULE_ID} | toast failed`, err);
  }
  setTimeout(next, GAP_MS);
}

function display(payload) {
  return new Promise(async (resolve) => {
    const duration = Math.max(2, Number(game.settings.get(MODULE_ID, "toastDuration")) || 6) * 1000;
    const position = game.settings.get(MODULE_ID, "toastPosition");
    const sparkle = game.settings.get(MODULE_ID, "sparkle");

    const html = await renderTemplate(TEMPLATE, {
      ...payload,
      recipientsText: recipientsText(payload.recipients),
      header: game.i18n.localize("ACHIEVEMENTS.Toast.Header")
    });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const el = wrapper.firstElementChild;
    el.classList.add(`au-pos-${position === "bottomRight" ? "bottom-right" : "top"}`);
    if (sparkle) el.classList.add("au-sparkle");
    document.body.appendChild(el);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.remove("au-show");
      el.classList.add("au-leave");
      const remove = () => {
        el.remove();
        resolve();
      };
      el.addEventListener("transitionend", remove, { once: true });
      setTimeout(remove, 900); // safety net if transitionend never fires
    };

    el.addEventListener("click", finish);
    playSound();

    // Two frames so the initial (off-screen) state is painted before we animate in.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("au-show")));
    setTimeout(finish, duration);
  });
}

function recipientsText(recipients = []) {
  const labels = recipients.map((r) => (r.character ? `${r.name} (${r.character})` : r.name));
  if (labels.length <= 3) return labels.join(", ");
  return game.i18n.format("ACHIEVEMENTS.Toast.More", {
    names: labels.slice(0, 2).join(", "),
    count: labels.length - 2
  });
}

function playSound() {
  if (!game.settings.get(MODULE_ID, "sound")) return;
  const src = game.settings.get(MODULE_ID, "soundFile") || DEFAULT_SOUND;
  const volume = game.settings.get("core", "globalInterfaceVolume") ?? 0.5;
  try {
    foundry.audio.AudioHelper.play({ src, volume, autoplay: true, loop: false }, false);
  } catch (err) {
    console.warn(`${MODULE_ID} | could not play unlock sound`, err);
  }
}
