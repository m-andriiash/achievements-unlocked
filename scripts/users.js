import { MODULE_ID } from "./store.js";

/** Display info for a user, as shown on popups, chat cards and lists. */
export function describeUser(user) {
  const showCharacter = game.settings.get(MODULE_ID, "showCharacterName");
  return {
    id: user.id,
    name: user.name,
    character: showCharacter && user.character ? user.character.name : null,
    color: String(user.color ?? "#999999"),
    avatar: user.avatar || "icons/svg/mystery-man.svg",
    active: !!user.active,
    isGM: user.isGM
  };
}

/** Non-GM users, active first, then by name. */
export function playerUsers() {
  return game.users
    .filter((u) => !u.isGM)
    .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1));
}
