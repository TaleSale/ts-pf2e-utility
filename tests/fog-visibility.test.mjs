import assert from "node:assert/strict";
import test from "node:test";

import {
  actorHasFogVision,
  tokenOverlapsFog,
} from "../scripts/utility/fog-visibility.js";

const fog = [[
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 300 },
  { x: 100, y: 300 },
]];

function actor(slugs = []) {
  return {
    type: "character",
    isOfType: (type) => type === "creature",
    items: slugs.map((slug) => ({ slug })),
    rollOptions: { all: {} },
    getRollOptions: () => [],
  };
}

function token(x, y, tokenActor = actor()) {
  const document = {
    actor: tokenActor,
    level: "ground",
    mechanicalBounds: { x, y, width: 100, height: 100 },
    parent: { id: "scene" },
  };
  return { actor: tokenActor, document };
}

test("fog vision abilities are recognized by their PF2e slugs", () => {
  assert.equal(actorHasFogVision(actor(["smoke-sight"])), true);
  assert.equal(actorHasFogVision(actor(["smoke-vision"])), true);
  assert.equal(actorHasFogVision(actor(["cloud-gazer"])), true);
  assert.equal(actorHasFogVision(actor(["darkvision"])), false);
});

test("a creature is inside fog only when its center is inside it", () => {
  assert.equal(tokenOverlapsFog(token(150, 150), fog), true);
  assert.equal(tokenOverlapsFog(token(50, 150), fog), false);
  assert.equal(tokenOverlapsFog(token(-101, -101), fog), false);
});
