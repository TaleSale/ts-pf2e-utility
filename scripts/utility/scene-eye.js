import { MODULE_ID } from "../core.js";

const SETTING_ENABLE = "enableSceneEye";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: "Enable Scene Eye",
    hint: "Adds a quick-view eye button next to scene links in chat and journal entries (GM only).",
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
  const directId = link.dataset.id?.trim();
  if (directId) return directId;

  const uuid = link.dataset.uuid?.trim();
  if (!uuid) return null;

  const parts = uuid.split(".");
  if (parts[0] !== "Scene") return null;
  return parts[1] || null;
}

function createEyeButton(sceneId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsu-scene-eye-button";
  button.title = "View scene as GM";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const scene = game.scenes?.get(sceneId);
    if (!scene) {
      ui.notifications?.warn("Scene was not found.");
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
