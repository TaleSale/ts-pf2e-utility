import { TaleSaleJournalSheet } from "./base.js";

const LAYOUT_ROOT = "/modules/ts-pf2e-utility/layout/HR";

export class HRJournalSheet extends TaleSaleJournalSheet {
  static get journalSheetConfig() {
    return {
      className: "HR",
      variablePrefix: "hr",
      titleTextClass: "hr-window-title-text",
      frameImage: `${LAYOUT_ROOT}/border1.png`,
      sidebarImage: `${LAYOUT_ROOT}/back2.jpg`,
      textColor: "#1f1a17",
      h1Color: "#f3f3f3",
      h2Color: "#1f1a17",
      h3Color: "#1f1a17",
      h4Color: "#1f1a17",
      traitColor: "rgb(2, 48, 73)",
      gmVisibilityBackground: "#dcdce3",
      blockquoteTextColor: "rgb(2, 48, 73)",
      blockquoteBackgroundColor: "#f8f8eb",
      blockquoteRuleColor: "rgb(2, 48, 73)",
      sceneEyeTextColor: "#1f1a17",
      sidebarTextColor: "#f3f3f3",
      sidebarActiveTextColor: "#ffffff",
      sidebarCategoryColor: "#f3f3f3",
      themeVariables: {
        "header-image": `url('${LAYOUT_ROOT}/back2.jpg')`,
        "title-image": `url('${LAYOUT_ROOT}/back2.jpg')`,
        "insite-image": `url('${LAYOUT_ROOT}/back1.png')`,
      },
      cssVariables: {
        "page-content-pad-left": "10px",
        "page-content-pad-right": "6px",
        "scrollbar-width": "8px",
        "header-right-adjust": "1px",
        "frame-top": "-36px",
        "frame-right": "-15px",
        "frame-bottom": "-10px",
        "frame-left": "-9px",
        "frame-outset-top": "36px",
        "frame-outset-right": "15px",
        "frame-outset-bottom": "15px",
        "frame-outset-left": "15px",
        "resize-size": "24px",
      },
    };
  }
}
