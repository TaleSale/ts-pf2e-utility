Hooks.once("init", () => {
    const STRIKE_DAMAGE_TABLE = {
        "-1": { low: "1d4", moderate: "1d4", high: "1d4+1", extreme: "1d6+1" },
        "0": { low: "1d4+1", moderate: "1d4+2", high: "1d6+2", extreme: "1d6+3" },
        "1": { low: "1d4+2", moderate: "1d6+2", high: "1d6+3", extreme: "1d8+4" },
        "2": { low: "1d6+3", moderate: "1d8+4", high: "1d10+4", extreme: "1d12+4" },
        "3": { low: "1d6+5", moderate: "1d8+6", high: "1d10+6", extreme: "1d12+8" },
        "4": { low: "2d4+4", moderate: "2d6+5", high: "2d8+5", extreme: "2d10+7" },
        "5": { low: "2d4+6", moderate: "2d6+6", high: "2d8+7", extreme: "2d12+7" },
        "6": { low: "2d4+7", moderate: "2d6+8", high: "2d8+9", extreme: "2d12+10" },
        "7": { low: "2d6+6", moderate: "2d8+8", high: "2d10+9", extreme: "2d12+12" },
        "8": { low: "2d6+8", moderate: "2d8+9", high: "2d10+11", extreme: "2d12+15" },
        "9": { low: "2d6+9", moderate: "2d8+11", high: "2d10+13", extreme: "2d12+17" },
        "10": { low: "2d6+10", moderate: "2d10+11", high: "2d12+13", extreme: "2d12+20" },
        "11": { low: "2d8+10", moderate: "2d10+12", high: "2d12+15", extreme: "2d12+22" },
        "12": { low: "3d6+10", moderate: "3d8+12", high: "3d10+14", extreme: "3d12+19" },
        "13": { low: "3d6+11", moderate: "3d8+14", high: "3d10+16", extreme: "3d12+21" },
        "14": { low: "3d6+13", moderate: "3d8+15", high: "3d10+18", extreme: "3d12+24" },
        "15": { low: "3d6+14", moderate: "3d10+14", high: "3d12+17", extreme: "3d12+26" },
        "16": { low: "3d6+15", moderate: "3d10+15", high: "3d12+18", extreme: "3d12+29" },
        "17": { low: "3d6+16", moderate: "3d10+16", high: "3d12+19", extreme: "3d12+31" },
        "18": { low: "3d6+17", moderate: "3d10+17", high: "3d12+20", extreme: "3d12+34" },
        "19": { low: "4d6+14", moderate: "4d8+17", high: "4d10+20", extreme: "4d12+29" },
        "20": { low: "4d6+15", moderate: "4d8+19", high: "4d10+22", extreme: "4d12+32" },
        "21": { low: "4d6+17", moderate: "4d8+20", high: "4d10+24", extreme: "4d12+34" },
        "22": { low: "4d6+18", moderate: "4d8+22", high: "4d10+26", extreme: "4d12+37" },
        "23": { low: "4d6+19", moderate: "4d10+20", high: "4d12+24", extreme: "4d12+39" },
        "24": { low: "4d6+21", moderate: "4d10+22", high: "4d12+26", extreme: "4d12+42" }
    };

    const AREA_DAMAGE_TABLE = {
        "-1": { unlimited: "1d4", limited: "1d6" },
        "0": { unlimited: "1d6", limited: "1d10" },
        "1": { unlimited: "2d4", limited: "2d6" },
        "2": { unlimited: "2d6", limited: "3d6" },
        "3": { unlimited: "2d8", limited: "4d6" },
        "4": { unlimited: "3d6", limited: "5d6" },
        "5": { unlimited: "2d10", limited: "6d6" },
        "6": { unlimited: "4d6", limited: "7d6" },
        "7": { unlimited: "4d6", limited: "8d6" },
        "8": { unlimited: "5d6", limited: "9d6" },
        "9": { unlimited: "5d6", limited: "10d6" },
        "10": { unlimited: "6d6", limited: "11d6" },
        "11": { unlimited: "6d6", limited: "12d6" },
        "12": { unlimited: "5d8", limited: "13d6" },
        "13": { unlimited: "7d6", limited: "14d6" },
        "14": { unlimited: "4d12", limited: "15d6" },
        "15": { unlimited: "6d8", limited: "16d6" },
        "16": { unlimited: "8d6", limited: "17d6" },
        "17": { unlimited: "8d6", limited: "18d6" },
        "18": { unlimited: "9d6", limited: "19d6" },
        "19": { unlimited: "7d8", limited: "20d6" },
        "20": { unlimited: "6d10", limited: "21d6" },
        "21": { unlimited: "10d6", limited: "22d6" },
        "22": { unlimited: "8d8", limited: "23d6" },
        "23": { unlimited: "11d6", limited: "24d6" },
        "24": { unlimited: "11d6", limited: "25d6" }
    };

    const TOKEN_RE = /(V[0-3](?:\((?:d)?\d+\))?(?:[+-]\d+)?|VAL|VAU)/gi;
    const TOKEN_TEST_RE = /(V[0-3]|VAL|VAU)/i;

    function getActorLevel(actor) {
        const level = actor?.system?.details?.level?.value ?? actor?.system?.details?.level ?? actor?.level ?? actor?.system?.level?.value;
        return Number.isFinite(Number(level)) ? Number(level) : null;
    }

    function adjustStrikeFormula(baseFormula, dieOverride, modDelta) {
        const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(baseFormula.trim());
        if (!match) return null;
        const diceNum = Number(match[1]);
        const dieSize = dieOverride ?? Number(match[2]);
        const baseMod = match[3] ? Number(match[3]) : 0;
        const newMod = baseMod + (modDelta ?? 0);
        const modPart = newMod === 0 ? "" : newMod > 0 ? `+${newMod}` : `${newMod}`;
        return `${diceNum}d${dieSize}${modPart}`;
    }

    function replaceDamageTokens(formula, level) {
        const strikeRow = STRIKE_DAMAGE_TABLE[level];
        const areaRow = AREA_DAMAGE_TABLE[level];
        let changed = false;

        const result = String(formula).replace(TOKEN_RE, (raw) => {
            const token = raw.toUpperCase();

            if (token === "VAL" && areaRow) {
                changed = true;
                return areaRow.limited;
            }
            if (token === "VAU" && areaRow) {
                changed = true;
                return areaRow.unlimited;
            }

            const strikeMatch = /^V([0-3])(?:\((?:D)?(\d+)\))?([+-]\d+)?$/i.exec(raw.trim());
            if (!strikeMatch || !strikeRow) return raw;

            const tierNum = Number(strikeMatch[1]);
            const dieOverride = strikeMatch[2] ? Number(strikeMatch[2]) : null;
            const modDelta = strikeMatch[3] ? Number(strikeMatch[3]) : 0;

            const baseFormula =
                tierNum === 0 ? strikeRow.low :
                tierNum === 1 ? strikeRow.moderate :
                tierNum === 2 ? strikeRow.high :
                strikeRow.extreme;

            const adjusted = adjustStrikeFormula(baseFormula, dieOverride, modDelta);
            if (adjusted) {
                changed = true;
                return adjusted;
            }
            return raw;
        });

        return changed ? result : null;
    }

    globalThis.MonsterDamageReplace = function(paramString, actor) {
        if (!actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return null;
        const level = getActorLevel(actor);
        if (level === null) return null;

        if (!TOKEN_TEST_RE.test(paramString)) return null;
        return replaceDamageTokens(paramString, String(level));
    };

    function replaceTokensInDamageRolls(systemUpdate, actor) {
        if (!systemUpdate || !actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return;
        const level = getActorLevel(actor);
        if (level === null) return;

        const rolls = systemUpdate.damageRolls;
        if (!rolls) return;

        for (const key of Object.keys(rolls)) {
            const entry = rolls[key];
            if (!entry) continue;
            const damageString = entry.damage ?? entry.formula ?? null;
            if (typeof damageString !== "string") continue;
            const replaced = replaceDamageTokens(damageString, String(level));
            if (replaced) {
                if (entry.damage !== undefined) entry.damage = replaced;
                if (entry.formula !== undefined) entry.formula = replaced;
            }
        }
    }

    Hooks.on("preCreateItem", (item, data) => {
        const actor = item?.parent ?? null;
        if (!actor) return;
        if (!data.system) return;
        replaceTokensInDamageRolls(data.system, actor);
    });

    Hooks.on("preUpdateItem", (item, changes) => {
        const actor = item?.parent ?? null;
        if (!actor) return;
        if (!changes.system) return;
        replaceTokensInDamageRolls(changes.system, actor);
    });

    Hooks.once("ready", () => {
        const TextEditorPF2e = game?.pf2e?.TextEditor ?? globalThis.TextEditorPF2e;
        if (!TextEditorPF2e?.enrichString || TextEditorPF2e.enrichString.__monsterDamagePatched) {
            return;
        }

        const originalEnrichString = TextEditorPF2e.enrichString.bind(TextEditorPF2e);
        const patched = async function(data, options = {}) {
            try {
                if (Array.isArray(data) && typeof data[1] === "string" && data[1].toLowerCase() === "damage" && typeof data[2] === "string") {
                    const resolvedRollData = typeof options.rollData === "function" ? options.rollData() : options.rollData;
                    const actor = resolvedRollData?.actor ?? resolvedRollData?.item?.actor ?? options.relativeTo?.actor ?? options.relativeTo ?? null;
                    const updated = globalThis.MonsterDamageReplace(data[2], actor);
                    if (updated) {
                        const updatedData = Array.from(data);
                        if (data.groups) updatedData.groups = data.groups;
                        updatedData[2] = updated;
                        return originalEnrichString(updatedData, options);
                    }
                }
            } catch (error) {
                console.warn("PF2e Monster Damage Helper | Failed to adjust damage formulas", error);
            }

            return originalEnrichString(data, options);
        };

        patched.__monsterDamagePatched = true;
        TextEditorPF2e.enrichString = patched;
    });

    console.log("PF2e Monster Damage Helper | Loaded");
});
