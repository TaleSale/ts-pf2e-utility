// constructed-creature-source.js

window.ConstructedCreatureSource = {
    sourceActor: null,
    analyzedData: {},
    conversionLog: [], // Хранит отчет о изменениях

    getTabHTML: function() {
        return `
        <div class="monster-maker-container" style="height: 100%; display: flex; flex-direction: column;">
            <div class="header-row">
                <h3>Источник Существа</h3>
                <p class="flavor-text">Перетащите монстра. Его способности будут проанализированы и масштабированы под новый уровень.</p>
            </div>

            <div id="mm-source-drop-zone" style="
                flex: 1;
                border: 3px dashed #ccc;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                margin: 10px 0;
                background: rgba(0,0,0,0.02);
                transition: all 0.2s;
                min-height: 150px;
            ">
                <i class="fas fa-dragon" style="font-size: 3em; color: #ccc; margin-bottom: 10px;"></i>
                <span id="mm-source-label" style="color: #666; font-weight: bold;">Перетащите монстра сюда</span>
                <div id="mm-source-info" style="margin-top: 10px; text-align: center; display: none;">
                    <img id="mm-source-img" src="" style="width: 64px; height: 64px; border: 1px solid #000; display: block; margin: 0 auto 5px;" />
                    <strong id="mm-source-name" style="display:block; font-size: 1.1em;"></strong>
                    <span id="mm-source-level" style="font-size: 0.9em; color: #444;"></span>
                </div>
            </div>

            <div id="mm-source-analysis" style="
                border: 1px solid var(--color-border-light-2);
                padding: 10px;
                border-radius: 5px;
                background: rgba(255,255,255,0.5);
                display: none;
                font-size: 0.85em;
                max-height: 200px;
                overflow-y: auto;
            ">
                <strong>Анализ параметров:</strong>
                <ul id="mm-analysis-list" style="columns: 2; list-style: none; padding: 0; margin-top: 5px;"></ul>
            </div>
        </div>
        `;
    },

    handleDrop: async function(data) {
        if (data.type !== "Actor") return null;
        const actor = await fromUuid(data.uuid);
        if (!actor || actor.type !== "npc") {
            ui.notifications.warn("Используйте NPC.");
            return null;
        }
        this.sourceActor = actor;
        return actor;
    },

    /**
     * Вычисляет средний урон из формулы (напр. "2d6+5" -> 12)
     */
    calculateAverageDamage: function(formula) {
        if (!formula) return 0;
        try {
            // Упрощенный парсер: XdY -> X * (Y+1)/2
            // Игнорируем сложные конструкции, берем базовые кости и модификатор
            let avg = 0;
            
            // Удаляем пробелы
            formula = formula.replace(/\s/g, '');
            
            // Разбиваем на слагаемые (+ или -)
            const parts = formula.split(/([+-])/);
            
            let multiplier = 1;
            for (const part of parts) {
                if (part === '+') { multiplier = 1; continue; }
                if (part === '-') { multiplier = -1; continue; }
                if (!part) continue;

                if (part.includes('d')) {
                    const [count, size] = part.split('d').map(Number);
                    if (!isNaN(count) && !isNaN(size)) {
                        avg += multiplier * (count * (size + 1) / 2);
                    }
                } else {
                    const num = Number(part);
                    if (!isNaN(num)) avg += multiplier * num;
                }
            }
            return avg;
        } catch (e) {
            console.warn("Ошибка парсинга урона:", formula, e);
            return 0;
        }
    },

    /**
     * Находит ранг (Low, Mod, High, Extreme) для значения на заданном уровне.
     * Использует логику FLOOR: если >= Normal, но < High -> Normal.
     */
    findRank: function(table, level, val, isDamage = false) {
        if (val === undefined || val === null) return "moderate";
        const row = window.CC_MONSTER_STATS[table]?.[level];
        if (!row) return "moderate";

        // Если это урон, нам нужно спарсить значения в таблице из строк в числа
        const thresholds = {};
        if (isDamage) {
            for (const [rank, formula] of Object.entries(row)) {
                thresholds[rank] = this.calculateAverageDamage(formula);
            }
        } else {
            // Копируем как есть
            for (const [rank, v] of Object.entries(row)) {
                thresholds[rank] = v;
            }
        }

        // Проверяем от Extreme вниз
        if (val >= thresholds.extreme) return "extreme";
        if (val >= thresholds.high) return "high";
        if (val >= thresholds.moderate) return "moderate";
        if (val >= thresholds.low) return "low";
        
        return "terrible"; // Или ниже low
    },

    analyzeCreature: function(actor) {
        if (!window.CC_MONSTER_STATS) return null;
        const level = actor.system.details.level.value;
        const result = {};

        // Анализ статов (без изменений)
        for (const abi of ["str", "dex", "con", "int", "wis", "cha"]) {
            result[abi] = this.findRank("abilityScores", level, actor.system.abilities[abi].mod);
        }
        result.ac = this.findRank("armorClass", level, actor.system.attributes.ac.value);
        result.hp = this.findRank("hitPoints", level, actor.system.attributes.hp.max);
        result.fort = this.findRank("perceptionSaves", level, actor.system.saves.fortitude.value);
        result.ref = this.findRank("perceptionSaves", level, actor.system.saves.reflex.value);
        result.wil = this.findRank("perceptionSaves", level, actor.system.saves.will.value);
        result.perception = this.findRank("perceptionSaves", level, actor.system.perception.mod);

        // Навыки
        for (const [skillKey, skillLabel] of Object.entries(window.ConstructedCreatureSkillList || {})) {
            const actorSkill = actor.system.skills[skillKey];
            if (actorSkill && actorSkill.base > 0) {
                 result[skillKey] = this.findRank("skills", level, actorSkill.base);
            } else {
                result[skillKey] = "none";
            }
        }

        // Атака (Бонус)
        let maxAttack = 0;
        actor.itemTypes.melee.forEach(m => {
            if (m.system.bonus.value > maxAttack) maxAttack = m.system.bonus.value;
        });
        result.strikeBonus = maxAttack > 0 ? this.findRank("strikeBonus", level, maxAttack) : "moderate";
        result.strikeDamage = result.strikeBonus; // Привязываем к бонусу атаки по умолчанию

        // Spell DC
        let maxDC = 0;
        actor.itemTypes.spellcastingEntry.forEach(s => {
            if (s.system.spelldc.dc > maxDC) maxDC = s.system.spelldc.dc;
        });
        if (maxDC > 0) {
            // В таблице spellcasting значения - это DC. 
            // 1 ур Moderate = 15.
            result.spellcasting = this.findRank("spellcasting", level, maxDC);
        } else {
            result.spellcasting = "none";
        }

        this.analyzedData = result;
        return result;
    },

    processDescription: function(text) {
        if (!text) return "";
        // Убираем цифры из @Check[...dc:25...] -> @Check[...dc:...]
        return text.replace(/(@Check\[[^\]]*?dc:\s*)\d+([^\]]*?\])/gi, "$1$2");
    },

    /**
     * Основная логика конвертации предметов
     */
    prepareSourceItems: function(actor, targetLevel) {
        this.conversionLog = []; // Очищаем лог
        const items = [];
        const sourceLevel = actor.system.details.level.value;
        const typesToKeep = ["action", "feat", "spellcastingEntry", "effect", "passive", "equipment"];

        // Таблицы
        const stats = window.CC_MONSTER_STATS;

        for (const item of actor.items) {
            if (!typesToKeep.includes(item.type) && item.type !== "spell") continue;

            // Клонируем данные
            const itemData = item.toObject();
            let desc = itemData.system.description?.value || "";
            let changes = [];

            // 1. Очистка DC
            const descBeforeDC = desc;
            desc = this.processDescription(desc);
            if (desc !== descBeforeDC) {
                changes.push("DC удален");
            }

            // 2. Обработка Урона
            // Ищем @Damage[...] или формулы
            const damageRegex = /@Damage\[([^\]]+)\]/g;
            // Нам нужно найти ТОЛЬКО ПЕРВОЕ вхождение, но replace меняет первое по умолчанию.
            // Нам нужно проанализировать это вхождение.
            
            const match = damageRegex.exec(desc);
            if (match) {
                const fullTag = match[0];
                const originalFormula = match[1]; // "3d6+4"
                
                // Считаем средний урон оригинала
                const avgOriginal = this.calculateAverageDamage(originalFormula);

                // ОПРЕДЕЛЕНИЕ ТИПА (ТАБЛИЦЫ)
                let tableType = "areaDamageUnlimited"; // По умолчанию: Area (Moderate) если нет шаблона

                // Проверяем на @Template
                const hasTemplate = desc.includes("@Template");
                
                if (hasTemplate) {
                    // Проверяем на ограничения (Recharge, Frequency, "rounds", "minutes")
                    const isLimited = /в раунд|в минут|Перезарядка|Recharge|Frequency|per round|per minute/i.test(desc) || 
                                      (itemData.system.frequency && itemData.system.frequency.max > 0);
                    
                    tableType = isLimited ? "areaDamage" : "areaDamageUnlimited";
                } else {
                    // Нет шаблона -> "бери всегда среднею" (то есть Moderate, но из какой таблицы?
                    // Обычно способности без шаблона это Strike-like. Но в промпте сказано "сравнивай с таблицей урона по области"
                    // для template. А "если нет @Template ... бери всегда среднею для нее".
                    // Будем считать, что это Unlimited Area Moderate (как базовый урон абилки).
                    tableType = "areaDamageUnlimited";
                }

                // ОПРЕДЕЛЕНИЕ РАНГА НА СТАРОМ УРОВНЕ
                let rank = "moderate"; // Дефолт по ТЗ ("если нет Template... бери всегда среднею")
                
                if (hasTemplate) {
                    // Если есть шаблон, мы анализируем ранг
                    // Используем логику Floor: если avg >= Normal, но < Extreme -> Normal
                    rank = this.findRank(tableType, sourceLevel, avgOriginal, true);
                    
                    // Если получилось "none" (слишком маленький урон), поднимем до low, чтобы не ломать
                    if (rank === "none") rank = "low";
                } else {
                    // Нет шаблона -> всегда Moderate
                    rank = "moderate";
                }

                // ПОЛУЧЕНИЕ НОВОЙ ФОРМУЛЫ
                const newFormula = stats[tableType][targetLevel][rank];

                // ЗАМЕНА В ТЕКСТЕ (Только первое вхождение)
                if (newFormula) {
                    // Создаем новый тег с сохранением других параметров внутри [] если они есть?
                    // Обычно @Damage[formula label]
                    // Мы просто меняем формулу внутри скобок. 
                    // Аккуратно: replace заменит первое вхождение строки originalFormula.
                    // Если формула простая "1d6", она может встретиться в тексте.
                    // Лучше заменить весь тег @Damage[old] на @Damage[new]
                    // Но внутри могут быть лейблы @Damage[1d6[fire]].
                    // Предположим простой случай @Damage[formula].
                    
                    // Безопасная замена:
                    const newTag = fullTag.replace(originalFormula, newFormula);
                    desc = desc.replace(fullTag, newTag);

                    changes.push(`Урон: ${originalFormula} -> ${newFormula} (${PROFICIENCY_LABELS[rank] || rank})`);
                }
            }

            // Применяем изменения
            itemData.system.description.value = desc;
            items.push(itemData);

            // Логируем
            if (changes.length > 0) {
                this.conversionLog.push(`<li><strong>${item.name}</strong>: ${changes.join(", ")}</li>`);
            }
        }

        return items;
    },

    /**
     * Показать отчет (вызывается из основного скрипта после создания)
     */
    showReport: function() {
        if (this.conversionLog.length === 0) return;
        
        const content = `
            <div class="monster-maker-report">
                <p>Следующие изменения были применены к способностям источника:</p>
                <ul>${this.conversionLog.join("")}</ul>
            </div>
        `;
        
        new Dialog({
            title: "Отчет о конвертации",
            content: content,
            buttons: {
                ok: { label: "OK" }
            }
        }).render(true);
    }
};