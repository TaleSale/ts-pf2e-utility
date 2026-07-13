// constructed-creature-class.js

window.ConstructedCreatureClass = {
    // Основные классы
    TEMPLATES: {
        alchemist: { label: "Алхимик", stats: { perception: "low", crafting: "high", int: "high", dex: "moderate", str: "moderate", hp: "moderate", strikeBonus: "moderate", strikeDamage: "moderate" } },
        barbarian: { label: "Варвар", stats: { athletics: "high", str: "high", con: "high", ac: "high", fort: "high", hp: "high", strikeBonus: "moderate", strikeDamage: "extreme" } },
        bard: { label: "Бард", stats: { occultism: "moderate", perception: "high", cha: "high", fort: "low", wil: "high", hp: "moderate", strikeBonus: "low", spellcasting: "high" } },
        champion: { label: "Чемпион", stats: { religion: "moderate", perception: "low", str: "high", cha: "moderate", ac: "extreme", ref: "low", strikeBonus: "moderate", strikeDamage: "high" } },
        cleric: { label: "Жрец", stats: { religion: "high", perception: "high", wis: "high", ac: "low", fort: "low", wil: "high", hp: "moderate", strikeBonus: "low", spellcasting: "high" } },
        druid: { label: "Друид", stats: { nature: "high", perception: "high", wis: "high", wil: "high", hp: "moderate", strikeBonus: "low", spellcasting: "high" } },
        fighter: { label: "Воин", stats: { athletics: "high", str: "high", ac: "high", wil: "low", strikeBonus: "high", strikeDamage: "high" } },
        investigator: { label: "Следователь", stats: { society: "high", perception: "high", int: "high", fort: "low", wil: "high", hp: "moderate", strikeBonus: "moderate", strikeDamage: "moderate" } },
        monk: { label: "Монах", stats: { athletics: "high", dex: "high", wis: "moderate", ac: "high", strikeBonus: "moderate", strikeDamage: "high" } },
        ranger: { label: "Следопыт", stats: { nature: "moderate", survival: "moderate", perception: "high", str: "high", ac: "high", strikeBonus: "moderate", strikeDamage: "high" } },
        rogue: { label: "Плут", stats: { stealth: "high", thievery: "high", perception: "high", dex: "high", ac: "high", fort: "low", ref: "high", hp: "moderate", strikeBonus: "moderate", strikeDamage: "high" } },
        sorcerer: { label: "Чародей", stats: { perception: "low", cha: "high", ac: "low", fort: "low", hp: "low", strikeBonus: "low", spellcasting: "high" } },
        wizard: { label: "Волшебник", stats: { arcana: "high", perception: "low", int: "high", ac: "low", fort: "low", hp: "low", strikeBonus: "low", spellcasting: "high" } }
    },

    // Подклассы
    ROGUE_RACKETS: {
        thief: { name: "Вор", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.MSkvpjCBdQQzTFjS" },
        ruffian: { name: "Головорез", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.HZ0afEEHohBTNPWK" },
        scoundrel: { name: "Негодяй", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.cLsfqrEO4CJZxg7S" },
        poisoner: { name: "Отравитель", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.GifPKUhuNoG04Ri3" },
        trickster: { name: "Трикстер", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.V5JyVniSAHq4ZhRI" }
    },
    FIGHTER_STYLES: {
        two_weapon: { name: "Два Оружия", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.XQDq55ou6cabed0J" },
        two_handed: { name: "Двуручное Оружие", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.8aH16UNA0u3vjIzX" },
        free_hand: { name: "Оружие + Рука", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.ZEIWD18j5og83pUU" },
        shield: { name: "Щит", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.QxU9NadzoIX6Iyhp" },
        ranged: { name: "Стрелок", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.oqLJR68rMsZme8tB" }
    },
    SORCERER_BLOODLINES: {
        devil: { name: "Дьявол", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.794YhEOli3n5tTcH" },
        demon: { name: "Демон", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.oA7dru9kLKghzeKE" },
        aberration: { name: "Абберация", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.dXCoYyILnxOeEnQm" },
        fire: { name: "Стихия Огня", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.PJ8exEjPIGcYx95p" },
        shadow: { name: "Теневой", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.dwIS1ACPI1PgWMzR" },
        fey: { name: "Фея", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.Uz6fPzf6BV9fVmUV" }
    },

    _subclassCache: {},

    getOptionsHTML: function (className) {
        let label = "";
        let dataObj = null;
        let color = "";

        if (className === 'rogue') { label = "Специализация Плута:"; dataObj = this.ROGUE_RACKETS; color = "#e05297"; }
        else if (className === 'fighter') { label = "Стиль Боя Воина:"; dataObj = this.FIGHTER_STYLES; color = "#a02c2c"; }
        else if (className === 'sorcerer') { label = "Кровная Линия Чародея:"; dataObj = this.SORCERER_BLOODLINES; color = "#6f42c1"; }

        if (dataObj) {
            const options = Object.entries(dataObj).map(([key, val]) => `<option value="${key}">${val.name}</option>`).join("");
            return `
            <div style="display:flex; flex-direction:column; flex:1; height:100%;">
                <div class="class-suboption-block" style="margin-top: 10px; padding: 5px; background: rgba(0,0,0,0.03); border-left: 3px solid ${color}; border-radius: 3px; flex:0 0 auto;">
                    <label style="font-weight:bold; display:block;">${label}</label>
                    <select id="mm-subclass-select" class="subclass-select" style="width: 100%; margin-top: 5px;">
                        <option value="none">-- Выберите --</option>
                        ${options}
                    </select>
                </div>
                <div id="mm-subclass-desc" class="enriched-desc" style="display:none;"></div>
            </div>`;
        }
        return "";
    },

    activateListeners: function (html, updateCallback) {
        const self = this;
        html.find("#mm-subclass-select").change(async function () {
            const key = $(this).val();
            const className = html.closest(".monster-maker-container").find("#mm-class-select").val();
            const descBlock = html.find("#mm-subclass-desc");

            if (key !== "none") {
                descBlock.show().html("<em>Загрузка данных...</em>");
                const data = await self.getSubclassParsedData(className, key);
                const content = data.desc || "<p>Описание отсутствует.</p>";
                const enriched = await TextEditor.enrichHTML(content, { async: true });
                descBlock.html(enriched);
            } else {
                descBlock.hide().html("");
            }

            if (updateCallback) updateCallback();
        });
    },

    // Метод для получения "сырого" HTML описания (для парсера снаряжения)
    getSubclassRawDescription: async function (className, subKey) {
        const data = await this.getSubclassParsedData(className, subKey);
        return data.desc || "";
    },

    getSubclassParsedData: async function (className, subKey) {
        const cacheKey = `${className}_${subKey}`;
        if (this._subclassCache[cacheKey]) return this._subclassCache[cacheKey];

        let result = { stats: {}, lores: [], items: [], desc: "" };
        let uuid = null;

        if (className === 'rogue' && this.ROGUE_RACKETS[subKey]) uuid = this.ROGUE_RACKETS[subKey].uuid;
        else if (className === 'fighter' && this.FIGHTER_STYLES[subKey]) uuid = this.FIGHTER_STYLES[subKey].uuid;
        else if (className === 'sorcerer' && this.SORCERER_BLOODLINES[subKey]) uuid = this.SORCERER_BLOODLINES[subKey].uuid;

        if (uuid) {
            try {
                const item = await fromUuid(uuid);
                if (item) {
                    result.desc = item.system.description.value; // Сохраняем полное описание
                    result.items.push(item.toObject());
                    if (window.ConstructedCreatureParser) {
                        const parsed = window.ConstructedCreatureParser.parseDescription(result.desc);
                        result.stats = parsed.stats;
                        result.lores = parsed.lores;
                    }
                }
            } catch (e) { console.error(e); }
        }
        this._subclassCache[cacheKey] = result;
        return result;
    }
};