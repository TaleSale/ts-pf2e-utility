// constructed-creature-equipment.js

window.ConstructedCreatureEquipment = {

    // Таблица фундаментальных рун по уровню существа (GMG Table 2-4)
    // Значения числовые: potency 0-3, striking/resilient 0-3
    // striking:  0 = нет, 1 = striking, 2 = greaterStriking, 3 = majorStriking
    // resilient: 0 = нет, 1 = resilient, 2 = greaterResilient, 3 = majorResilient
    RUNES_TABLE: {
        weapon: {
            2: { potency: 1, striking: 0 },
            4: { potency: 1, striking: 1 },
            10: { potency: 2, striking: 1 },
            12: { potency: 2, striking: 2 },
            16: { potency: 3, striking: 2 },
            19: { potency: 3, striking: 3 }
        },
        armor: {
            5: { potency: 1, resilient: 0 },
            8: { potency: 1, resilient: 1 },
            11: { potency: 2, resilient: 1 },
            14: { potency: 2, resilient: 2 },
            18: { potency: 3, resilient: 2 },
            20: { potency: 3, resilient: 3 }
        }
    },

    // Метки для отображения рун в UI
    RUNE_LABELS: {
        weapon: {
            potency: { 0: "—", 1: "+1 Weapon Potency", 2: "+2 Weapon Potency", 3: "+3 Weapon Potency" },
            striking: { 0: "—", 1: "Striking", 2: "Greater Striking", 3: "Major Striking" }
        },
        armor: {
            potency: { 0: "—", 1: "+1 Armor Potency", 2: "+2 Armor Potency", 3: "+3 Armor Potency" },
            resilient: { 0: "—", 1: "Resilient", 2: "Greater Resilient", 3: "Major Resilient" }
        }
    },

    // Кэш для распарсенных предметов (чтобы не парсить каждый раз при ререндере)
    _parsedEquipmentCache: [],

    /**
     * Парсит HTML описание подкласса и ищет секцию снаряжения
     */
    parseEquipmentFromDescription: function (htmlString) {
        const foundItems = [];

        // 1. Находим секцию "Снаряжение" (Equipment)
        // Ищем от <h2>Снаряжение...</h2> до следующего <h2> или конца
        const sectionRegex = /<h2>\s*(Снаряжение|Equipment).*?<\/h2>([\s\S]*?)(?=<h2>|$)/i;
        const match = htmlString.match(sectionRegex);

        if (!match) return [];
        const content = match[2];

        // 2. Разбиваем на строки <p>
        const lines = content.split(/<\/p>/i);

        lines.forEach(line => {
            // Ищем категорию (жирный текст в начале строки)
            // <strong>Оружие:</strong> ...
            const categoryMatch = line.match(/<strong>\s*(.*?)\s*:?\s*<\/strong>/i);
            const categoryName = categoryMatch ? categoryMatch[1].replace(":", "").trim() : "Предмет";

            // Ищем все UUID в этой строке
            const uuidRegex = /@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g;
            let itemMatch;
            const rowItems = [];

            while ((itemMatch = uuidRegex.exec(line)) !== null) {
                rowItems.push({
                    uuid: itemMatch[1],
                    name: itemMatch[2] || "Unknown Item",
                    type: this._guessType(itemMatch[1])
                });
            }

            if (rowItems.length > 0) {
                foundItems.push({
                    category: categoryName,
                    options: rowItems
                });
            }
        });

        return foundItems;
    },

    _guessType: function (uuid) {
        if (uuid.includes("equipment")) return "equipment";
        return "item";
    },

    /**
     * Генерирует строку с описанием применяемых рун для уровня
     */
    _getRuneSummaryHTML: function (level) {
        const lvl = parseInt(level);
        const wRunes = this.getRuneStats(lvl, "weapon");
        const aRunes = this.getRuneStats(lvl, "armor");

        const parts = [];

        // Оружие
        const wParts = [];
        if (wRunes.potency > 0) wParts.push(this.RUNE_LABELS.weapon.potency[wRunes.potency]);
        if (wRunes.striking > 0) wParts.push(this.RUNE_LABELS.weapon.striking[wRunes.striking]);
        if (wParts.length > 0) parts.push(`<b>⚔ Оружие:</b> ${wParts.join(", ")}`);

        // Броня
        const aParts = [];
        if (aRunes.potency > 0) aParts.push(this.RUNE_LABELS.armor.potency[aRunes.potency]);
        if (aRunes.resilient > 0) aParts.push(this.RUNE_LABELS.armor.resilient[aRunes.resilient]);
        if (aParts.length > 0) parts.push(`<b>🛡 Броня:</b> ${aParts.join(", ")}`);

        if (parts.length === 0) return `<span style="color:#999;">Нет рун для уровня ${lvl}</span>`;
        return parts.join("<br>");
    },

    /**
     * Генерирует HTML для вкладки
     */
    getTabHTML: function (parsedItems, level) {
        if (!parsedItems || parsedItems.length === 0) {
            return `<div class="monster-maker-container">
                <div class="header-row"><h3>Снаряжение</h3></div>
                <p style="padding:10px; font-style:italic; color:#777;">Нет рекомендованного снаряжения для выбранного подкласса.</p>
            </div>`;
        }

        const runeSummary = this._getRuneSummaryHTML(level);

        let html = `
        <div class="monster-maker-container">
            <div class="header-row">
                <h3>Снаряжение (Уровень ${level})</h3>
            </div>
            <div style="margin: 5px 0 10px; padding: 6px 10px; background: rgba(111, 66, 193, 0.08); border-left: 3px solid #6f42c1; border-radius: 3px; font-size: 0.9em;">
                <div style="font-weight:bold; margin-bottom:3px;">Фундаментальные руны:</div>
                ${runeSummary}
            </div>
            <div class="equipment-list" style="margin-top:10px;">
        `;

        parsedItems.forEach((row, index) => {
            html += `
            <div class="form-group" style="background: rgba(0,0,0,0.03); padding: 5px; border-radius: 3px; border: 1px solid #ccc; margin-bottom: 5px;">
                <label>${row.category}</label>
                <select name="equipment_row_${index}" class="equipment-select" style="width:100%;">
            `;

            row.options.forEach(opt => {
                html += `<option value="${opt.uuid}">${opt.name}</option>`;
            });

            html += `</select></div>`;
        });

        html += `</div></div>`;
        return html;
    },

    /**
     * Получает актуальные данные рун для уровня (числовые значения)
     * Возвращает: { potency: 0-3, striking: 0-3 } для weapon
     *             { potency: 0-3, resilient: 0-3 } для armor
     */
    getRuneStats: function (level, type) {
        const table = this.RUNES_TABLE[type];
        if (!table) return { potency: 0, striking: 0, resilient: 0 };

        let best = { potency: 0, striking: 0, resilient: 0 };
        const lvl = parseInt(level);

        for (const [l, data] of Object.entries(table)) {
            if (lvl >= parseInt(l)) {
                if (data.potency !== undefined) best.potency = data.potency;
                if (data.striking !== undefined) best.striking = data.striking;
                if (data.resilient !== undefined) best.resilient = data.resilient;
            }
        }
        return best;
    },

    /**
     * Основная функция для получения готовых предметов с рунами.
     * Применяет руны в формате system.runes (PF2e миграция 907+):
     *   weapon: system.runes = { potency: 0-4, striking: 0-4, property: [] }
     *   armor:  system.runes = { potency: 0-4, resilient: 0-4, property: [] }
     */
    getFinalItems: async function (html, level) {
        const items = [];
        const selects = html.find(".equipment-select");

        for (let i = 0; i < selects.length; i++) {
            const uuid = $(selects[i]).val();
            if (!uuid) continue;

            try {
                const item = await fromUuid(uuid);
                if (item) {
                    const itemData = item.toObject();

                    // Применяем руны в новом формате (system.runes)
                    if (itemData.type === "weapon") {
                        const runes = this.getRuneStats(level, "weapon");
                        itemData.system.runes = {
                            potency: runes.potency,
                            striking: runes.striking,
                            property: itemData.system.runes?.property || []
                        };
                    }
                    else if (itemData.type === "armor") {
                        const runes = this.getRuneStats(level, "armor");
                        itemData.system.runes = {
                            potency: runes.potency,
                            resilient: runes.resilient,
                            property: itemData.system.runes?.property || []
                        };
                    }

                    items.push(itemData);
                }
            } catch (e) {
                console.error(`Error loading equipment ${uuid}:`, e);
            }
        }

        return items;
    }
};