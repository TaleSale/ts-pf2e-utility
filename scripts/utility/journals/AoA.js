import { TaleSaleJournalSheet } from "./base.js";

const LAYOUT_ROOT = "/modules/ts-pf2e-utility/layout/AoA";

export class AoAJournalSheet extends TaleSaleJournalSheet {
  static get journalSheetConfig() {
    return {
      className: "AoA",
      variablePrefix: "aoa",
      titleTextClass: "aoa-window-title-text",
      frameImage: `${LAYOUT_ROOT}/border.webp`,
      sidebarImage: `${LAYOUT_ROOT}/back.webp`,
      textColor: "#1f1a17",
      h1Color: "#b51827",
      h2Color: "#b51827",
      h3Color: "#b51827",
      h4Color: "#2b231d",
      traitColor: "#c6491a",
      gmVisibilityBackground: "#dcdce3",
      blockquoteTextColor: "#c6491a",
      blockquoteBackgroundColor: "#f8f8eb",
      blockquoteRuleColor: "#c6491a",
      sceneEyeTextColor: "#5f040d",
      sidebarTextColor: "#ffffff",
      sidebarActiveTextColor: "#b51827",
      sidebarCategoryColor: "#b51827",
      themeVariables: {
        "header-image": `url('${LAYOUT_ROOT}/back2.webp')`,
        "title-image": `url('${LAYOUT_ROOT}/back2.webp')`,
        "insite-image": `url('${LAYOUT_ROOT}/back3.webp')`,
      },
      cssVariables: {
        "page-content-pad-left": "10px",
        "page-content-pad-right": "6px",
        "scrollbar-width": "8px",
        "header-right-adjust": "1px",
        "frame-top": "-36px",
        "frame-right": "-15px",
        "frame-bottom": "-15px",
        "frame-left": "-15px",
        "frame-outset-top": "36px",
        "frame-outset-right": "15px",
        "frame-outset-bottom": "15px",
        "frame-outset-left": "15px",
        "resize-size": "24px",
      },
    };
  }
}
