import { TaleSaleJournalSheet } from "./base.js";

const LAYOUT_ROOT = "/modules/ts-pf2e-utility/layout/SDoS";

export class SDoSJournalSheet extends TaleSaleJournalSheet {
  static get journalSheetConfig() {
    return {
      className: "SDoS",
      variablePrefix: "sdos",
      titleTextClass: "sdos-window-title-text",
      frameImage: `${LAYOUT_ROOT}/border.png`,
      sidebarImage: `${LAYOUT_ROOT}/back.png`,
      textColor: "#1f1a17",
      h1Color: "#b51827",
      h2Color: "#b51827",
      h3Color: "#1f1a17",
      h4Color: "#1f1a17",
      traitColor: "rgb(37, 63, 133)",
      gmVisibilityBackground: "#dcdce3",
      blockquoteTextColor: "rgb(37, 63, 133)",
      blockquoteBackgroundColor: "#f8f8eb",
      blockquoteRuleColor: "rgb(37, 63, 133)",
      sceneEyeTextColor: "#1f1a17",
      sidebarTextColor: "#000000",
      sidebarActiveTextColor: "#000000",
      sidebarCategoryColor: "#4f4337",
      themeVariables: {
        "header-image": `url('${LAYOUT_ROOT}/back.png')`,
        "title-image": `url('${LAYOUT_ROOT}/back.png')`,
        "insite-image": `url('${LAYOUT_ROOT}/back1.png')`,
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
