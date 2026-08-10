import { TaleSaleJournalSheet } from "./base.js";

const LAYOUT_ROOT = "/modules/ts-pf2e-utility/layout/BoB";

export class BoBJournalSheet extends TaleSaleJournalSheet {
  static get journalSheetConfig() {
    return {
      className: "BoB",
      variablePrefix: "bob",
      titleTextClass: "bob-window-title-text",
      frameImage: `${LAYOUT_ROOT}/border-clean.png`,
      sidebarImage: `${LAYOUT_ROOT}/back.png`,
      sidebarBackgroundSize: "100% 100%",
      textColor: "#171d1d",
      h1Color: "#E5DCB5",
      h2Color: "#041349",
      h3Color: "#447066",
      h4Color: "#273f3e",
      traitColor: "#176b68",
      gmVisibilityBackground: "#d8d3bd",
      blockquoteTextColor: "#176b68",
      blockquoteBackgroundColor: "rgb(225 220 197 / 90%)",
      blockquoteRuleColor: "#14675C",
      sceneEyeTextColor: "#0f5654",
      sidebarTextColor: "#eee3b9",
      sidebarActiveTextColor: "#ffffff",
      sidebarCategoryColor: "#ffffff",
      themeVariables: {
        "header-image": `url('${LAYOUT_ROOT}/back2.png')`,
        "title-image": `url('${LAYOUT_ROOT}/back2.png')`,
        "insite-image": `url('${LAYOUT_ROOT}/back1.jpg')`,
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
