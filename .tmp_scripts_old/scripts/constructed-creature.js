// ==================================================================
// 1. ПАРСЕР ОПИСАНИЙ (Utility)
// ==================================================================
window.ConstructedCreatureParser = {
    KEY_MAP: {
        // Характеристики
        "Сила": "str", "Strength": "str", "Ловкость": "dex", "Dexterity": "dex", "Телосложение": "con", "Constitution": "con",
        "Интеллект": "int", "Intelligence": "int", "Мудрость": "wis", "Wisdom": "wis", "Харизма": "cha", "Charisma": "cha",

        // Защита
        "КБ": "ac", "AC": "ac", "Класс Брони": "ac", "Armor Class": "ac",
        "Стойкость": "fort", "Fortitude": "fort", "Рефлекс": "ref", "Reflex": "ref", "Воля": "wil", "Will": "wil",
        "Восприятие": "perception", "Perception": "perception", "ОЗ": "hp", "HP": "hp", "Здоровье": "hp", "Hit Points": "hp",

        // Магия
        "Закл DC": "spellcasting", "Закл. DC": "spellcasting", "Spell DC": "spellcasting", "Spellcasting DC": "spellcasting", "Spellcasting": "spellcasting",

        // Навыки
        "Акробатика": "acrobatics", "Acrobatics": "acrobatics", "Аркана": "arcana", "Arcana": "arcana", "Атлетика": "athletics", "Athletics": "athletics",
        "Ремесло": "crafting", "Crafting": "crafting", "Обман": "deception", "Deception": "deception", "Дипломатия": "diplomacy", "Diplomacy": "diplomacy",
        "Запугивание": "intimidation", "Intimidation": "intimidation", "Медицина": "medicine", "Medicine": "medicine", "Природа": "nature", "Nature": "nature",
        "Оккультизм": "occultism", "Occultism": "occultism", "Выступление": "performance", "Performance": "performance", "Религия": "religion", "Religion": "religion",
        "Общество": "society", "Society": "society", "Скрытность": "stealth", "Stealth": "stealth", "Выживание": "survival", "Survival": "survival", "Воровство": "thievery", "Thievery": "thievery"
    },
    RANK_MAP: {
        "Экстремальный": "extreme", "Extreme": "extreme", "Высокий": "high", "Высокая": "high", "High": "high",
        "Средний": "moderate", "Средняя": "moderate", "Moderate": "moderate", "Низкий": "low", "Низкая": "low", "Low": "low"
    },
    parseDescription: function (htmlString) {
        const stats = {};
        const lores = [];
        // Регулярка ищет: <strong>Ранг:</strong> Значения
        const regex = /<strong>\s*(Высокий|Высокая|High|Средний|Средняя|Moderate|Низкий|Низкая|Low)\s*:?\s*<\/strong>\s*([^<]+)/gi;

        let match;
        while ((match = regex.exec(htmlString)) !== null) {
            const rankText = match[1].trim();
            const content = match[2].trim();

            let rankId = null;
            for (const [key, val] of Object.entries(this.RANK_MAP)) {
                if (key.toLowerCase() === rankText.toLowerCase()) { rankId = val; break; }
            }
            if (!rankId) continue;

            const items = content.split(/,|;/).map(s => s.trim());
            items.forEach(itemStr => {
                let foundKey = null;
                // Убираем суффиксы для чистого поиска
                const cleanStr = itemStr.replace(/Lore|Знание/i, "").trim();

                for (const [name, id] of Object.entries(this.KEY_MAP)) {
                    if (itemStr.toLowerCase() === name.toLowerCase() || cleanStr.toLowerCase() === name.toLowerCase()) {
                        foundKey = id;
                        break;
                    }
                }

                if (foundKey) {
                    stats[foundKey] = rankId;
                } else {
                    // Если это не системный навык/стат, считаем это Lore
                    let cleanLore = itemStr.replace(/\.$/, "").trim();
                    if (cleanLore.length > 2) {
                        lores.push(cleanLore);
                    }
                }
            });
        }
        return { stats, lores };
    }
};

