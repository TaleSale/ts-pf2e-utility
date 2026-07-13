// constructed-creature-other.js
// Вкладка "Другое" — дополнительные корректировки (Общества, Нежити, Отряда, Монструозные)
// Корректировки парсятся аналогично Родословной/Классу — описание разбирается через ConstructedCreatureParser,
// статы влияют на финальный статблок, а сам предмет добавляется на актора для обработки rules-элементов PF2e.

window.ConstructedCreatureOther = {

    // Категории корректировок.
    // folderIds — ID папок в компендиуме Build, содержащих предметы корректировок.
    CATEGORIES: {
        societies: {
            label: "Общества",
            icon: "fa-landmark",
            folderIds: ["kITynCzMDhr6ZHMT"]
        },
        monstrous: {
            label: "Монструозные",
            icon: "fa-dragon",
            folderIds: ["wL0i2c1rcr2Nlpou"]
        },
        undead: {
            label: "Нежити",
            icon: "fa-skull",
            folderIds: ["TaofBCzSKT40eKQt"]
        },
        troop: {
            label: "Отряда",
            icon: "fa-users",
            folderIds: ["YkE7doORIOczF4Rb"]
        }
    },

    // Кэш загруженных индексов из компендиума
    _indexCache: null,
    // Кэш спарсенных данных предметов (uuid -> {stats, lores, items, desc})
    _parsedCache: {},

    /**
     * Загружает все предметы корректировок из компендиума Build, группируя по категории.
     * Возвращает: { societies: [{uuid, name, id}], undead: [...], troop: [...], monstrous: [...] }
     */
    async loadAdjustments() {
        if (this._indexCache) return this._indexCache;

        const result = {};
        for (const key of Object.keys(this.CATEGORIES)) {
            result[key] = [];
        }

        try {
            const pack = game.packs.get("pf2e-ts-adv-v2.Build");
            if (!pack) {
                console.warn("ConstructedCreatureOther: Компендиум pf2e-ts-adv-v2.Build не найден");
                this._indexCache = result;
                return result;
            }

            // Загружаем индекс со всеми полями
            const index = await pack.getIndex({ fields: ["folder", "name", "type", "system.slug"] });

            // Собираем все ID папок по категориям (для быстрого поиска)
            const folderToCategory = {};
            for (const [catKey, catData] of Object.entries(this.CATEGORIES)) {
                for (const fId of catData.folderIds) {
                    folderToCategory[fId] = catKey;
                }
            }

            for (const entry of index) {
                if (entry.type !== "action") continue;

                const cat = folderToCategory[entry.folder];
                if (!cat) continue;

                // Фильтруем — берем только предметы с «Корректировк» в названии
                if (!entry.name.includes("Корректировк")) continue;

                result[cat].push({
                    uuid: `Compendium.pf2e-ts-adv-v2.Build.Item.${entry._id}`,
                    name: entry.name.replace(/^√\s*/, "").trim(),
                    id: entry._id
                });
            }
        } catch (e) {
            console.error("ConstructedCreatureOther: Ошибка загрузки корректировок:", e);
        }

        // Сортируем по имени
        for (const key of Object.keys(result)) {
            result[key].sort((a, b) => a.name.localeCompare(b.name, "ru"));
        }

        this._indexCache = result;
        return result;
    },

    /**
     * Загружает и парсит данные конкретного предмета корректировки по UUID.
     * Аналогично ancestry.getParsedData() и class.getSubclassParsedData().
     * Возвращает: { stats, lores, items, desc, equipment }
     */
    async getParsedData(uuid) {
        if (!uuid) return { stats: {}, lores: [], items: [], desc: "", equipment: [] };
        if (this._parsedCache[uuid]) return this._parsedCache[uuid];

        let result = { stats: {}, lores: [], items: [], desc: "", equipment: [] };

        try {
            const item = await fromUuid(uuid);
            if (item) {
                result.desc = item.system.description.value;
                result.items.push(item.toObject());

                // Парсим описание через общий парсер (извлекаем навыки/статы)
                if (window.ConstructedCreatureParser) {
                    const parsed = window.ConstructedCreatureParser.parseDescription(result.desc);
                    result.stats = parsed.stats;
                    result.lores = parsed.lores;
                }

                // Парсим снаряжение из описания (аналогично подклассам)
                if (window.ConstructedCreatureEquipment) {
                    result.equipment = window.ConstructedCreatureEquipment.parseEquipmentFromDescription(result.desc);
                }
            }
        } catch (e) {
            console.error(`ConstructedCreatureOther: Ошибка загрузки ${uuid}:`, e);
            result.desc = "Ошибка загрузки.";
        }

        this._parsedCache[uuid] = result;
        return result;
    },

    /**
     * Возвращает объединённое снаряжение из всех выбранных корректировок.
     * Формат: массив [{category, options}] — такой же, как parseEquipmentFromDescription.
     */
    async getAllParsedEquipment(html) {
        const allEquipment = [];
        const checkedCategories = html.find(".other-category-cb:checked");

        for (let i = 0; i < checkedCategories.length; i++) {
            const $category = $(checkedCategories[i]).closest(".other-category");
            const $select = $category.find(".other-adjustment-select");
            const uuid = $select.val();
            if (!uuid) continue;

            const data = await this.getParsedData(uuid);
            if (data.equipment && data.equipment.length > 0) {
                allEquipment.push(...data.equipment);
            }
        }

        return allEquipment;
    },

    /**
     * Возвращает объединённые спарсенные данные всех выбранных корректировок.
     * Используется в _updateStatsUI для влияния на статблок.
     * Возвращает: { stats: {}, lores: [] } — объединение всех выбранных.
     */
    async getAllParsedStats(html) {
        const combined = { stats: {}, lores: [] };
        const checkedCategories = html.find(".other-category-cb:checked");

        for (let i = 0; i < checkedCategories.length; i++) {
            const $category = $(checkedCategories[i]).closest(".other-category");
            const $select = $category.find(".other-adjustment-select");
            const uuid = $select.val();
            if (!uuid) continue;

            const data = await this.getParsedData(uuid);

            // Объединяем статы — берём наивысший ранг
            for (const [key, rank] of Object.entries(data.stats)) {
                const RANKS = ["none", "terrible", "low", "moderate", "high", "extreme"];
                const existing = combined.stats[key] || "none";
                if (RANKS.indexOf(rank) > RANKS.indexOf(existing)) {
                    combined.stats[key] = rank;
                }
            }

            // Объединяем lores (без дубликатов)
            for (const lore of data.lores) {
                if (!combined.lores.includes(lore)) {
                    combined.lores.push(lore);
                }
            }
        }

        return combined;
    },

    /**
     * Генерирует HTML вкладки «Другое»
     */
    async getTabHTML() {
        const adjustments = await this.loadAdjustments();

        let html = `
        <div class="monster-maker-container">
            <div class="header-row"><h3>Дополнительные корректировки</h3></div>
            <p class="flavor-text" style="margin-bottom:10px;">
                Выберите категории корректировок, которые будут применены к существу.
                Статы из описания корректировок влияют на финальный статблок.
            </p>
        `;

        for (const [catKey, catData] of Object.entries(this.CATEGORIES)) {
            const items = adjustments[catKey] || [];

            html += `
            <div class="other-category" style="margin-bottom: 12px;">
                <label style="display:flex; align-items:center; gap:6px; padding:4px 8px; background:rgba(0,0,0,0.05); border-radius:4px; border-left:3px solid #6f42c1; cursor:pointer;"
                       onmouseover="this.style.background='rgba(111,66,193,0.08)'"
                       onmouseout="this.style.background='rgba(0,0,0,0.05)'">
                    <input type="checkbox" class="other-category-cb"
                           data-category="${catKey}"
                           style="margin:0; accent-color:#6f42c1;" />
                    <i class="fas ${catData.icon}" style="color:#6f42c1; width:16px; text-align:center;"></i>
                    <strong>${catData.label}</strong>
                    <span style="color:#999; font-size:0.85em;">(${items.length})</span>
                </label>
            `;

            if (items.length === 0) {
                html += `<div class="other-select-wrapper" style="display:none; padding:4px 10px; margin-top:4px;">
                    <p style="font-style:italic; color:#999; font-size:0.9em;">Нет доступных корректировок в этой категории.</p>
                </div>`;
            } else {
                let options = `<option value="">-- Выберите корректировку --</option>`;
                for (const item of items) {
                    options += `<option value="${item.uuid}" data-item-id="${item.id}">${item.name}</option>`;
                }
                html += `
                <div class="other-select-wrapper" style="display:none; padding:4px 10px; margin-top:4px;">
                    <select class="other-adjustment-select" data-category="${catKey}" style="width:100%;">
                        ${options}
                    </select>
                    <div class="other-adjustment-desc enriched-desc" style="display:none;"></div>
                </div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
        return html;
    },

    /**
     * Активация обработчиков событий
     */
    activateListeners(html, updateCallback) {
        const self = this;

        // Показываем/скрываем выпадающий список при выборе категории
        html.find(".other-category-cb").change(function () {
            const $category = $(this).closest(".other-category");
            const $wrapper = $category.find(".other-select-wrapper");
            if (this.checked) {
                $wrapper.slideDown(150);
                $(this).closest("label").css("font-weight", "bold");
            } else {
                $wrapper.slideUp(150);
                $wrapper.find("select").val("");
                $wrapper.find(".other-adjustment-desc").hide().html("");
                $(this).closest("label").css("font-weight", "normal");
            }
            // Обновляем статблок
            if (updateCallback) updateCallback();
        });

        // При смене выбора в выпадающем списке — загружаем описание и обновляем статы
        html.find(".other-adjustment-select").change(async function () {
            const uuid = $(this).val();
            const $desc = $(this).siblings(".other-adjustment-desc");

            if (uuid) {
                $desc.show().html("<em>Загрузка...</em>");
                const data = await self.getParsedData(uuid);
                const enriched = await TextEditor.enrichHTML(data.desc, { async: true });
                $desc.html(enriched || "Нет описания.");
            } else {
                $desc.hide().html("");
            }

            // Обновляем статблок
            if (updateCallback) updateCallback();
        });
    },

    /**
     * Собирает выбранные корректировки и возвращает массив предметов для создания.
     * Загружает каждый предмет из компендиума по UUID и возвращает его toObject().
     */
    async getSelectedItems(html) {
        const items = [];
        const checkedCategories = html.find(".other-category-cb:checked");

        for (let i = 0; i < checkedCategories.length; i++) {
            const $category = $(checkedCategories[i]).closest(".other-category");
            const $select = $category.find(".other-adjustment-select");
            const uuid = $select.val();
            if (!uuid) continue;

            const data = await this.getParsedData(uuid);
            if (data.items && data.items.length) {
                items.push(...data.items);
            }
        }

        return items;
    },

    /**
     * Сброс кэша (при необходимости перезагрузить)
     */
    clearCache() {
        this._indexCache = null;
        this._parsedCache = {};
    }
};
