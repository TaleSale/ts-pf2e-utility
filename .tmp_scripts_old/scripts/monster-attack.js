Hooks.once("init", () => {

    const ATTACK_TABLE = {
    "-1": { low: 4, moderate: 6, high: 8, extreme: 10 },
    "0": { low: 4, moderate: 6, high: 8, extreme: 10 },
    "1": { low: 5, moderate: 7, high: 9, extreme: 11 },
    "2": { low: 7, moderate: 9, high: 11, extreme: 13 },
    "3": { low: 8, moderate: 10, high: 12, extreme: 14 },
    "4": { low: 9, moderate: 12, high: 14, extreme: 16 },
    "5": { low: 11, moderate: 13, high: 15, extreme: 17 },
    "6": { low: 12, moderate: 15, high: 17, extreme: 19 },
    "7": { low: 13, moderate: 16, high: 18, extreme: 20 },
    "8": { low: 15, moderate: 18, high: 20, extreme: 22 },
    "9": { low: 16, moderate: 19, high: 21, extreme: 23 },
    "10": { low: 17, moderate: 21, high: 23, extreme: 25 },
    "11": { low: 19, moderate: 22, high: 24, extreme: 27 },
    "12": { low: 20, moderate: 24, high: 26, extreme: 28 },
    "13": { low: 21, moderate: 25, high: 27, extreme: 29 },
    "14": { low: 23, moderate: 27, high: 29, extreme: 31 },
    "15": { low: 24, moderate: 28, high: 30, extreme: 32 },
    "16": { low: 25, moderate: 30, high: 32, extreme: 34 },
    "17": { low: 27, moderate: 31, high: 33, extreme: 35 },
    "18": { low: 28, moderate: 33, high: 35, extreme: 37 },
    "19": { low: 29, moderate: 34, high: 36, extreme: 38 },
    "20": { low: 31, moderate: 36, high: 38, extreme: 40 },
    "21": { low: 32, moderate: 37, high: 39, extreme: 41 },
    "22": { low: 33, moderate: 39, high: 41, extreme: 43 },
    "23": { low: 35, moderate: 40, high: 42, extreme: 44 },
    "24": { low: 36, moderate: 42, high: 44, extreme: 46 },
};

    const TOKEN_RE = /(V[0-3](?:[+-]\d+)?)/i;

    function getActorLevel(actor) {
        const level =
            actor?.system?.details?.level?.value ??
            actor?.system?.details?.level ??
            actor?.level ??
            actor?.system?.level?.value;
        return Number.isFinite(Number(level)) ? Number(level) : null;
    }

    function replaceAttackToken(token, actor) {
        if (!actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return null;
        const level = getActorLevel(actor);
        if (level === null) return null;
        const match = /^V([0-3])([+-]\d+)?$/i.exec(token.trim());
        if (!match) return null;
        const tier = Number(match[1]);
        const delta = match[2] ? Number(match[2]) : 0;
        const row = ATTACK_TABLE[String(level)];
        if (!row) return null;
        const base = tier === 0 ? row.low : tier === 1 ? row.moderate : tier === 2 ? row.high : row.extreme;
        return String(base + delta);
    }

    globalThis.MonsterAttackReplace = function (paramString, actor) {
        const match = TOKEN_RE.exec(paramString || "");
        if (!match) return null;
        return replaceAttackToken(match[1], actor);
    };

    // Allow typing V-tokens into NPC strike attack modifier fields
    Hooks.on("renderItemSheetPF2e", (sheet, html) => {
        const item = sheet.item;
        if (!item?.parent || !(item.parent.isOfType?.("npc") || item.parent.type === "npc")) return;
        if (!item.isOfType?.("melee", "weapon")) return;
        html.find("input[name='system.bonus.value']").attr("type", "text");
        html.find("input[name='system.toHit.value']").attr("type", "text");
    });

    function replaceTokensInAttackBonus(systemUpdate, actor) {
        if (!systemUpdate || !actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return;

        const replaceField = (containerKey, valueKey) => {
            const container = systemUpdate[containerKey];
            const value = container?.[valueKey];
            if (typeof value !== "string") return;

            const replaced = replaceAttackToken(value, actor);
            if (replaced === null) return;

            if (!systemUpdate[containerKey]) systemUpdate[containerKey] = {};
            systemUpdate[containerKey][valueKey] = Number(replaced);
        };

        // Handle bonus.value (Attack Modifier override) and toHit.value (Strike attack modifier)
        replaceField("bonus", "value");
        replaceField("toHit", "value");
    }

    Hooks.on("preCreateItem", (item, data) => {
        const actor = item?.parent ?? null;
        if (!actor) return;
        if (!item.isOfType?.("melee", "weapon")) return;
        if (!data.system) return;
        replaceTokensInAttackBonus(data.system, actor);
    });

    Hooks.on("preUpdateItem", (item, changes) => {
        const actor = item?.parent ?? null;
        if (!actor) return;
        if (!item.isOfType?.("melee", "weapon")) return;
        if (!changes.system) return;
        replaceTokensInAttackBonus(changes.system, actor);
    });

    Hooks.once("ready", () => {
        const TextEditorPF2e = game?.pf2e?.TextEditor ?? globalThis.TextEditorPF2e;
        if (!TextEditorPF2e?.enrichHTML || TextEditorPF2e.enrichHTML.__monsterAttackPatched) {
            return;
        }

        const originalEnrichHTML = TextEditorPF2e.enrichHTML.bind(TextEditorPF2e);

        const patched = async function (content, options = {}) {
            try {
                if (typeof content === "string" && content.includes("[attack]")) {
                    const rollData =
                        typeof options.rollData === "function" ? options.rollData() : options.rollData ?? {};
                    const actor =
                        rollData.actor ??
                        rollData.item?.actor ??
                        options.relativeTo?.actor ??
                        options.relativeTo ??
                        canvas.tokens.controlled[0]?.actor ??
                        game.user.character ??
                        null;

                    const replaceOne = (token) => {
                        // Convert V0/V1/V2/V3 token to numeric modifier based on NPC level
                        const mod = replaceAttackToken(token, actor);
                        if (mod === null) {
                            // If we couldn't convert (not an NPC or invalid token), return original
                            return `[[/r ${token}[attack]]]`;
                        }

                        // Create a custom attack roll link that uses the V-tier modifier
                        const actorUuid = actor?.uuid ?? "";
                        const numericMod = Number(mod);
                        const signedMod = numericMod >= 0 ? `+${numericMod}` : String(numericMod);

                        const dataAttrs = [
                            `data-monster-attack="true"`,
                            `data-modifier="${numericMod}"`,
                            actorUuid ? `data-actor-uuid="${actorUuid}"` : "",
                        ]
                            .filter(Boolean)
                            .join(" ");

                        const label = "Атака";
                        return `<a class="inline-roll monster-attack-roll" ${dataAttrs}><i class="fas fa-dice-d20"></i> ${label} ${signedMod}</a>`;
                    };

                    let updated = content;
                    // strip braces around attack chunks to avoid damage parser
                    updated = updated.replace(/\{([^{}]*?\[attack\][^{}]*?)\}/gi, "$1");

                    // Replace [[/r (V0)[attack]]] syntax with clickable attack roll
                    updated = updated.replace(
                        /\[\[\s*\/r\s*\(\s*(V[0-3](?:[+-]\d+)?)\s*\)\s*\[attack\]\s*\]\]/gi,
                        (_m, token) => replaceOne(token),
                    );
                    // Also handle numeric formulas like [[/r 1d20+15[attack]]]
                    updated = updated.replace(
                        /\[\[\s*\/r\s*([^[\]]*?)\s*\[attack\]\s*\]\]/gi,
                        (_m, formula) => replaceOne(formula),
                    );

                    return originalEnrichHTML(updated, options);
                }
            } catch (err) {
                console.warn("PF2e Monster Attack Helper | attack inline replace failed", err);
            }

            return originalEnrichHTML(content, options);
        };

        patched.__monsterAttackPatched = true;
        TextEditorPF2e.enrichHTML = patched;

        // Handler for V-tier attack rolls (uses calculated modifier from V0/V1/V2/V3)
        document.addEventListener("click", async (event) => {
            const anchor =
                event.target instanceof Element ? event.target.closest("a[data-monster-attack]") : null;
            if (!anchor) return;

            event.preventDefault();
            event.stopPropagation();

            const mod = Number(anchor.dataset.modifier ?? "0");
            const actorUUID = anchor.dataset.actorUuid;

            let actor = null;
            if (actorUUID) {
                try {
                    const doc = await fromUuid(actorUUID);
                    actor = doc?.actor ?? doc;
                } catch (e) {
                    console.warn("PF2e Monster Attack Helper | Failed to resolve actor", e);
                }
            }

            // Get target and its AC at click time (dynamic DC)
            const targetToken = game?.user?.targets?.first?.() ?? null;
            const targetActor = targetToken?.actor ?? null;
            const targetAC = targetActor?.system?.attributes?.ac?.value ?? null;

            try {
                // Use the PF2e Check system for attack roll
                const Check = game.pf2e?.Check ?? globalThis.Check;
                if (Check) {
                    const rollOptions = new Set(["attack", "attack-roll"]);
                    if (actor) {
                        actor.getRollOptions?.(["all", "attack-roll"])?.forEach(opt => rollOptions.add(opt));
                    }

                    const checkContext = {
                        type: "attack-roll",
                        actor: actor,
                        token: actor?.getActiveTokens?.(false, true)?.[0] ?? null,
                        target: targetToken ? { actor: targetActor, token: targetToken.document } : null,
                        dc: targetAC ? { value: targetAC, slug: "armor" } : null,
                        options: rollOptions,
                        notes: [],
                        traits: ["attack"],
                        title: "Атака",
                        createMessage: true,
                    };

                    // Create a simple modifier for the attack
                    const Modifier = game.pf2e?.Modifier ?? globalThis.Modifier;
                    const StatisticModifier = game.pf2e?.StatisticModifier ?? globalThis.StatisticModifier;
                    const CheckModifier = game.pf2e?.CheckModifier ?? globalThis.CheckModifier;

                    if (CheckModifier && StatisticModifier) {
                        const baseModifier = Modifier
                            ? new Modifier({ slug: "base", label: "PF2E.ModifierTitle", modifier: mod })
                            : { slug: "base", label: "Base", modifier: mod, enabled: true };

                        const statistic = new StatisticModifier("attack", [baseModifier], rollOptions);
                        const check = new CheckModifier("attack", statistic, []);

                        await Check.roll(check, checkContext, event);
                    } else {
                        // Ultimate fallback: simple d20 roll
                        const roll = new Roll(`1d20 + ${mod}`);
                        await roll.evaluate();

                        let flavorText = `<strong>Атака</strong> (+${mod})`;
                        if (targetAC) {
                            const success = roll.total >= targetAC;
                            const critSuccess = roll.total >= targetAC + 10;
                            const critFail = roll.total <= targetAC - 10;
                            const resultText = success
                                ? (critSuccess ? "Критический успех!" : "Успех!")
                                : (critFail ? "Критический провал!" : "Провал!");
                            flavorText = `<strong>Атака</strong> против AC ${targetAC}<br>${resultText}`;
                        }

                        await roll.toMessage({
                            speaker: ChatMessage.getSpeaker({ actor }),
                            flavor: flavorText,
                        });
                    }
                }
            } catch (err) {
                console.warn("PF2e Monster Attack Helper | attack roll failed", err);
            }
        });
    });

    console.log("PF2e Monster Attack Helper | Loaded");
});