// ==================================================================
// 2. КОНСТАНТЫ И ДАННЫЕ
// ==================================================================
const PROFICIENCY_RANKS = ["none", "terrible", "low", "moderate", "high", "extreme"];
const PROFICIENCY_LABELS = { extreme: "Экстремальный", high: "Высокий", moderate: "Средний", low: "Низкий", terrible: "Ужасный", abysmal: "Ничтожный", none: "Нет" };
const SKILL_LIST = { acrobatics: "Акробатика", arcana: "Аркана", athletics: "Атлетика", crafting: "Ремесло", deception: "Обман", diplomacy: "Дипломатия", intimidation: "Запугивание", medicine: "Медицина", nature: "Природа", occultism: "Оккультизм", performance: "Выступление", religion: "Религия", society: "Общество", stealth: "Скрытность", survival: "Выживание", thievery: "Воровство" };

const MONSTER_TEMPLATES = {
    brute: { label: "Громила", stats: { perception: "low", str: "extreme", con: "high", dex: "low", int: "low", wis: "low", cha: "low", ac: "low", fort: "high", ref: "low", wil: "low", hp: "high", strikeBonus: "moderate", strikeDamage: "extreme" } },
    magicalStriker: { label: "Магический ударник", stats: { strikeBonus: "high", strikeDamage: "high", spellcasting: "high" } },
    skirmisher: { label: "Застрельщик", stats: { dex: "high", fort: "low", ref: "high" } },
    sniper: { label: "Снайпер", stats: { perception: "high", dex: "high", fort: "low", ref: "high", hp: "low", strikeBonus: "high", strikeDamage: "high" } },
    soldier: { label: "Солдат", stats: { str: "high", ac: "high", fort: "high", strikeBonus: "high", strikeDamage: "high" } },
    spellcaster: { label: "Заклинатель", stats: { int: "high", wis: "high", cha: "high", fort: "low", wil: "high", hp: "low", strikeBonus: "low", spellcasting: "high" } }
};

// ==================================================================
// 3. HTML ШАБЛОН
// ==================================================================
const CONSTRUCTED_CREATURE_TEMPLATE = `
<div class="constructed-creature-wrapper">
    <nav class="sheet-tabs tabs" data-group="primary">
        <a class="item tab-link-template" data-tab="template">Шаблон</a>
        <a class="item tab-link-class" data-tab="class">Класс</a>
        <a class="item tab-link-ancestry" data-tab="ancestry">Родословная</a>
        <a class="item" data-tab="equipment">Снаряжение</a>
        <a class="item" data-tab="other">Другое</a>
    </nav>
    <div class="global-controls">
        <div class="form-group-row">
            <div class="form-group"><label>Имя существа</label><input type="text" name="creatureName" value="Новое Существо" /></div>
            <div class="form-group"><label>Уровень</label><select name="level" id="mm-level-select"><option value="-1">-1</option><option value="0">0</option><option value="1" selected>1</option>${Array.from({ length: 23 }, (_, i) => `<option value="${i + 2}">${i + 2}</option>`).join('')}</select></div>
            <div class="form-group" style="flex:0 0 auto; display:flex; align-items:flex-end;">
                <button type="button" id="mm-reset-btn" class="reset-btn-small" title="Сбросить все"><i class="fas fa-undo"></i></button>
            </div>
        </div>
    </div>
    <section class="sheet-body">
        <div class="tab tab-content-template" data-tab="template">
            <div class="monster-maker-container">
                <p class="flavor-text">
                    <span style="color:#2c5aa0;font-weight:bold;">Синий</span> = Шаблон. 
                    <span style="color:#a02c2c;font-weight:bold;">Красный</span> = Класс. 
                    <span style="color:#6f42c1;font-weight:bold;">Фиолетовый</span> = Родословная.
                    <span style="color:#b8256e;font-weight:bold;">Розовый</span> = Подкласс.
                    <span style="color:#2ea043;font-weight:bold;">Зелёный</span> = Другое.
                </p>
                <div class="form-group"><label>Роль</label><select id="mm-template-select"><option value="none">-- Выберите --</option>${Object.entries(MONSTER_TEMPLATES).map(([key, val]) => `<option value="${key}">${val.label}</option>`).join('')}</select></div>
                <hr>
                <div class="stats-container">${_generateStatBlockHTML('tpl')}</div>
            </div>
        </div>
        <div class="tab tab-content-class" data-tab="class">
            <div class="monster-maker-container">
                <div class="form-group"><label>Класс</label><select id="mm-class-select"><option value="none">-- Выберите --</option></select></div>
                <div id="class-options-container" style="display:flex; flex-direction:column; flex:1; height:100%;"></div>
            </div>
        </div>
        <div class="tab tab-content-ancestry" data-tab="ancestry"><div id="ancestry-tab-content" style="height:100%;"></div></div>
        <div class="tab" data-tab="equipment"><div id="equipment-tab-content" style="height:100%;"></div></div>
        <div class="tab" data-tab="other"><div id="other-tab-content" style="height:100%;"></div></div>
    </section>
    <div class="form-footer">
        <button type="button" id="mm-create-btn"><i class="fas fa-check"></i> СОЗДАТЬ СУЩЕСТВО</button>
    </div>
</div>`;

