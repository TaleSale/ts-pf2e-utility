import { createBeerFuriousGameDefinition } from "./games/beer-furious.js";
import { createBugRaceGameDefinition } from "./games/bug-race.js";
import { initializeModuleRuntime, registerGame } from "./core.js";
import { createDevilsPinGameDefinition } from "./games/devils-pin.js";
import { createDuelCombatGameDefinition } from "./games/duel-combat.js";
import { createKubokerGameDefinition } from "./games/kuboker.js";
import { registerModularLocalization } from "./localization.js";
import "./utility/read.js";
import "./utility/scene-eye.js";
import "./utility/thumb.js";
import "./utility/spell-at-will.js";

registerModularLocalization();
registerGame(createBeerFuriousGameDefinition());
registerGame(createBugRaceGameDefinition());
registerGame(createDevilsPinGameDefinition());
registerGame(createDuelCombatGameDefinition());
registerGame(createKubokerGameDefinition());
initializeModuleRuntime();
