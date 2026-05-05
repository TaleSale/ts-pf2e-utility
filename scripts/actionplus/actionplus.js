// 1. ИНИЦИАЛИЗАЦИЯ: Создаем глобальный объект
Hooks.once('init', () => {
    CONFIG.TS_PF2E_UTILITY = {
        actionOptions: {
            "": "Пусто" 
        }
    };
});

// 2. РЕГИСТРАЦИЯ ПЛАГИНА "НАСЛЕДИЕ КРОВИ"
Hooks.once('ready', () => {
    CONFIG.TS_PF2E_UTILITY.actionOptions["bloodline"] = "Наследие Крови";
});

// 3. ОСНОВНАЯ ЛОГИКА И ОТРИСОВКА ИНТЕРФЕЙСА
Hooks.on('renderItemSheet', (app, html, data) => {
    const item = app.document;

    if (item.actor?.type !== 'npc' || item.type !== 'action') return;

    const flags = item.flags['ts-pf2e-utility'] || {};
    const currentOption = flags.actionOption || "";

    // --- ГЕНЕРАЦИЯ HTML ---
    let optionsHtml = Object.entries(CONFIG.TS_PF2E_UTILITY.actionOptions)
        .map(([val, label]) => `<option value="${val}" ${val === currentOption ? 'selected' : ''}>${label}</option>`)
        .join('');

    let injectHtml = `
        <fieldset class="ts-utility-fieldset" style="margin-top: 10px; border: 1px solid var(--color-border-light-primary); padding: 5px; border-radius: 3px;">
            <legend>TS-PF2E-Utility</legend>
            <div class="form-group">
                <label>Доп. Функции</label>
                <div class="form-fields">
                    <select name="flags.ts-pf2e-utility.actionOption" class="ts-utility-select">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
    `;

    if (currentOption === 'bloodline') {
        const spells = flags.bloodlineSpells ||[];
        
        let spellsHtml = spells.length > 0 
            ? spells.map(s => `
                <li style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.1); padding: 3px; margin-bottom: 2px; border-radius: 3px;">
                    <span><i class="fa-solid fa-wand-magic-sparkles"></i> ${s.name}</span>
                    <a class="ts-spell-delete" data-id="${s.id}" style="color: darkred; cursor: pointer;" data-tooltip="Удалить"><i class="fas fa-trash"></i></a>
                </li>`).join('')
            : `<p style="text-align: center; color: var(--color-text-dark-50); margin: 5px 0;">Перетащите сюда заклинания из листа персонажа</p>`;

        injectHtml += `
            <div class="ts-bloodline-drop-zone" style="margin-top: 10px; min-height: 60px; border: 2px dashed var(--color-border-light-tertiary); padding: 5px; border-radius: 5px; background: rgba(0,0,0,0.05);">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;"><i class="fa-solid fa-droplet" style="color: darkred;"></i> Заклинания Наследия:</label>
                <ul style="list-style: none; padding: 0; margin: 0;">${spellsHtml}</ul>
            </div>
        `;
    }

    injectHtml += `</fieldset>`;

    const publicationFieldset = html.find('.tab[data-tab="details"] fieldset.publication');
    if (publicationFieldset.length) {
        publicationFieldset.after(injectHtml);
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    html.find('.ts-utility-select').on('change', async (e) => {
        await item.setFlag('ts-pf2e-utility', 'actionOption', e.target.value);
    });

    if (currentOption === 'bloodline') {
        const dropZone = html.find('.ts-bloodline-drop-zone')[0];
        if (dropZone) {
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                
                const data = TextEditor.getDragEventData(e);
                if (data.type !== 'Item') return;
                
                const droppedItem = await fromUuid(data.uuid);
                if (!droppedItem) return;
                
                if (droppedItem.type !== 'spell') {
                    return ui.notifications.warn("В эту зону можно перетаскивать только заклинания!");
                }
                if (droppedItem.actor?.id !== item.actor.id) {
                    return ui.notifications.warn("Заклинание должно быть из листа этого же персонажа!");
                }

                const currentSpells = item.getFlag('ts-pf2e-utility', 'bloodlineSpells') ||[];
                
                if (!currentSpells.find(s => s.id === droppedItem.id)) {
                    const newSpell = { id: droppedItem.id, name: droppedItem.name };
                    const updatedSpells = [...currentSpells, newSpell];
                    
                    await item.setFlag('ts-pf2e-utility', 'bloodlineSpells', updatedSpells);
                    updateBloodlineRuleElement(item, updatedSpells);
                }
            });
        }

        html.find('.ts-spell-delete').on('click', async (e) => {
            const idToDelete = e.currentTarget.dataset.id;
            const currentSpells = item.getFlag('ts-pf2e-utility', 'bloodlineSpells') ||[];
            const updatedSpells = currentSpells.filter(s => s.id !== idToDelete);
            
            await item.setFlag('ts-pf2e-utility', 'bloodlineSpells', updatedSpells);
            updateBloodlineRuleElement(item, updatedSpells);
        });
    }
});

// --- ГЕНЕРАТОР RULE ELEMENTS ---
async function updateBloodlineRuleElement(item, spells) {
    let rules = foundry.utils.deepClone(item.system.rules ||[]);
    
    // ИСПРАВЛЕНИЕ 1: Жестко удаляем все старые/дублирующиеся правила от Магии Крови
    rules = rules.filter(r => r.tsUtilitySource !== 'bloodline' && r.label !== 'Магия Крови');

    if (spells.length > 0) {
        const spellPredicates = spells.map(s => `item:id:${s.id}`);
        
        // --- ИСПРАВЛЕНИЕ 2: Обработка языка и обрезка ---
        const fullText = item.system.description.value || "";
        let finalText = fullText;

        // Ищем тег <hr, который начинает блок с оригиналом
        const splitIndex = fullText.indexOf('<hr');
        
        // Проверяем, есть ли двуязычный блок в описании
        if (splitIndex !== -1 && fullText.includes('Оригинал')) {
            // Русский текст - всё до тега <hr>
            const ruText = fullText.substring(0, splitIndex).trim();
            
            let enText = fullText;
            // Ищем всё, что находится внутри <details><summary>Оригинал</summary> ... </details>
            const detailMatch = fullText.match(/<summary>Оригинал<\/summary>(.*?)<\/details>/is);
            if (detailMatch && detailMatch[1]) {
                enText = detailMatch[1].trim(); // Забираем чистый английский текст без тегов details
            }

            // Получаем активный язык Foundry (будет 'ru', 'en' и т.д.)
            const currentLang = game.i18n.lang || game.settings.get("core", "language");
            
            // Если выбран русский — оставляем русский. Иначе — английский.
            finalText = (currentLang === "ru") ? ruText : enText;
        }

        const ruleElement = {
            key: "ItemAlteration",
            itemType: "spell", 
            mode: "add",
            label: "Магия Крови",
            property: "description",
            value:[
                {
                    text: finalText // Текст без лишних заголовков и на нужном языке
                }
            ],
            predicate: [{ or: spellPredicates }], 
            tsUtilitySource: "bloodline" 
        };

        rules.push(ruleElement);
    }

    await item.update({ "system.rules": rules });
}