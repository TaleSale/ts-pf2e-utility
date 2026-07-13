Hooks.once("init", () => {
    const DEBUG = true;
    const DC_TABLE = {
        "-1": { low:11,moderate: 13, high: 16, extreme: 19 },
        "0":  { low:11,moderate: 13, high: 16, extreme: 19 },
        "1":  { low:12,moderate: 14, high: 17, extreme: 20 },
        "2":  { low:13,moderate: 15, high: 18, extreme: 22 },
        "3":  { low:15,moderate: 17, high: 20, extreme: 23 },
        "4":  { low:16,moderate: 18, high: 21, extreme: 25 },
        "5":  { low:17,moderate: 19, high: 22, extreme: 26 },
        "6":  { low:19,moderate: 21, high: 24, extreme: 27 },
        "7":  { low:20,moderate: 22, high: 25, extreme: 29 },
        "8":  { low:21,moderate: 23, high: 26, extreme: 30 },
        "9":  { low:23,moderate: 25, high: 28, extreme: 32 },
        "10": { low:24,moderate: 26, high: 29, extreme: 33 },
        "11": { low:25,moderate: 27, high: 30, extreme: 34 },
        "12": { low:27,moderate: 29, high: 32, extreme: 36 },
        "13": { low:28,moderate: 30, high: 33, extreme: 37 },
        "14": { low:29,moderate: 31, high: 34, extreme: 39 },
        "15": { low:31,moderate: 33, high: 36, extreme: 40 },
        "16": { low:32,moderate: 34, high: 37, extreme: 41 },
        "17": { low:33,moderate: 35, high: 38, extreme: 43 },
        "18": { low:35,moderate: 37, high: 40, extreme: 44 },
        "19": { low:36,moderate: 38, high: 41, extreme: 46 },
        "20": { low:37,moderate: 39, high: 42, extreme: 47 },
        "21": { low:39,moderate: 41, high: 44, extreme: 48 },
        "22": { low:40,moderate: 42, high: 45, extreme: 50 },
        "23": { low:41,moderate: 43, high: 46, extreme: 51 },
        "24": { low:43,moderate: 45, high: 48, extreme: 52 }
    };

    globalThis.MonsterDC = function(level, tier = "moderate") {
        const lvl = String(level);
        const t = tier.toLowerCase();
        const row = DC_TABLE[lvl];
        if (!row) return null;
        return row[t] ?? row.moderate ?? null;
    };

    const NUMERIC_RE = /^-?\d+$/;
    const VARIANT_RE = /^V[0123]$/i;

    function toDcValue(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return number > 0 ? number : null;
    }

    function getActorLevel(actor) {
        const level = actor?.system?.details?.level?.value ?? actor?.system?.details?.level ?? actor?.level ?? actor?.system?.level?.value;
        return Number.isFinite(Number(level)) ? Number(level) : null;
    }

    function getVariantTier(variant) {
        if (variant === "V0") return "low";
        if (variant === "V2") return "high";
        if (variant === "V3") return "extreme";
        return "moderate";
    }

    function resolveActorDcValue(actor, value) {
        if (!actor) return null;
        const raw = String(value ?? "").trim();
        if (!raw) return null;
        if (NUMERIC_RE.test(raw)) return Number(raw);

        const key = raw.toLowerCase();
        const isNpc = actor.isOfType?.("npc") || actor.type === "npc";
        const classDc = actor?.system?.attributes?.classDC ?? actor?.system?.attributes?.classDc;
        const spellDc = actor?.system?.attributes?.spellDC ?? actor?.system?.attributes?.spellDc;

        if (key === "class" || key === "class-dc" || key === "classdc" || key === "dcclass") {
            if (isNpc) return null;
            return toDcValue(classDc?.value ?? classDc);
        }
        if (key === "spell" || key === "spell-dc" || key === "spelldc") {
            if (isNpc) return null;
            return toDcValue(spellDc?.value ?? spellDc);
        }
        if (key === "class-spell" || key === "class-spell-dc") {
            if (isNpc) return null;
            const values = [toDcValue(classDc?.value ?? classDc), toDcValue(spellDc?.value ?? spellDc)]
                .filter((v) => Number.isFinite(v));
            return values.length ? Math.max(...values) : null;
        }

        const statistic = actor.getStatistic?.(key);
        const statisticDc = toDcValue(statistic?.dc?.value ?? statistic?.dc);
        if (statisticDc !== null) return statisticDc;

        const save = actor.saves?.[key] ?? actor.system?.saves?.[key];
        const saveDc = toDcValue(save?.dc?.value ?? save?.dc);
        if (saveDc !== null) return saveDc;

        if (key === "perception") {
            const perception = actor.perception ?? actor.system?.attributes?.perception;
            return toDcValue(perception?.dc?.value ?? perception?.dc);
        }

        return null;
    }

    function applyMonsterDcToCheckParams(paramString, actor) {
        if (!actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return null;
        const level = getActorLevel(actor);
        if (level === null) return null;

        const rawParts = String(paramString).split("|");
        let variant = null;
        const parts = [];
        for (const part of rawParts) {
            const trimmed = part.trim();
            if (VARIANT_RE.test(trimmed)) {
                variant = trimmed.toUpperCase();
                continue;
            }
            parts.push(part);
        }

        const tier = getVariantTier(variant);
        const dcValue = MonsterDC(level, tier);
        if (!Number.isFinite(Number(dcValue))) return null;

        let dcIndex = -1;
        const againstToRemove = new Set();
        let removedAgainst = false;
        let dcResolved = null;

        for (let i = 0; i < parts.length; i += 1) {
            const part = parts[i];
            const colonIndex = part.indexOf(":");
            if (colonIndex === -1) continue;

            const key = part.slice(0, colonIndex).trim().toLowerCase();
            const value = part.slice(colonIndex + 1).trim();

            if (key === "dc") {
                dcIndex = i;
                if (NUMERIC_RE.test(value) && Number(value) <= 0) {
                    dcResolved = null;
                } else {
                    dcResolved = resolveActorDcValue(actor, value);
                }
                continue;
            }

            if (key === "against") {
                if (value.length === 0) {
                    againstToRemove.add(i);
                    removedAgainst = true;
                } else {
                    const againstResolved = resolveActorDcValue(actor, value);
                    if (againstResolved !== null) continue;
                    againstToRemove.add(i);
                    removedAgainst = true;
                }
            }
        }

        const dcIsUsable = dcIndex !== -1 && dcResolved !== null;
        let changed = false;

        if (againstToRemove.size) {
            for (const index of againstToRemove) {
                parts[index] = null;
                changed = true;
            }
        }

        if (dcIndex !== -1 && !dcIsUsable) {
            parts[dcIndex] = `dc:${dcValue}`;
            changed = true;
        }

        if (dcIndex === -1 && removedAgainst) {
            parts.splice(1, 0, `dc:${dcValue}`);
            changed = true;
        }

        if (!changed) return null;
        return parts.filter((part) => part !== null).join("|");
    }

    Hooks.once("ready", () => {
        const TextEditorPF2e = game?.pf2e?.TextEditor ?? globalThis.TextEditorPF2e;
        if (!TextEditorPF2e?.enrichString || TextEditorPF2e.enrichString.__monsterDcPatched) {
            return;
        }

        const originalEnrichString = TextEditorPF2e.enrichString.bind(TextEditorPF2e);
        const patched = async function(data, options = {}) {
            try {
                if (Array.isArray(data) && typeof data[1] === "string" && data[1].toLowerCase() === "check" && typeof data[2] === "string") {
                    const resolvedRollData = typeof options.rollData === "function" ? options.rollData() : options.rollData;
                    const actor = resolvedRollData?.actor ?? resolvedRollData?.item?.actor ?? options.relativeTo?.actor ?? options.relativeTo ?? null;
                    const updated = applyMonsterDcToCheckParams(data[2], actor);
                    if (DEBUG) {
                        console.log("PF2e Monster DC Helper | Check", {
                            params: data[2],
                            actorType: actor?.type,
                            level: getActorLevel(actor),
                            updated
                        });
                    }
                    if (updated) {
                        const updatedData = Array.from(data);
                        if (data.groups) updatedData.groups = data.groups;
                        updatedData[2] = updated;
                        return originalEnrichString(updatedData, options);
                    }
                }
            } catch (error) {
                console.warn("PF2e Monster DC Helper | Failed to adjust check DCs", error);
            }

            return originalEnrichString(data, options);
        };

        patched.__monsterDcPatched = true;
        TextEditorPF2e.enrichString = patched;
    });

    console.log("PF2e Monster DC Helper | Loaded");
});
