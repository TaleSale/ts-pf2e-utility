import { MODULE_ID, i18nKey, t } from "../core.js";

const SETTING_ENABLE = "enableSceneEye";
const I18N_ROOT = "Settings.SceneEye";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey(`${I18N_ROOT}.Name`),
    hint: i18nKey(`${I18N_ROOT}.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });
});

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function getSceneIdFromLink(link) {
  const directType = link.dataset.type?.trim();
  const directId = link.dataset.id?.trim();
  if (directType === "Scene" && directId) return directId;

  const uuid = link.dataset.uuid?.trim();
  if (!uuid) return null;

  const parts = uuid.split(".");
  if (parts.length !== 2 || parts[0] !== "Scene") return null;
  return parts[1] || null;
}

function createEyeButton(sceneId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsu-scene-eye-button";
  button.title = t(`${I18N_ROOT}.ButtonTitle`, "View scene as GM");
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const scene = game.scenes?.get(sceneId);
    if (!scene) {
      ui.notifications?.warn(t(`${I18N_ROOT}.MissingScene`, "Scene was not found."));
      return;
    }

    await scene.view();
  });
  return button;
}

function processSceneLinks(root) {
  const element = getElement(root);
  if (!element || !game.user?.isGM) return;

  const links = element.querySelectorAll('a.content-link[data-type="Scene"], a.content-link[data-uuid^="Scene."]');
  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    if (link.closest(".tsu-scene-eye")) continue;

    const sceneId = getSceneIdFromLink(link);
    if (!sceneId) continue;

    const wrapper = document.createElement("span");
    wrapper.className = "tsu-scene-eye";

    link.classList.add("tsu-scene-eye-link");
    link.replaceWith(wrapper);
    wrapper.append(link, createEyeButton(sceneId));
  }
}

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;

  processSceneLinks(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        processSceneLinks(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
