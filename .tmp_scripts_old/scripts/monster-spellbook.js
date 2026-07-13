/**
 * Скрипт для создания книги заклинаний (Monster Spellbook).
 * Версия 20.0: ИСПРАВЛЕНА проверка максимального круга для спонтанных/подготавливаемых.
 * 
 * Логика фильтрации уровня:
 * 1. Вычисляется Максимальный круг (MaxRank) = ceil(Level / 2).
 * 2. Если в строке НЕТ пометки "(X ур)": Скрипт пропускает круги выше MaxRank.
 * 3. Если в строке ЕСТЬ пометка "(X ур)": Скрипт игнорирует MaxRank (считает, что это особое исключение),
 *    но проверяет, достиг ли актер уровня X.
 */

Hooks.on('createItem', async (item, context, userId) => {
    // 1. Проверки
    if (game.user.id !== userId) return;
    if (!item.actor) return;
    if (!item.name.startsWith("TS-Spellbook")) return;

    // 2. Настройки
    const nameMatch = item.name.match(/TS-Spellbook\s*\(.*?\)\s*"(.*?)"/);
    const entryName = nameMatch ? nameMatch[1] : "Новый список";
    
    let tradition = "arcane"; 
    const lowerName = entryName.toLowerCase();
    if (lowerName.includes("божеств") || lowerName.includes("divine") || lowerName.includes("сакральн")) tradition = "divine";
    if (lowerName.includes("оккульт") || lowerName.includes("occult")) tradition = "occult";
    if (lowerName.includes("природ") || lowerName.includes("primal")) tradition = "primal";

    // 3. Чистка HTML
    let rawHtml = item.system.description.value || "";
    let cleanText = rawHtml
        .replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, ""); 
    
    const txtArea = document.createElement("textarea");
    txtArea.innerHTML = cleanText;
    cleanText = txtArea.value;

    // 4. Определение режима
    const isFocusMode = /фокус-/i.test(cleanText);
    const hasSlots = /\d+.*?\(\d+[\/\-]?.*?\)\s*:/.test(cleanText);
    const hasPreparedFlags = /@UUID\[.*?\](?:\{.*?\})?\s*[?+]+/.test(cleanText);
    
    let entryType = "innate";
    
    if (isFocusMode) {
        entryType = "focus";
    } else if (hasSlots && hasPreparedFlags) {
        entryType = "prepared";
    } else if (hasSlots) { 
        entryType = "spontaneous";
    } else {
        entryType = "innate";
    }

    console.log(`TS-Spellbook | Режим: ${entryType.toUpperCase()} | Традиция: ${tradition}`);

    // 5. Создание Entry
    const entryData = {
        name: entryName,
        type: "spellcastingEntry",
        system: {
            prepared: { value: entryType },
            tradition: { value: tradition },
            showSlotlessLevels: { value: false },
            spelldc: { value: 0, dc: 0 },
            ability: { value: "" } 
        }
    };

    const existingEntry = item.actor.spellcasting.contents.find(e => 
        e.statistic && e.statistic.dc && e.statistic.dc.value > 0
    );
    if (existingEntry) {
        const targetDC = existingEntry.statistic.dc.value;
        const targetAttack = targetDC - 8;
        entryData.system.spelldc = { value: targetAttack, dc: targetDC };
    }

    const [spellcastingEntry] = await item.actor.createEmbeddedDocuments("Item", [entryData]);
    
    const actorLevel = item.actor.level;
    const maxAvailableRank = Math.max(1, Math.ceil(actorLevel / 2));

    // 6. Парсинг строк
    const lines = cleanText.split('\n').filter(l => l.trim() !== "");
    const spellsToCreate = [];
    const entryUpdateData = {}; 
    const preparationQueues = {}; 
    const calculatedSlots = {}; 

    let focusSpellsCount = 0;
    let focusRankState = 1;

    for (const rawLine of lines) {
        let line = rawLine.trim();
        
        // Флаг: было ли явное требование уровня в строке?
        let hasExplicitLevelReq = false;

        // (4 ур) - Проверка уровня строки
        const levelReqMatch = line.match(/^\((\d+)\s*(?:ур|lvl|level|ur)\)\s*/i);
        if (levelReqMatch) {
            const requiredLevel = parseInt(levelReqMatch[1]);
            // Если уровень мал - пропускаем
            if (actorLevel < requiredLevel) continue;
            
            // Если уровень подходит, помечаем, что это "особая" строка
            hasExplicitLevelReq = true;
            line = line.substring(levelReqMatch[0].length).trim();
        }

        // --- ФОКУСЫ ---
        if (isFocusMode) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes("фокус-чары") || lowerLine.includes("focus cantrip")) focusRankState = 0;
            else if (lowerLine.includes("фокус-заклинания") || lowerLine.includes("focus spell")) focusRankState = 1;

            const matches = [...line.matchAll(/@UUID\[([a-zA-Z0-9\-\.]+)\]/g)];
            for (const match of matches) {
                const uuid = match[1];
                try {
                    const spellObject = await fromUuid(uuid);
                    if (spellObject) {
                        const sSrc = spellObject.toObject();
                        sSrc.system.location = { value: spellcastingEntry.id };
                        sSrc.system.location.heightenedLevel = maxAvailableRank;
                        if (focusRankState === 0) {
                             if (!sSrc.system.traits.value.includes("cantrip")) sSrc.system.traits.value.push("cantrip");
                        } else focusSpellsCount++;
                        spellsToCreate.push(sSrc);
                    }
                } catch (e) {}
            }
        }
        // --- PREPARED / SPONTANEOUS ---
        else if (entryType === "spontaneous" || entryType === "prepared") {
            const headerMatch = line.match(/^([^:]+?)(?:\s*\(([\d\/\-]+)\))?\s*:/);
            if (!headerMatch) continue;

            const rankLabel = headerMatch[1].toUpperCase().trim(); 
            const rawSlotsString = headerMatch[2]; 
            const content = line.substring(headerMatch[0].length);

            let targetRank = 0; 

            // Проверка на UPTO/ДО
            const uptoMatch = rankLabel.match(/(?:UPTO|ДО)(\d+)/);
            if (uptoMatch) {
                const cap = parseInt(uptoMatch[1]);
                targetRank = Math.max(1, Math.min(cap, maxAvailableRank));
            } else {
                if (rankLabel.includes("ЧАРЫ") || rankLabel.includes("CANTRIP")) targetRank = 0;
                else {
                    const numMatch = rankLabel.match(/\d+/);
                    targetRank = numMatch ? parseInt(numMatch[0]) : 1;
                }
            }

            // !!! ВЕРНУТАЯ ПРОВЕРКА !!!
            // Если это не чары, и ранг выше доступного, и НЕ было явного (X ур) -> Пропускаем
            if (targetRank !== 0 && targetRank > maxAvailableRank && !hasExplicitLevelReq) {
                continue;
            }

            // Расчет слотов
            let currentSlots = 0;
            if (rawSlotsString) {
                if (targetRank === 0 && entryType === "prepared") currentSlots = parseInt(rawSlotsString) || 5; 
                else if (targetRank === 1) {
                    const parts = rawSlotsString.split(/[\/-]/).map(Number);
                    if (parts.length >= 3) {
                        if (actorLevel < 1) currentSlots = parts[0];
                        else if (actorLevel === 1) currentSlots = parts[1];
                        else currentSlots = parts[2];
                    } else if (parts.length === 2) {
                        currentSlots = (actorLevel <= 1) ? parts[0] : parts[1];
                    } else currentSlots = parts[0];
                } else if (targetRank > 1) {
                    const startLevelForRank = (targetRank * 2) - 1;
                    const parts = rawSlotsString.split('-').map(Number);
                    const startSlots = parts[0];
                    const highSlots = parts.length > 1 ? parts[1] : startSlots;
                    if (actorLevel <= startLevelForRank) currentSlots = startSlots;
                    else currentSlots = highSlots;
                }

                entryUpdateData[`system.slots.slot${targetRank}.value`] = currentSlots;
                entryUpdateData[`system.slots.slot${targetRank}.max`] = currentSlots;
                calculatedSlots[targetRank] = currentSlots;
            }

            const matches = [...content.matchAll(/@UUID\[([a-zA-Z0-9\-\.]+)\](?:\{.*?\})?(\s*[*?+]+)?/g)];
            if (!preparationQueues[targetRank]) preparationQueues[targetRank] = { mandatory: [], conditional: [] };

            for (const match of matches) {
                const uuid = match[1];
                let flags = match[2] ? match[2].trim() : "";
                const isSignature = flags.includes("*");

                try {
                    const spellObject = await fromUuid(uuid);
                    if (spellObject) {
                        const sSrc = spellObject.toObject();
                        const baseRank = sSrc.system.level.value || 1;
                        sSrc.system.location = { value: spellcastingEntry.id };
                        sSrc.flags = foundry.utils.mergeObject(sSrc.flags || {}, { "monster-spellbook": { sourceUuid: uuid } });
                        if (entryType === "spontaneous") sSrc.system.location.signature = isSignature;

                        if (targetRank === 0) {
                            sSrc.system.location.heightenedLevel = maxAvailableRank;
                            if (!sSrc.system.traits.value.includes("cantrip")) sSrc.system.traits.value.push("cantrip");
                        } else {
                            sSrc.system.level = { value: baseRank };
                            if (entryType === "prepared") {
                                delete sSrc.system.location.heightenedLevel;
                            } else {
                                sSrc.system.location.heightenedLevel = targetRank;
                            }
                        }
                        spellsToCreate.push(sSrc);

                        if (entryType === "prepared") {
                            while (flags.includes("?+")) { preparationQueues[targetRank].conditional.push(uuid); flags = flags.replace("?+", ""); }
                            while (flags.includes("+")) { preparationQueues[targetRank].mandatory.push(uuid); flags = flags.replace("+", ""); }
                        }
                    }
                } catch (e) { console.warn(e); }
            }
        }
        // --- ЛОГИКА INNATE (ВРОЖДЕННЫЕ) ---
        else if (entryType === "innate") {
             const headerMatch = line.match(/^([^:]+?)(?:\s*\(([\d\/\-]+)\))?\s*:/);
             if (headerMatch) {
                 const rankLabel = headerMatch[1].toUpperCase().trim();
                 const headerUsesStr = headerMatch[2];
                 const content = line.substring(headerMatch[0].length);
                 
                 let targetRank = 0;
                 
                 const uptoMatch = rankLabel.match(/(?:UPTO|ДО)(\d+)/);
                 if (uptoMatch) {
                     const cap = parseInt(uptoMatch[1]);
                     targetRank = Math.max(1, Math.min(cap, maxAvailableRank));
                 } else {
                     if (rankLabel.includes("ЧАРЫ") || rankLabel.includes("CANTRIP")) targetRank = 0;
                     else {
                        const numMatch = rankLabel.match(/\d+/);
                        targetRank = numMatch ? parseInt(numMatch[0]) : 1;
                     }
                 }
                 
                 const matches = [...content.matchAll(/@UUID\[([a-zA-Z0-9\-\.]+)\](?:\{.*?\})?(?:\s*\(([^)]+)\))?/g)];
                 for (const match of matches) {
                     const uuid = match[1];
                     const spellUsageText = match[2];
                     
                     try {
                         const sObj = await fromUuid(uuid);
                         if(sObj) {
                             const sSrc = sObj.toObject();
                             const baseRank = sSrc.system.level.value || 1;

                             sSrc.system.location = { value: spellcastingEntry.id };
                             
                             if(targetRank === 0) { 
                                 sSrc.system.location.heightenedLevel = maxAvailableRank; 
                                 if(!sSrc.system.traits.value.includes("cantrip")) sSrc.system.traits.value.push("cantrip"); 
                             } else { 
                                 sSrc.system.level = { value: baseRank }; 
                                 sSrc.system.location.heightenedLevel = targetRank; 
                             }
                             
                             let finalUsageText = spellUsageText || headerUsesStr;

                             if (finalUsageText && /^\d+$/.test(finalUsageText)) {
                                 const u = parseInt(finalUsageText); 
                                 sSrc.system.location.uses = {value: u, max: u}; 
                                 sSrc.system.frequency = {max: u, per: "day"};
                             } else {
                                 sSrc.system.location.uses = {value: 99, max: 99}; 
                                 sSrc.system.frequency = {max: 99, per: "day"};
                                 if (spellUsageText && isNaN(parseInt(spellUsageText))) {
                                     sSrc.name = `${sSrc.name} (${spellUsageText})`;
                                 }
                             }
                             spellsToCreate.push(sSrc);
                         }
                     } catch(e) {}
                 }
             }
        }
    }

    // --- СОХРАНЕНИЕ ---
    let createdSpells = [];
    if (spellsToCreate.length > 0) {
        createdSpells = await item.actor.createEmbeddedDocuments("Item", spellsToCreate);
        console.log(`TS-Spellbook | Создано заклинаний: ${createdSpells.length}`);
    }

    // --- ЗАПОЛНЕНИЕ СЛОТОВ (PREPARED) ---
    if (entryType === "prepared" && createdSpells.length > 0) {
        const uuidToRealId = {};
        for (const spell of createdSpells) {
            const srcUuid = spell.flags?.["monster-spellbook"]?.sourceUuid;
            if (srcUuid) uuidToRealId[srcUuid] = spell.id;
        }
        for (const [rankStr, queues] of Object.entries(preparationQueues)) {
            const rank = parseInt(rankStr);
            const maxSlots = calculatedSlots[rank] || 0;
            const preparedData = {};
            let slotsUsed = 0;
            for (const sourceUuid of queues.mandatory) {
                if (slotsUsed >= maxSlots) break;
                const realId = uuidToRealId[sourceUuid];
                if (realId) { preparedData[slotsUsed] = { id: realId }; slotsUsed++; }
            }
            for (const sourceUuid of queues.conditional) {
                if (slotsUsed >= maxSlots) break;
                const realId = uuidToRealId[sourceUuid];
                if (realId) { preparedData[slotsUsed] = { id: realId }; slotsUsed++; }
            }
            if (Object.keys(preparedData).length > 0) {
                entryUpdateData[`system.slots.slot${rank}.prepared`] = preparedData;
            }
        }
    }

    if (Object.keys(entryUpdateData).length > 0) {
        await spellcastingEntry.update(entryUpdateData);
    }

    if (isFocusMode && focusSpellsCount > 0) {
        const newPoints = Math.min(3, focusSpellsCount);
        await item.actor.update({ "system.resources.focus.value": newPoints, "system.resources.focus.max": newPoints });
    }

    await item.delete();
});