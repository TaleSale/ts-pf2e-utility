const BaseJournalEntrySheet = foundry.applications.sheets.journal.JournalEntrySheet;

function mergeClasses(baseClasses, extraClasses) {
  return Array.from(new Set([...(baseClasses ?? []), ...extraClasses]));
}

function setStyleVariables(element, prefix, variables) {
  for (const [key, value] of Object.entries(variables ?? {})) {
    element.style.setProperty(`--${prefix}-${key}`, value);
  }
}

function setThemeVariables(element, variables) {
  for (const [key, value] of Object.entries(variables ?? {})) {
    element.style.setProperty(`--tsj-${key}`, value, "important");
  }
}

function clearPreviousThemeClasses(root, activeClassName) {
  for (const className of ["AoA", "CC", "HR", "SoG", "SDoS"]) {
    if (className !== activeClassName) root.classList.remove(className);
  }
}

function wrapWindowTitle(root, titleTextClass) {
  const titleElement = root.querySelector(":scope > .window-header .window-title");
  if (!(titleElement instanceof HTMLElement)) return;
  if (titleElement.querySelector(`:scope > .${titleTextClass}`)) return;

  const titleTextWrapper = document.createElement("span");
  titleTextWrapper.className = titleTextClass;

  for (const node of Array.from(titleElement.childNodes)) {
    titleTextWrapper.append(node);
  }

  titleElement.append(titleTextWrapper);
}

function moveResizeHandle(root, windowContent) {
  const resizeHandle = root.querySelector(":scope > .window-resize-handle, :scope > .window-resizable-handle");
  if (resizeHandle instanceof HTMLElement && resizeHandle.parentElement !== windowContent) {
    windowContent.append(resizeHandle);
  }
}

export class TaleSaleJournalSheet extends BaseJournalEntrySheet {
  static get journalSheetConfig() {
    return null;
  }

