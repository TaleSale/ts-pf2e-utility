import { MODULE_ID, escapeHtml } from "../../core.js";

const SETTING_ENABLE_IMAGE_SECTIONS = "enableJournalImageSections";

function isImageSectionsEnabled() {
  return Boolean(game.settings.get(MODULE_ID, SETTING_ENABLE_IMAGE_SECTIONS));
}

function appendStyleField(form) {
  if (!(form instanceof HTMLFormElement)) return null;
  if (form.elements.imageSectionClass) return form.elements.imageSectionClass;
  const documentRef = form.ownerDocument;
  if (!documentRef) return null;

  const sourceGroup = form.querySelector("[name='src']")?.closest(".form-group");
  if (!(sourceGroup instanceof HTMLElement)) return null;

  const formGroup = documentRef.createElement("div");
  formGroup.className = "form-group";

  const label = documentRef.createElement("label");
  label.htmlFor = "tsu-journal-image-section-class";
  label.textContent = game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.ImageSections.StyleLabel");

  const fields = documentRef.createElement("div");
  fields.className = "form-fields";

  const input = documentRef.createElement("input");
  input.type = "text";
  input.id = "tsu-journal-image-section-class";
  input.name = "imageSectionClass";
  input.placeholder = game.i18n.localize("TS_PF2E_UTILITY.Settings.Journals.ImageSections.StylePlaceholder");

  fields.append(input);
  formGroup.append(label, fields);
  sourceGroup.after(formGroup);
  return input;
}

function buildWrappedImageHtml(form) {
  const src = String(form.elements.src?.value ?? "").trim();
  if (!src) return "";

  const className = String(form.elements.imageSectionClass?.value ?? "").trim();
  if (!className) return "";

  const attributes = [`src="${escapeHtml(src)}"`];
  const alt = String(form.elements.alt?.value ?? "").trim();
  const width = Number.parseInt(form.elements.width?.value ?? "", 10);
  const height = Number.parseInt(form.elements.height?.value ?? "", 10);

  if (alt) attributes.push(`alt="${escapeHtml(alt)}"`);
  if (Number.isFinite(width) && width > 0) attributes.push(`width="${width}"`);
  if (Number.isFinite(height) && height > 0) attributes.push(`height="${height}"`);

  return `<section class="${escapeHtml(className)}"><img ${attributes.join(" ")}></section>`;
}

function patchProseMirrorImagePrompt() {
  const menuClass = globalThis.ProseMirror?.ProseMirrorMenu;
  if (!menuClass || menuClass.prototype._tsuImageSectionsPatched) return;

  const original = menuClass.prototype._insertImagePrompt;

  menuClass.prototype._insertImagePrompt = async function patchedInsertImagePrompt() {
    if (!isImageSectionsEnabled()) {
      return original.call(this);
    }

    const state = this.view.state;
    const { $from, empty } = state.selection;
    const { figcaption, figure, image } = this.schema.nodes;
    const data = { src: "", alt: "", width: "", height: "" };
    let selected;
    if (!empty) {
      selected = state.doc.nodeAt($from.pos);
      Object.assign(data, selected?.attrs ?? {});
    }

    const { FilePathField, NumberField, StringField } = foundry.data.fields;
    const context = {
      alt: {
        field: new StringField({ label: "EDITOR.ImageAlt" }, { name: "alt" }),
        value: data.alt,
      },
      height: {
        field: new NumberField({ min: 0, integer: true }, { name: "height" }),
        value: data.height,
      },
      src: {
        field: new FilePathField({
          required: true, categories: ["IMAGE"], base64: true, label: "EDITOR.ImageSource",
        }, { name: "src" }),
        value: data.src,
      },
      width: {
        field: new NumberField({ min: 0, integer: true }, { name: "width" }),
        value: data.width,
      },
    };

    if (selected?.type !== this.schema.nodes.image) {
      context.caption = {
        field: new StringField({ label: "EDITOR.ImageCaption" }, { name: "caption" }),
        value: data.caption,
      };
    }

    const dialog = await this._showDialog("image", "templates/journal/insert-image.hbs", { data: context });
    const form = dialog.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;

    appendStyleField(form);

    form.elements.save.addEventListener("click", () => {
      const src = String(form.elements.src?.value ?? "").trim();
      if (!src) return;

      const wrappedHtml = buildWrappedImageHtml(form);
      if (wrappedHtml) {
        const parsed = foundry.prosemirror.dom.parseString(wrappedHtml, this.view.state.schema);
        const tr = this.view.state.tr.replaceSelection(parsed.slice(0)).scrollIntoView();
        this.view.dispatch(tr);
        return;
      }

      let node;
      const imageNode = node = image.create({
        src,
        alt: form.elements.alt.value,
        width: form.elements.width.value,
        height: form.elements.height.value,
      });
      if (form.elements.caption?.value) {
        node = figure.create(null, [
          imageNode,
          figcaption.create(null, this.schema.text(form.elements.caption.value)),
        ]);
      }
      this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    });
  };

  menuClass.prototype._tsuImageSectionsPatched = true;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE_IMAGE_SECTIONS, {
    name: "TS_PF2E_UTILITY.Settings.Journals.ImageSections.Name",
    hint: "TS_PF2E_UTILITY.Settings.Journals.ImageSections.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });
});

Hooks.once("ready", () => {
  patchProseMirrorImagePrompt();
});