function _generateStatBlockHTML(prefix) {
    const selects = (lbl, name) => `<label>${lbl}: <select class="stat-select ${prefix}-stat" name="${name}"></select></label>`;
    return `
    <div class="stat-block"><h4>Характеристики</h4>${selects('Сила', 'str')}${selects('Ловкость', 'dex')}${selects('Телосложение', 'con')}${selects('Интеллект', 'int')}${selects('Мудрость', 'wis')}${selects('Харизма', 'cha')}</div>
    <div class="stat-block"><h4>Защита</h4>${selects('AC', 'ac')}${selects('HP', 'hp')}${selects('Стойкость', 'fort')}${selects('Рефлекс', 'ref')}${selects('Воля', 'wil')}${selects('Восприятие', 'perception')}</div>
    <div class="stat-block"><h4>Атака</h4>${selects('Атака', 'strikeBonus')}${selects('Урон', 'strikeDamage')}${selects('Закл. DC', 'spellcasting')}</div>
    <div class="skills-block-wrapper">
        <h4>Навыки</h4>
        <div class="skills-grid">
            ${Object.entries(SKILL_LIST).map(([k, l]) => `
                <div class="skill-cell">
                    <span>${l}</span>
                    <select class="stat-select skill-select ${prefix}-stat" name="${k}"></select>
                </div>
            `).join('')}
            <div id="lore-skills-container" class="lore-row" style="display:none;"></div>
        </div>
    </div>
    `;
}