  static get DEFAULT_OPTIONS() {
    const className = this.journalSheetConfig?.className;

    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      classes: className
        ? mergeClasses(super.DEFAULT_OPTIONS.classes, [className])
        : [...(super.DEFAULT_OPTIONS.classes ?? [])],
    }, {
      inplace: false,
      insertKeys: true,
      insertValues: true,
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    if (!(root instanceof HTMLElement)) return;

    const config = this.constructor.journalSheetConfig;
    if (!config) return;

    const {
      className,
      variablePrefix,
      titleTextClass,
      frameImage,
      sidebarImage,
      sidebarBackgroundSize = "cover",
      contentBackground = "#f8f8eb",
      textColor = "#1f1a17",
      h1Color = "#b51827",
      h2Color = "#5f040d",
      h3Color = "#c6491a",
      h4Color = "#2b231d",
      traitColor = textColor,
      gmVisibilityBackground = "#dcdce3",
      blockquoteTextColor = "var(--tsj-h3-color)",
      blockquoteBackgroundColor = "#f8f8eb",
      blockquoteRuleColor = "var(--tsj-h3-color)",
      sceneEyeTextColor = textColor,
      sidebarTextColor = textColor,
      sidebarActiveTextColor = "var(--tsj-h2-color)",
      sidebarCategoryColor = "var(--tsj-h1-color)",
      cssVariables = {},
      themeVariables = {},
    } = config;
    const varRef = (name) => `var(--${variablePrefix}-${name})`;
    const applyJournalShellPass = () => {
      clearPreviousThemeClasses(root, className);
      root.classList.add("ts-journal-sheet", className);
      root.style.background = "transparent";
      root.style.overflow = "visible";
      root.style.isolation = "isolate";
      setStyleVariables(root, variablePrefix, {
        "heading-indent": "var(--tsj-heading-indent)",
        ...cssVariables,
      });
      setThemeVariables(root, {
        ...cssVariables,
        "text-color": textColor,
        "h1-color": h1Color,
        "h2-color": h2Color,
        "h3-color": h3Color,
        "h4-color": h4Color,
        "trait-color": traitColor,
        "visibility-gm-bg": gmVisibilityBackground,
        "blockquote-text-color": blockquoteTextColor,
        "blockquote-bg": blockquoteBackgroundColor,
        "blockquote-rule-color": blockquoteRuleColor,
        "scene-eye-text-color": sceneEyeTextColor,
        "frame-image": `url('${frameImage}')`,
        "sidebar-image": `url('${sidebarImage}')`,
        ...themeVariables,
        "sidebar-text": sidebarTextColor,
        "sidebar-text-muted": sidebarTextColor,
        "sidebar-text-active": sidebarActiveTextColor,
        "sidebar-category-color": sidebarCategoryColor,
      });
      wrapWindowTitle(root, titleTextClass);

      const windowContent = root.querySelector(".window-content");
      if (windowContent instanceof HTMLElement) {
        windowContent.style.background = "transparent";
        windowContent.style.border = "none";
        windowContent.style.boxShadow = "none";
        windowContent.style.isolation = "isolate";
        windowContent.style.position = "relative";
        windowContent.style.overflow = "visible";

        let frameElement = windowContent.querySelector(":scope > .ts-journal-content-frame");
        if (!(frameElement instanceof HTMLElement)) {
          frameElement = document.createElement("div");
          frameElement.className = "ts-journal-content-frame";
          windowContent.prepend(frameElement);
        }

        frameElement.style.position = "absolute";
        frameElement.style.top = varRef("frame-top");
        frameElement.style.right = varRef("frame-right");
        frameElement.style.bottom = varRef("frame-bottom");
        frameElement.style.left = varRef("frame-left");
        frameElement.style.zIndex = "-1";
        frameElement.style.pointerEvents = "none";
        frameElement.style.background = "var(--tsj-frame-image) center center / 100% 100% no-repeat";

        moveResizeHandle(root, windowContent);
      }

      const navigationElement = root.querySelector(".journal-sidebar");
      if (navigationElement instanceof HTMLElement) {
        navigationElement.style.position = "relative";
        navigationElement.style.zIndex = "1";
        navigationElement.style.backgroundSize = sidebarBackgroundSize;
      }

      const contentElement = root.querySelector(".journal-entry-content");
      if (contentElement instanceof HTMLElement) {
        contentElement.style.background = contentBackground;
        contentElement.style.backgroundClip = "content-box";
        contentElement.style.border = "none";
        contentElement.style.boxSizing = "border-box";
        contentElement.style.marginRight = "0";
        contentElement.style.paddingRight = varRef("frame-outset-right");
        contentElement.style.position = "relative";
        contentElement.style.overflowX = "hidden";
        contentElement.style.overflowY = "scroll";
        contentElement.style.zIndex = "1";
      }

      const pagesElement = root.querySelector(".journal-entry-pages.scrollable");
      if (pagesElement instanceof HTMLElement) {
        pagesElement.style.margin = "0";
        pagesElement.style.padding = "0";
        pagesElement.style.marginRight = "0";
        pagesElement.style.paddingRight = "0";
        pagesElement.style.width = "100%";
        pagesElement.style.overflow = "visible";
        pagesElement.style.position = "relative";
        pagesElement.style.zIndex = "2";
      }

      const journalHeaderElement = root.querySelector(".journal-header");
      if (journalHeaderElement instanceof HTMLElement) {
        journalHeaderElement.style.display = "none";
      }
    };

    const applyJournalContentPass = () => {
      const insiteImage = String(themeVariables["insite-image"] ?? "").trim();

      for (const pageView of root.querySelectorAll(".journal-entry-page > [id$='-view'], .journal-entry-page > [id$='-edit']")) {
        if (!(pageView instanceof HTMLElement)) continue;
        pageView.style.margin = "0";
        pageView.style.padding = "0";
        pageView.style.width = "100%";
      }

      for (const pageHeader of root.querySelectorAll(".journal-page-header")) {
        if (!(pageHeader instanceof HTMLElement)) continue;
        pageHeader.style.margin = "0 0 12px";
        pageHeader.style.padding = "0";
        pageHeader.style.width = "100%";
      }

      for (const heading of root.querySelectorAll(".journal-page-header > h1, .journal-page-header > h2, .journal-page-header > h3, .journal-page-content > h1, .journal-entry-page > h1")) {
        if (!(heading instanceof HTMLElement)) continue;
        heading.style.boxSizing = "border-box";
        heading.style.display = "block";
        heading.style.margin = "0";
        heading.style.width = "100%";

        if (heading.parentElement?.matches(".journal-page-header")) {
          heading.style.paddingLeft = "10px";
          heading.style.paddingRight = "10px";
          heading.style.margin =
            `0 calc((${varRef("frame-outset-right")} - ${varRef("scrollbar-width")} + ${varRef("header-right-adjust")}) * -1) 0 calc(${varRef("frame-outset-left")} * -1)`;
          heading.style.width =
            `calc(100% + ${varRef("frame-outset-left")} + (${varRef("frame-outset-right")} - ${varRef("scrollbar-width")} + ${varRef("header-right-adjust")}))`;
        } else if (heading.parentElement?.matches(".journal-page-content")) {
          heading.style.paddingLeft = `calc(${varRef("page-content-pad-left")} + ${varRef("heading-indent")})`;
          heading.style.paddingRight = "10px";
        } else {
          heading.style.paddingLeft = varRef("heading-indent");
          heading.style.paddingRight = "10px";
        }
      }

      const styledInsetSections = new Set();

      for (const pageContent of root.querySelectorAll(".journal-page-content")) {
        if (!(pageContent instanceof HTMLElement)) continue;

        pageContent.style.opacity = "1";
        pageContent.style.filter = "none";
        pageContent.style.mixBlendMode = "normal";
        pageContent.style.color = "var(--tsj-text-color)";
        pageContent.style.removeProperty("-webkit-text-fill-color");
        pageContent.style.paddingLeft = varRef("page-content-pad-left");
        pageContent.style.paddingRight = varRef("page-content-pad-right");

        const contentHeading = pageContent.querySelector(":scope > h1");
        if (contentHeading instanceof HTMLElement) {
          contentHeading.style.margin =
            `0 calc(${varRef("frame-outset-right")} * -1) 12px calc(${varRef("page-content-pad-left")} * -1)`;
          contentHeading.style.width =
            `calc(100% + ${varRef("page-content-pad-left")} + ${varRef("frame-outset-right")})`;
        }

        for (const insetSection of pageContent.querySelectorAll("section.insite")) {
          if (!(insetSection instanceof HTMLElement)) continue;
          styledInsetSections.add(insetSection);
          insetSection.style.boxSizing = "border-box";
          insetSection.style.margin =
            `0 calc(${varRef("frame-outset-right")} * -1) 0 calc(${varRef("page-content-pad-left")} * -1)`;
          insetSection.style.width =
            `calc(100% + ${varRef("page-content-pad-left")} + ${varRef("frame-outset-right")})`;
          insetSection.style.paddingRight = varRef("frame-outset-right");
          if (insiteImage) {
            insetSection.style.setProperty("--tsj-insite-image", insiteImage);
            insetSection.style.background = `${insiteImage} no-repeat center center`;
            insetSection.style.backgroundSize = "cover";
          } else {
            insetSection.style.removeProperty("--tsj-insite-image");
            insetSection.style.removeProperty("background");
            insetSection.style.removeProperty("background-size");
          }
        }
      }

      for (const insetSection of root.querySelectorAll(".journal-entry-page section.insite")) {
        if (!(insetSection instanceof HTMLElement) || styledInsetSections.has(insetSection)) continue;
        if (insiteImage) {
          insetSection.style.setProperty("--tsj-insite-image", insiteImage);
          insetSection.style.background = `${insiteImage} no-repeat center center`;
          insetSection.style.backgroundSize = "cover";
        } else {
          insetSection.style.removeProperty("--tsj-insite-image");
          insetSection.style.removeProperty("background");
          insetSection.style.removeProperty("background-size");
        }
      }

      for (const heading of root.querySelectorAll(".journal-page-header > h1, .journal-page-header > h2, .journal-page-header > h3, .journal-page-content > h1, .journal-entry-page > h1, .journal-page-content h2, .journal-page-content h3, .journal-page-content h4, .journal-page-content h5, .journal-entry-page h2, .journal-entry-page h3, .journal-entry-page h4, .journal-entry-page h5")) {
        if (!(heading instanceof HTMLElement)) continue;

        if (heading.matches(".journal-page-header > h1, .journal-page-header > h2, .journal-page-header > h3, .journal-page-content > h1, .journal-entry-page > h1")) {
          heading.style.color = "var(--tsj-h1-color)";
          heading.style.webkitTextFillColor = "var(--tsj-h1-color)";
        } else if (heading.matches("h2")) {
          heading.style.color = "var(--tsj-h2-color)";
          heading.style.webkitTextFillColor = "var(--tsj-h2-color)";
        } else if (heading.matches("h3")) {
          heading.style.color = "var(--tsj-h3-color)";
          heading.style.webkitTextFillColor = "var(--tsj-h3-color)";
        } else {
          heading.style.color = "var(--tsj-h4-color)";
          heading.style.webkitTextFillColor = "var(--tsj-h4-color)";
        }
      }
    };

    applyJournalShellPass();
    applyJournalContentPass();
  }

  async close(options) {
    return super.close(options);
  }
}
