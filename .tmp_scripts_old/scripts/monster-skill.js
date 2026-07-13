Hooks.once("init", () => {
    // === КОНФИГУРАЦИЯ ===

    // Таблица сложности (GMG)
    const SKILL_TABLE = {
        "-1": { low: 2, moderate: 4, high: 5, extreme: 8 },
        "0": { low: 3, moderate: 5, high: 6, extreme: 9 },
        "1": { low: 4, moderate: 6, high: 7, extreme: 10 },
        "2": { low: 5, moderate: 7, high: 8, extreme: 11 },
        "3": { low: 7, moderate: 9, high: 10, extreme: 13 },
        "4": { low: 8, moderate: 10, high: 12, extreme: 15 },
        "5": { low: 10, moderate: 12, high: 13, extreme: 16 },
        "6": { low: 11, moderate: 13, high: 15, extreme: 18 },
        "7": { low: 13, moderate: 15, high: 17, extreme: 20 },
        "8": { low: 14, moderate: 16, high: 18, extreme: 21 },
        "9": { low: 16, moderate: 18, high: 20, extreme: 23 },
        "10": { low: 17, moderate: 19, high: 22, extreme: 25 },
        "11": { low: 19, moderate: 21, high: 23, extreme: 26 },
        "12": { low: 20, moderate: 22, high: 25, extreme: 28 },
        "13": { low: 22, moderate: 24, high: 27, extreme: 30 },
        "14": { low: 23, moderate: 25, high: 28, extreme: 31 },
        "15": { low: 25, moderate: 27, high: 30, extreme: 33 },
        "16": { low: 26, moderate: 28, high: 32, extreme: 35 },
        "17": { low: 28, moderate: 30, high: 33, extreme: 36 },
        "18": { low: 29, moderate: 31, high: 35, extreme: 38 },
        "19": { low: 31, moderate: 33, high: 37, extreme: 40 },
        "20": { low: 32, moderate: 34, high: 38, extreme: 41 },
        "21": { low: 34, moderate: 36, high: 40, extreme: 43 },
        "22": { low: 35, moderate: 37, high: 42, extreme: 45 },
        "23": { low: 36, moderate: 38, high: 43, extreme: 46 },
        "24": { low: 38, moderate: 40, high: 45, extreme: 48 },
    };

    // Русские названия для навыков и статов
    const TRANSLATIONS = {
        // Навыки
        "acrobatics": "Акробатика",
        "arcana": "Аркана",
        "athletics": "Атлетика",
        "crafting": "Ремесло",
        "deception": "Обман",
        "diplomacy": "Дипломатия",
        "intimidation": "Запугивание",
        "lore": "Знания",
        "medicine": "Медицина",
        "nature": "Природа",
        "occultism": "Оккультизм",
        "performance": "Выступление",
        "religion": "Религия",
        "society": "Общество",
        "stealth": "Скрытность",
        "survival": "Выживание",
        "thievery": "Воровство",
        // Характеристики для DC
        "perception": "Восприятие",
        "fortitude": "Стойкость",
        "reflex": "Рефлекс",
        "will": "Воля",
        "ac": "КБ",
        "armor": "КБ"
    };

    // Регулярка захватывает: @Check [ (Tier) [skill-Name-Target] ]
    // Group 1: Полный тег (для замены)
    // Group 2: Тир (V1, V2+2)
    // Group 3: Строка навыка (skill, skill-athletics, skill-athletics-perception)
    const SKILL_TOKEN_RE = /(@Check\[\(\s*(V[0-3](?:[+-]\d+)?)\s*\)\[(skill(?:-[a-zA-Z]+)?(?:-[a-zA-Z]+)?)\]\])/gi;

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

    function getActorLevel(actor) {
        const level =
            actor?.system?.details?.level?.value ??
            actor?.system?.details?.level ??
            actor?.level ??
            actor?.system?.level?.value;
        return Number.isFinite(Number(level)) ? Number(level) : null;
    }

    // Вычисляет числовой модификатор на основе Уровня Актера и Тира (V0-V3)
    function calculateModifier(tierToken, actor) {
        if (!actor || !(actor.isOfType?.("npc") || actor.type === "npc")) return null;
        const level = getActorLevel(actor);
        if (level === null) return null;

        const match = /^V([0-3])([+-]\d+)?$/i.exec(tierToken.trim());
        if (!match) return null;

        const tier = Number(match[1]); // 0=Low, 1=Mod, 2=High, 3=Extreme
        const delta = match[2] ? Number(match[2]) : 0;
        const row = SKILL_TABLE[String(level)];
        if (!row) return null;

        const base = tier === 0 ? row.low : tier === 1 ? row.moderate : tier === 2 ? row.high : row.extreme;
        return Number(base + delta);
    }

    function capitalize(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    }

    // Получаем красивое имя (перевод или оригинал с большой буквы)
    function getLabel(slug) {
        if (!slug) return "";
        const lower = slug.toLowerCase();
        return TRANSLATIONS[lower] ?? capitalize(lower);
    }

    // === ЛОГИКА ЗАМЕНЫ ТЕКСТА ===

    Hooks.once("ready", () => {
        const TextEditorPF2e = game?.pf2e?.TextEditor ?? globalThis.TextEditorPF2e;
        if (!TextEditorPF2e?.enrichHTML || TextEditorPF2e.enrichHTML.__monsterSkillPatched) {
            return;
        }

        const originalEnrichHTML = TextEditorPF2e.enrichHTML.bind(TextEditorPF2e);

        const patched = async function (content, options = {}) {
            let updated = content;

            try {
                if (typeof updated === "string" && updated.includes("[skill")) {
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

                    const replaceOne = (fullMatch, tierToken, skillString) => {
                        const mod = calculateModifier(tierToken, actor);
                        
                        // Если не смогли вычислить модификатор, возвращаем как было
                        if (mod === null) return fullMatch;

                        // Разбираем строку skill-skillName-targetStat
                        // parts[0] = "skill"
                        // parts[1] = skill slug (optional)
                        // parts[2] = target stat (optional)
                        const parts = skillString.split("-");
                        const skillSlug = parts[1] ? parts[1].toLowerCase() : null;
                        const targetSlug = parts[2] ? parts[2].toLowerCase() : null;

                        const numericMod = Number(mod);
                        const signedMod = numericMod >= 0 ? `+${numericMod}` : String(numericMod);
                        const actorUuid = actor?.uuid ?? "";

                        // Формируем текст кнопки
                        let label = "Проверка навыка";
                        if (skillSlug) {
                            label = getLabel(skillSlug);
                        }
                        if (targetSlug) {
                            label += ` vs ${getLabel(targetSlug)}`;
                        }

                        // Собираем data-атрибуты для обработчика клика
                        const dataAttrs = [
                            `data-monster-skill="true"`,
                            `data-modifier="${numericMod}"`,
                            actorUuid ? `data-actor-uuid="${actorUuid}"` : "",
                            skillSlug ? `data-skill-slug="${skillSlug}"` : "",
                            targetSlug ? `data-target-slug="${targetSlug}"` : "",
                            `title="Модификатор ${signedMod} (Ур. ${getActorLevel(actor)} ${tierToken})"`
                        ].filter(Boolean).join(" ");

                        return `<a class="inline-roll monster-skill-roll" ${dataAttrs}><i class="fas fa-dice-d20"></i> ${label} ${signedMod}</a>`;
                    };

                    updated = updated.replace(SKILL_TOKEN_RE, (match, fullTag, tierToken, skillStr) => 
                        replaceOne(match, tierToken, skillStr)
                    );
                }
            } catch (err) {
                console.warn("PF2e Monster Skill Helper | Replace failed", err);
            }

            return originalEnrichHTML(updated, options);
        };

        patched.__monsterSkillPatched = true;
        TextEditorPF2e.enrichHTML = patched;

        // === ОБРАБОТЧИК КЛИКА ===

        document.addEventListener("click", async (event) => {
            const anchor =
                event.target instanceof Element ? event.target.closest("a[data-monster-skill]") : null;
            if (!anchor) return;

            event.preventDefault();
            event.stopPropagation();

            // Читаем параметры из кнопки
            const mod = Number(anchor.dataset.modifier ?? "0");
            const actorUUID = anchor.dataset.actorUuid;
            const skillSlug = anchor.dataset.skillSlug || null;
            const targetSlug = anchor.dataset.targetSlug || null;

            // Находим актера, совершающего бросок
            let actor = null;
            if (actorUUID) {
                try {
                    const doc = await fromUuid(actorUUID);
                    actor = doc?.actor ?? doc;
                } catch (e) { console.warn(e); }
            }

            // Находим цель (Target) для DC
            const targetToken = game.user.targets.first() ?? null;
            const targetActor = targetToken?.actor ?? null;

            try {
                const Check = game.pf2e?.Check ?? globalThis.Check;
                const Modifier = game.pf2e?.Modifier ?? globalThis.Modifier;
                const StatisticModifier = game.pf2e?.StatisticModifier ?? globalThis.StatisticModifier;
                const CheckModifier = game.pf2e?.CheckModifier ?? globalThis.CheckModifier;

                if (Check && Modifier) {
                    // Опции броска
                    const rollOptions = new Set(["check", "skill-check"]);
                    
                    // Если указан конкретный навык, добавляем его трейт (например, "athletics")
                    if (skillSlug) {
                        rollOptions.add(skillSlug);
                        // Добавляем опцию действия, чтобы сработали некоторые автоматизации
                        rollOptions.add(`action:${skillSlug}`); 
                    }

                    if (actor) {
                        actor.getRollOptions?.(["all", "skill-check"])?.forEach(opt => rollOptions.add(opt));
                    }

                    // Создаем базовый модификатор
                    const baseModifier = new Modifier({ 
                        slug: "base", 
                        label: "PF2E.ModifierTitle", // "Base Modifier"
                        modifier: mod,
                        type: "untyped",
                        enabled: true
                    });

                    // Создаем статистику для броска
                    const statistic = new StatisticModifier(skillSlug ?? "skill-check", [baseModifier], rollOptions);
                    const check = new CheckModifier(skillSlug ?? "skill-check", statistic, []);

                    // Формируем DC (сложность), если указан targetSlug и есть цель
                    let dcData = null;
                    if (targetSlug && targetActor) {
                        let dcValue = null;
                        
                        // Поиск значения DC у цели
                        if (targetSlug === "ac" || targetSlug === "armor") {
                            dcValue = targetActor.attributes?.ac?.value;
                        } else if (targetSlug === "perception") {
                            dcValue = targetActor.perception?.dc?.value;
                        } else if (["fortitude", "reflex", "will"].includes(targetSlug)) {
                            // Спаски
                            dcValue = targetActor.saves?.[targetSlug]?.dc?.value;
                        } else {
                            // Навыки
                            dcValue = targetActor.skills?.[targetSlug]?.dc?.value;
                        }

                        if (dcValue != null) {
                            dcData = { 
                                value: dcValue, 
                                slug: targetSlug,
                                label: getLabel(targetSlug) 
                            };
                        }
                    }

                    const checkContext = {
                        type: "skill-check",
                        actor: actor,
                        token: actor?.getActiveTokens?.(false, true)?.[0] ?? null,
                        target: targetToken ? { actor: targetActor, token: targetToken.document } : null,
                        dc: dcData,
                        options: rollOptions,
                        title: skillSlug ? getLabel(skillSlug) : "Проверка навыка",
                        traits: skillSlug ? [skillSlug] : ["skill"],
                        createMessage: true,
                    };

                    await Check.roll(check, checkContext, event);
                } else {
                    // Фоллбэк (если нет системы PF2e)
                    const roll = new Roll(`1d20 + ${mod}`);
                    await roll.evaluate();
                    
                    let flavor = `<strong>${skillSlug ? getLabel(skillSlug) : "Проверка навыка"}</strong>`;
                    if (targetSlug) flavor += ` vs ${getLabel(targetSlug)}`;
                    
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        flavor: flavor,
                    });
                }
            } catch (err) {
                console.warn("PF2e Monster Skill Helper | Roll failed", err);
            }
        });
    });

    console.log("PF2e Monster Skill Helper | Loaded");
});