// ==================================================================
// 4. ПРИЛОЖЕНИЕ (Application Class)
// ==================================================================
class ConstructedCreatureApp extends Application {
    static get defaultOptions() { return mergeObject(super.defaultOptions, { id: "constructed-creature-app", title: "Конструктор Существ", width: 900, height: 850, resizable: true, tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "template" }], classes: ["pf2e", "sheet"] }); }

    async _renderInner(data) {
        // Подключаем CSS если нет
        if (!document.getElementById("constructed-creature-css")) {
            const link = document.createElement("link");
            link.id = "constructed-creature-css";
            link.rel = "stylesheet";
            link.href = "modules/pf2e-monster-maker/scripts/constructed-creature.css";
            document.head.appendChild(link);
        }
        const $html = $(CONSTRUCTED_CREATURE_TEMPLATE);
        this._populateSelects($html);

        // Заполняем списки классов
        if (window.ConstructedCreatureClass) $html.find("#mm-class-select").append(Object.entries(window.ConstructedCreatureClass.TEMPLATES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''));
        // Заполняем вкладки из других модулей
        if (window.ConstructedCreatureAncestry) $html.find("#ancestry-tab-content").html(window.ConstructedCreatureAncestry.getTabHTML());
        if (window.ConstructedCreatureEquipment) $html.find("#equipment-tab-content").html(window.ConstructedCreatureEquipment.getTabHTML());

        // Инициализируем пустое состояние снаряжения
        $html.find("#equipment-tab-content").html("<div class='monster-maker-container'><p style='padding:10px;'>Выберите подкласс или корректировку со снаряжением.</p></div>");

        // Заполняем вкладку «Другое» (корректировки)
        if (window.ConstructedCreatureOther) {
            const otherHTML = await window.ConstructedCreatureOther.getTabHTML();
            $html.find("#other-tab-content").html(otherHTML);
        }

        return $html;
    }

    _populateSelects($html) {
        const opts = Object.entries(PROFICIENCY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        $html.find(".stat-select").each(function () {
            $(this).html(opts);
            $(this).val(($(this).hasClass("skill-select") || this.name === "spellcasting") ? "none" : "moderate");
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        const refresh = async () => { await this._updateStatsUI(html); };

        html.find("#mm-template-select").change(refresh);
        html.find("#mm-class-select").change(ev => {
            const cls = ev.target.value;
            const $cont = html.find("#class-options-container").empty();
            if (window.ConstructedCreatureClass && cls !== 'none') {
                $cont.html(window.ConstructedCreatureClass.getOptionsHTML(cls));
                window.ConstructedCreatureClass.activateListeners($cont, refresh);
            }
            refresh();
        });

        if (window.ConstructedCreatureAncestry) window.ConstructedCreatureAncestry.activateListeners(html, refresh);
        if (window.ConstructedCreatureOther) window.ConstructedCreatureOther.activateListeners(html, refresh);

        // Обновление снаряжения при смене уровня
        html.find("#mm-level-select").change(() => {
            this._updateEquipmentUI(html);
        });

        html.find("#mm-create-btn").click(async (e) => { e.preventDefault(); await this._createCreature(html); });
        html.find("#mm-reset-btn").click(() => {
            html.find("select").not("#mm-level-select").val("none");
            html.find("#class-options-container").empty();
            html.find("#mm-ancestry-family").val("none").trigger("change");
            refresh();
        });
    }

    formatLoreLabel(rawLore) {
        let name = rawLore.replace(/-/g, " ");
        name = name.replace(/lore/gi, "").trim();
        if (name.length > 0) {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }
        return name + " Lore";
    }

    // --- ОБНОВЛЕНИЕ UI (СТАТЫ И ЦВЕТА) ---
    async _updateStatsUI(html) {
        html.find('.stat-select').removeClass('select-highlight-tpl select-highlight-cls select-highlight-sub select-highlight-anc select-highlight-oth');
        const tplKey = html.find("#mm-template-select").val();
        const tplStats = (tplKey !== "none" && MONSTER_TEMPLATES[tplKey]) ? MONSTER_TEMPLATES[tplKey].stats : {};
        const clsKey = html.find("#mm-class-select").val();
        let clsStats = {};
        if (clsKey !== "none" && window.ConstructedCreatureClass) clsStats = window.ConstructedCreatureClass.TEMPLATES[clsKey].stats;

        let subStats = {}, ancStats = {}, ancLores = [], ancData = {}, othStats = {}, othLores = [];
        // Subclass
        if (window.ConstructedCreatureClass) {
            const subKey = html.find("#mm-subclass-select").val();
            if (subKey && subKey !== 'none') {
                const subData = await window.ConstructedCreatureClass.getSubclassParsedData(clsKey, subKey);
                subStats = subData.stats || {};
            }
        }

        // Ancestry
        if (window.ConstructedCreatureAncestry) {
            const ancUuid = window.ConstructedCreatureAncestry.getSelectedUUID(html);
            if (ancUuid) {
                ancData = await window.ConstructedCreatureAncestry.getParsedData(ancUuid);
                ancStats = ancData.stats || {};
                ancLores = ancData.lores || [];
            }
        }

        // Other (Корректировки) — парсим статы из выбранных корректировок
        if (window.ConstructedCreatureOther) {
            const othData = await window.ConstructedCreatureOther.getAllParsedStats(html);
            othStats = othData.stats || {};
            othLores = othData.lores || [];
        }

        // Рендеринг Lores (объединяем из Родословной и Корректировок)
        const allLores = [...ancLores];
        for (const lore of othLores) {
            if (!allLores.includes(lore)) allLores.push(lore);
        }
        const loreCont = html.find("#lore-skills-container").empty().hide();
        if (allLores.length > 0) {
            loreCont.show();
            const opts = Object.entries(PROFICIENCY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
            allLores.forEach(lore => {
                const displayName = this.formatLoreLabel(lore);
                const highlightCss = ancLores.includes(lore) ? 'select-highlight-anc' : 'select-highlight-oth';
                loreCont.append(`
                    <div class="lore-item">
                        <span>${displayName}</span>
                        <select class="stat-select ${highlightCss} lore-stat" name="lore_${lore}">${opts}</select>
                    </div>
                `);
            });
            loreCont.find("select").val("high");
        }

        // Рендеринг Статов
        html.find(".stat-select.tpl-stat").each(function () {
            const name = this.name;
            const isSkill = $(this).hasClass("skill-select");
            const isSpell = this.name === "spellcasting";
            const defVal = (isSkill || isSpell) ? "none" : "moderate";
            const vTpl = tplStats[name] || defVal;
            const vCls = clsStats[name] || "none";
            const vAnc = ancStats[name] || "none";
            const vSub = subStats[name] || "none";
            const vOth = othStats[name] || "none";

            const rTpl = PROFICIENCY_RANKS.indexOf(vTpl);
            const rCls = PROFICIENCY_RANKS.indexOf(vCls);
            const rAnc = PROFICIENCY_RANKS.indexOf(vAnc);
            const rSub = PROFICIENCY_RANKS.indexOf(vSub);
            const rOth = PROFICIENCY_RANKS.indexOf(vOth);

            let final = vTpl;
            let css = "";

            // ЛОГИКА: Если есть врожденные заклинания ИЛИ подкласс дает магию
            if (isSpell) {
                if (rSub > 0) {
                    final = vSub;
                    css = "select-highlight-sub";
                } else if (ancData.hasInnateSpells && rTpl === 0 && rCls === 0) {
                    final = "moderate";
                    css = "select-highlight-anc";
                } else {
                    if (rOth > rCls && rOth > rTpl) { final = vOth; css = "select-highlight-oth"; }
                    else if (rCls > rTpl) { final = vCls; css = "select-highlight-cls"; }
                    else { if (tplStats[name]) css = "select-highlight-tpl"; }
                }
            } else {
                if (rOth > rSub && rOth > rAnc && rOth > rCls && rOth > rTpl) { final = vOth; css = "select-highlight-oth"; }
                else if (rSub > rAnc && rSub > rCls && rSub > rTpl) { final = vSub; css = "select-highlight-sub"; }
                else if (rAnc > rCls && rAnc > rTpl) { final = vAnc; css = "select-highlight-anc"; }
                else if (rCls > rTpl) { final = vCls; css = "select-highlight-cls"; }
                else { if (tplStats[name]) css = "select-highlight-tpl"; }
            }

            $(this).val(final);
            if (css) $(this).addClass(css);
        });

        // Обновляем снаряжение после статов
        await this._updateEquipmentUI(html);
    }

    // --- ОБНОВЛЕНИЕ СНАРЯЖЕНИЯ ---
    async _updateEquipmentUI(html) {
        if (!window.ConstructedCreatureEquipment) return;

        const level = html.find("#mm-level-select").val();
        let classEquipment = [];
        let otherEquipment = [];

        // Снаряжение от подкласса
        if (window.ConstructedCreatureClass) {
            const clsName = html.find("#mm-class-select").val();
            const subKey = html.find("#mm-subclass-select").val();
            if (clsName && subKey && subKey !== "none") {
                const desc = await window.ConstructedCreatureClass.getSubclassRawDescription(clsName, subKey);
                classEquipment = window.ConstructedCreatureEquipment.parseEquipmentFromDescription(desc);
            }
        }

        // Снаряжение от корректировок (Другое) — приоритетнее
        if (window.ConstructedCreatureOther) {
            otherEquipment = await window.ConstructedCreatureOther.getAllParsedEquipment(html);
        }

        // Объединяем: Other перезаписывает одноимённые категории из класса
        const mergedMap = new Map();
        for (const row of classEquipment) {
            mergedMap.set(row.category, row);
        }
        for (const row of otherEquipment) {
            mergedMap.set(row.category, row); // перезаписывает если категория совпадает
        }
        const mergedEquipment = [...mergedMap.values()];

        if (mergedEquipment.length > 0) {
            const eqHtml = window.ConstructedCreatureEquipment.getTabHTML(mergedEquipment, level);
            html.find("#equipment-tab-content").html(eqHtml);
        } else {
            html.find("#equipment-tab-content").html("<div class='monster-maker-container'><p style='padding:10px;'>Выберите подкласс или корректировку со снаряжением.</p></div>");
        }
    }

    // ==================================================================
    // 5. СОЗДАНИЕ СУЩЕСТВА (Final Logic)
    // ==================================================================
    async _createCreature(html) {
        const name = html.find("input[name='creatureName']").val() || "Monster";
        const level = html.find("select[name='level']").val();
        const MONSTER_STATS = window.CC_MONSTER_STATS;
        if (!MONSTER_STATS) return;

        const finalStats = {};
        html.find(".stat-select.tpl-stat").each(function () { finalStats[this.name] = $(this).val(); });
        const getVal = (t, k) => { const r = finalStats[k]; if (!r || r === "none") return null; return MONSTER_STATS[t]?.[level]?.[r]; };

        // 1. АТРИБУТЫ
        const strMod = getVal("abilityScores", "str") || 0;
        const dexMod = getVal("abilityScores", "dex") || 0;
        const conMod = getVal("abilityScores", "con") || 0;
        const intMod = getVal("abilityScores", "int") || 0;
        const wisMod = getVal("abilityScores", "wis") || 0;
        const chaMod = getVal("abilityScores", "cha") || 0;
        const hpMax = getVal("hitPoints", "hp") || 10;
        const acVal = getVal("armorClass", "ac") || 10;
        const fortVal = getVal("perceptionSaves", "fort") || 0;
        const refVal = getVal("perceptionSaves", "ref") || 0;
        const willVal = getVal("perceptionSaves", "wil") || 0;
        const perVal = getVal("perceptionSaves", "perception") || 0;

        // 2. РОДОСЛОВНАЯ (Traits + Items)
        let ancestryTraits = [];
        let itemsToCreate = [];

        if (window.ConstructedCreatureAncestry) {
            const ancUuid = window.ConstructedCreatureAncestry.getSelectedUUID(html);
            if (ancUuid) {
                const ancData = await window.ConstructedCreatureAncestry.getParsedData(ancUuid);
                ancestryTraits = ancData.traits || [];
                if (ancData.items && ancData.items.length) itemsToCreate.push(...ancData.items);
            }
        }

        const actorData = {
            name: name, type: "npc",
            system: {
                details: { level: { value: parseInt(level) }, publication: { title: "Constructed Creature", authors: "", license: "OGL", remaster: true } },
                abilities: { str: { mod: strMod }, dex: { mod: dexMod }, con: { mod: conMod }, int: { mod: intMod }, wis: { mod: wisMod }, cha: { mod: chaMod } },
                attributes: { hp: { value: hpMax, max: hpMax }, ac: { value: acVal } },
                saves: { fortitude: { value: fortVal }, reflex: { value: refVal }, will: { value: willVal } },
                perception: { mod: perVal },
                skills: {},
                traits: { value: ancestryTraits }
            }
        };

        const actor = await Actor.create(actorData);
        if (!actor) return;

        // 3. НАВЫКИ
        const skillsUpdate = {};
        for (const k of Object.keys(SKILL_LIST)) {
            const rank = finalStats[k];
            if (rank && rank !== "none") {
                const val = MONSTER_STATS["skills"]?.[level]?.[rank];
                if (val !== undefined) skillsUpdate[`system.skills.${k}.base`] = Number(val);
            }
        }
        if (Object.keys(skillsUpdate).length > 0) await actor.update(skillsUpdate);

        // 4. LORE ПРЕДМЕТЫ
        html.find(".lore-stat").each((i, el) => {
            const rawLore = el.name.replace("lore_", "");
            const niceName = this.formatLoreLabel(rawLore);
            const rank = $(el).val();
            if (rank && rank !== "none") {
                const val = MONSTER_STATS["skills"]?.[level]?.[rank];
                if (val !== undefined) {
                    itemsToCreate.push({
                        name: niceName,
                        type: "lore",
                        img: "systems/pf2e/icons/default-icons/lore.svg",
                        system: { mod: { value: Number(val) }, proficient: { value: 0 } }
                    });
                }
            }
        });

        // 5. STRIKES & SPELLS
        const sBonus = getVal("strikeBonus", "strikeBonus");
        const sDmg = getVal("strikeDamage", "strikeDamage");
        if (sBonus && sDmg) itemsToCreate.push({ name: "Удар", type: "melee", system: { bonus: { value: sBonus }, damageRolls: { "0": { damage: sDmg, damageType: "bludgeoning" } }, weaponType: { value: "melee" } } });

        const spellDC = getVal("spellcasting", "spellcasting");
        if (spellDC) itemsToCreate.push({ name: "Заклинания", type: "spellcastingEntry", system: { spelldc: { value: spellDC, dc: spellDC + 10 }, tradition: "arcane", prepared: { value: "innate" }, showUnpreparedSpells: { value: true } } });

        // 6. ПОДКЛАССЫ
        if (window.ConstructedCreatureClass) {
            const clsName = html.find("#mm-class-select").val();
            const subKey = html.find("#mm-subclass-select").val();
            if (subKey && subKey !== 'none') {
                const subData = await window.ConstructedCreatureClass.getSubclassParsedData(clsName, subKey);
                if (subData.items && subData.items.length) itemsToCreate.push(...subData.items);
            }
        }

        // 7. СНАРЯЖЕНИЕ
        if (window.ConstructedCreatureEquipment) {
            const eqItems = await window.ConstructedCreatureEquipment.getFinalItems(html.find("#equipment-tab-content"), level);
            if (eqItems.length > 0) itemsToCreate.push(...eqItems);
        }

        // 8. ДОПОЛНИТЕЛЬНЫЕ КОРРЕКТИРОВКИ (Другое)
        if (window.ConstructedCreatureOther) {
            const otherItems = await window.ConstructedCreatureOther.getSelectedItems(html);
            if (otherItems.length > 0) itemsToCreate.push(...otherItems);
        }

        if (itemsToCreate.length > 0) await actor.createEmbeddedDocuments("Item", itemsToCreate);

        this.close();
        actor.sheet.render(true);
        ui.notifications.info(`Существо "${name}" успешно создано!`);
    }
}

// ==================================================================
// 6. HOOK
// ==================================================================
Hooks.on("renderActorDirectory", (app, html, data) => {
    const $html = $(html);
    const footer = $html.find(".directory-footer");
    if (footer.length === 0) return;
    if ($html.find(".constructed-creature-btn").length > 0) return;
    const myButton = $(`<button type="button" class="constructed-creature-btn"><i class="fas fa-book"></i> Конструктор Существ</button>`);
    myButton.on("click", (e) => { e.preventDefault(); new ConstructedCreatureApp().render(true); });
    const compendiumBtn = footer.find("[data-action='openCompendiumBrowser']");
    if (compendiumBtn.length > 0) compendiumBtn.before(myButton); else footer.append(myButton);
});