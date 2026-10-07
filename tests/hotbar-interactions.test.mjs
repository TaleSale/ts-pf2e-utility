import assert from "node:assert/strict";
import test from "node:test";
import { positionInteractionButtons } from "../scripts/utility/hotbar-interactions.js";

test("music and light buttons share slot sizing and stable sequential placement", () => {
  class Element {
    constructor(id, left = 0, width = 50) {
      this.id = id; this.style = {}; this.dataset = {};
      this.offsetWidth = width; this.offsetHeight = 50; this.offsetTop = 4; this.left = left;
    }
    get offsetLeft() { return parseFloat(this.style.left ?? this.left); }
    getBoundingClientRect() { return { left: this.offsetLeft, top: 4, width: 50, height: 50 }; }
    append(child) { child.parentElement = this; child.offsetParent = this; }
  }
  globalThis.HTMLElement = Element;
  const action = new Element("action-bar"), hotbar = new Element("hotbar");
  const slot = new Element("slot10", 450); slot.dataset.slot = "10"; action.append(slot);
  const buttons = ["tsu-light-switch", "tsu-light-holder-action", "tsu-musical-instrument"].map((id) => new Element(id));
  const items = [slot, ...buttons];
  hotbar.querySelector = (selector) => selector === "#action-bar" ? action : null;
  hotbar.querySelectorAll = (selector) => selector === "[data-slot]" ? [slot] : items;
  globalThis.document = { getElementById: (id) => id === "hotbar" ? hotbar : items.find((item) => item.id === id), querySelector: () => action };
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  globalThis.game = { user: { isGM: false } };
  for (let repeat = 0; repeat < 3; repeat++) {
    positionInteractionButtons();
    assert.deepEqual(buttons.map((button) => button.style.left), ["514px", "568px", "622px"]);
    for (const button of buttons) {
      assert.equal(button.parentElement, action);
      assert.equal(button.style.top, "4px");
      assert.equal(button.style.width, "50px");
      assert.equal(button.style.height, "50px");
    }
  }
  items.splice(items.indexOf(buttons[0]), 2);
  positionInteractionButtons();
  assert.equal(buttons[2].style.left, "514px");
});
