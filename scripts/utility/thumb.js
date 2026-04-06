import { MODULE_ID } from "../core.js";

const SETTING_ENABLE = "enableThumb";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: "Enable Scene Thumb",
    hint: "Adds a custom thumbnail field to the scene configuration form.",
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

function createThumbField(scene) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-group tsu-scene-thumb-field";

  const label = document.createElement("label");
  label.textContent = "Thumb Image";

  const formFields = document.createElement("div");
  formFields.className = "form-fields";

  const picker = document.createElement("file-picker");
  picker.name = "thumb";
  picker.type = "imagevideo";
  picker.setAttribute("value", scene?.thumb ?? "");

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Custom thumbnail used for this scene in the navigation and directory.";

  formFields.append(picker);
  wrapper.append(label, formFields, hint);
  return wrapper;
}

Hooks.on("renderSceneConfig", (app, element) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  const root = getElement(element);
  if (!root || root.querySelector(".tsu-scene-thumb-field")) return;

  const basicsTab = root.querySelector('.tab[data-tab="basics"]');
  if (!(basicsTab instanceof HTMLElement)) return;

  const thumbField = createThumbField(app.document);
  const foregroundField = basicsTab.querySelector('file-picker[name="foreground"]')?.closest(".form-group");

  if (foregroundField instanceof HTMLElement) {
    foregroundField.after(thumbField);
  } else {
    basicsTab.append(thumbField);
  }

  app.setPosition?.({ height: "auto" });
});
