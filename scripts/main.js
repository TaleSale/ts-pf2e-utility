import { initializeModuleRuntime, registerGame } from "./core.js";
import { createDevilsPinGameDefinition } from "./games/devils-pin.js";
import { createKubokerGameDefinition } from "./games/kuboker.js";
import { registerModularLocalization } from "./localization.js";

registerModularLocalization();
registerGame(createDevilsPinGameDefinition());
registerGame(createKubokerGameDefinition());
initializeModuleRuntime();
