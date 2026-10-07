const INTERACTION_BUTTON_IDS = ["tsu-light-switch", "tsu-light-holder-action", "tsu-musical-instrument"];
const REBELLION_SLOT_ID = "rebellion-extra-hotbar-slot-11";
let positionGeneration = 0;

function localBox(element, ancestor) {
  let left = 0;
  let top = 0;
  let current = element;
  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent;
  }
  if (current === ancestor) return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };

  const elementRect = element.getBoundingClientRect();
  const ancestorRect = ancestor.getBoundingClientRect();
  const scaleX = ancestorRect.width > 0 && ancestor.offsetWidth > 0
    ? ancestorRect.width / ancestor.offsetWidth
    : 1;
  const scaleY = ancestorRect.height > 0 && ancestor.offsetHeight > 0
    ? ancestorRect.height / ancestor.offsetHeight
    : 1;
  return {
    left: (elementRect.left - ancestorRect.left) / scaleX,
    top: (elementRect.top - ancestorRect.top) / scaleY,
    width: elementRect.width / scaleX,
    height: elementRect.height / scaleY,
  };
}

export function positionButton(button) {
  const hotbar = document.getElementById("hotbar");
  const actionBar = hotbar?.querySelector("#action-bar");
  if (!(hotbar instanceof HTMLElement) || !(actionBar instanceof HTMLElement)) return;

  if (button.parentElement !== actionBar) actionBar.append(button);
  actionBar.style.position ||= "relative";
  actionBar.style.overflow = "visible";

  const normalSlots = [...hotbar.querySelectorAll("[data-slot]")]
    .filter((slot) => slot.id !== REBELLION_SLOT_ID);
  const rebellionSlot = hotbar.querySelector(`#${REBELLION_SLOT_ID}`);
  const anchor = rebellionSlot
    ?? normalSlots.reduce((last, slot) => (
      Number(slot.dataset.slot) > Number(last?.dataset.slot ?? 0) ? slot : last
    ), null)
    ?? [...actionBar.querySelectorAll("button, [role=button]")]
      .findLast((element) => element instanceof HTMLElement && element !== button && !INTERACTION_BUTTON_IDS.includes(element.id));
  if (!(anchor instanceof HTMLElement)) return;

  const box = localBox(anchor, actionBar);
  if (!box || box.width < 1 || box.height < 1) return;
  let left = box.left + box.width + 4;
  const controls = [...hotbar.querySelectorAll("button, li[data-slot], [role=button]")]
    .filter((element) => element instanceof HTMLElement && element !== button)
    .filter((element) => !INTERACTION_BUTTON_IDS.includes(element.id))
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
  for (const control of controls) {
    const controlBox = localBox(control, actionBar);
    if (controlBox) left = Math.max(left, controlBox.left + controlBox.width + 4);
  }
  button.style.left = `${Math.round(left + (game.user?.isGM ? 0 : 10))}px`;
  button.style.top = `${Math.round(box.top)}px`;
  button.style.width = `${Math.round(box.width)}px`;
  button.style.height = `${Math.round(box.height)}px`;
}

export function positionInteractionButtons() {
  const buttons = INTERACTION_BUTTON_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!buttons.length) return;
  positionButton(buttons[0]);
  const actionBar = document.querySelector("#hotbar #action-bar");
  let previous = buttons[0];
  for (const button of buttons.slice(1)) {
    positionButton(button);
    const box = actionBar ? localBox(previous, actionBar) : null;
    if (box) button.style.left = `${Math.round(box.left + box.width + 4)}px`;
    previous = button;
  }
}

export function scheduleInteractionPosition() {
  const generation = ++positionGeneration;
  const place = () => { if (generation === positionGeneration) positionInteractionButtons(); };
  requestAnimationFrame(place);
  for (const delay of [80, 250, 650, 1250, 2600]) window.setTimeout(place, delay);
}
