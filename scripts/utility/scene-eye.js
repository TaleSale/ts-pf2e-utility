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

function getSceneThumbnail(scene) {
  const candidates = [
    scene?.thumb,
    scene?.thumbnail,
    scene?.background?.src,
    scene?.foreground,
    scene?.foreground?.src,
    scene?.img,
  ];

  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim()) ?? "";
}

function getSceneLabel(scene, link) {
  return scene?.name || link?.textContent?.trim() || "";
}

function createEyeButton(sceneId, thumbnail = "", label = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsu-scene-eye-button";
  button.title = t(`${I18N_ROOT}.ButtonTitle`, "View scene as GM");
  button.setAttribute("aria-label", button.title);

  if (thumbnail) {
    const image = document.createElement("img");
    image.className = "tsu-scene-eye-thumbnail";
    image.src = thumbnail;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";

    const caption = document.createElement("span");
    caption.className = "tsu-scene-eye-caption";

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-map";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "tsu-scene-eye-caption-text";
    text.textContent = label;

    caption.append(icon, text);
    button.append(image, caption);
  } else {
    button.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
  }

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

    const scene = game.scenes?.get(sceneId);
    const thumbnail = getSceneThumbnail(scene);
    const label = getSceneLabel(scene, link);

    const wrapper = document.createElement("span");
    wrapper.className = "tsu-scene-eye";
    if (thumbnail) wrapper.classList.add("tsu-scene-eye-has-thumbnail");

    link.classList.add("tsu-scene-eye-link");
    link.replaceWith(wrapper);
    wrapper.append(link, createEyeButton(sceneId, thumbnail, label));
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
