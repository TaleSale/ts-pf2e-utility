// pf2e-ts-adv-v2/scripts/clear-attack-descriptions.js

Hooks.on('renderActorSheet', (app, html, data) => {
    // --- 1. Проверки прав и наличия секции ---
    if (!app.actor.isOwner) return;

    const attackSection = html.find('.attacks.section-container');
    const controlsDiv = attackSection.find('.section-header .attacks-controls');

    if (controlsDiv.length === 0) return;

    // --- 2. Проверка наличия описаний (для видимости кнопки) ---
    const attackItemsDOM = attackSection.find('ol.strikes-list li.item');
    let hasAnyDescription = false;

    attackItemsDOM.each((index, element) => {
        const itemId = element.dataset.itemId;
        const item = app.actor.items.get(itemId);
        if (item && item.system.description && item.system.description.value) {
            if (item.system.description.value.trim().length > 0) {
                hasAnyDescription = true;
                return false; 
            }
        }
    });

    const existingBtn = controlsDiv.find('.clear-attack-descriptions');

    // --- 3. Логика кнопки ---
    if (hasAnyDescription) {
        if (existingBtn.length === 0) {
            const clearBtn = $(`
                <a class="clear-attack-descriptions" data-tooltip="Очистить и обновить описания атак" style="margin-right: 5px;">
                    <i class="fa-solid fa-broom"></i>
                </a>
            `);

            controlsDiv.prepend(clearBtn);

            clearBtn.click(async (event) => {
                event.preventDefault();
                const actor = app.actor;

                ui.notifications.info("Анализ описаний предметов...");

                const smartUpdateQueue = []; 
                const simpleClearIds = [];   
                const meleeItems = actor.itemTypes.melee;

                for (const item of meleeItems) {
                    const rawDesc = item.system.description.value;
                    if (!rawDesc || rawDesc.trim() === "") continue;

                    // Обогащение HTML (превращаем формулы в числа)
                    const enrichedHTML = await TextEditor.enrichHTML(rawDesc, {
                        async: true,
                        secrets: false,
                        rollData: item.getRollData(),
                        relativeTo: item
                    });

                    const dummy = document.createElement('div');
                    dummy.innerHTML = enrichedHTML;

                    const hasAttack = dummy.querySelector('a[data-modifier]');
                    const hasDamage = dummy.querySelector('a[data-base-formula], a[data-formula]');

                    if (hasAttack || hasDamage) {
                        smartUpdateQueue.push({ item, dom: dummy });
                    } else {
                        simpleClearIds.push(item.id);
                    }
                }

                if (smartUpdateQueue.length === 0 && simpleClearIds.length === 0) {
                    ui.notifications.info("Нет описаний для обработки.");
                    return;
                }

                // Этап 1: Диалоги
                for (const data of smartUpdateQueue) {
                    await processSmartItem(data.item, data.dom);
                }

                // Этап 2: Массовая очистка
                if (simpleClearIds.length > 0) {
                    const confirmed = await Dialog.confirm({
                        title: "Очистка простых описаний",
                        content: `<p>Найдено предметов с обычным описанием (без формул): <strong>${simpleClearIds.length}</strong>.</p>
                                  <p>Очистить их?</p>`,
                        yes: () => true,
                        no: () => false,
                        defaultYes: true
                    });

                    if (confirmed) {
                        const updates = simpleClearIds.map(id => ({
                            _id: id,
                            "system.description.value": ""
                        }));
                        await actor.updateEmbeddedDocuments("Item", updates);
                        ui.notifications.info(`Очищено простых описаний: ${updates.length}`);
                    }
                }
            });
        }
    } else {
        if (existingBtn.length > 0) existingBtn.remove();
    }
});

// === ФУНКЦИЯ ПАРСИНГА И ДИАЛОГА ===
async function processSmartItem(item, dom) {
    const attacks = [];
    const damages = [];

    // --- 1. ПАРСИНГ АТАК ---
    dom.querySelectorAll('a[data-modifier]').forEach((link) => {
        const mod = parseInt(link.dataset.modifier);
        let label = "";
        
        const nextNode = link.nextSibling;
        if (nextNode && nextNode.nodeType === 3) {
            let text = nextNode.textContent.trim();
            // Чистим начало
            text = text.replace(/^[,.]\s*/, '');
            // Отрезаем фразу про урон
            text = text.split('а урон на')[0];
            // Чистим конец
            label = text.trim().replace(/[,.;]$/, '');
        }

        if (!isNaN(mod)) {
            attacks.push({ value: mod, label: label || `Атака +${mod}` });
        }
    });

    // --- 2. ПАРСИНГ УРОНА ---
    dom.querySelectorAll('a[data-base-formula], a[data-formula]').forEach((link) => {
        let rawFormula = link.dataset.baseFormula || link.dataset.formula;
        if (!rawFormula) return;

        rawFormula = rawFormula.replace(/^\{|\}$/g, '');

        const typeMatch = rawFormula.match(/^(.*)\[([a-zA-Z]+)\]$/);
        let formula = rawFormula;
        let type = "bludgeoning"; 

        if (typeMatch) {
            formula = typeMatch[1].trim(); 
            type = typeMatch[2].trim();    
        }

        if (formula.startsWith('(') && formula.endsWith(')')) {
            let depth = 0;
            let isWrapped = true;
            for (let i = 0; i < formula.length - 1; i++) {
                if (formula[i] === '(') depth++;
                if (formula[i] === ')') depth--;
                if (depth === 0) { isWrapped = false; break; }
            }
            if (isWrapped) formula = formula.substring(1, formula.length - 1);
        }

        let label = "";
        const nextNode = link.nextSibling;
        if (nextNode && nextNode.nodeType === 3) {
            let text = nextNode.textContent.trim();
            // Чистим начало и конец от знаков препинания
            text = text.replace(/^[,.]\s*/, '').replace(/[,.;]$/, '');
            label = text.trim();
        }

        damages.push({ 
            full: rawFormula, 
            formula: formula, 
            type: type,
            label: label
        });
    });

    if (attacks.length === 0 && damages.length === 0) return;

    // --- 3. ПОСТРОЕНИЕ ДИАЛОГА ---
    let content = `<p>Настройка для <strong>${item.name}</strong>:</p><hr>`;
    
    // Блок Атаки
    if (attacks.length > 0) {
        content += `<div class="form-group"><label><strong>Бонус атаки:</strong></label><div style="display:flex; flex-direction:column; gap:5px;">`;
        attacks.forEach((atk, idx) => {
            const checked = idx === 0 ? "checked" : "";
            content += `
            <div style="display:flex; align-items:center;">
                <input type="radio" id="atk-${item.id}-${idx}" name="attackChoice" value="${idx}" ${checked} style="margin-right:5px;">
                <label for="atk-${item.id}-${idx}">
                    <strong>+${atk.value}</strong> 
                    <span style="color:gray;">${atk.label}</span>
                </label>
            </div>`;
        });
        content += `</div></div><hr>`;
    }

    // Блок Урона
    if (damages.length > 0) {
        content += `<div class="form-group"><label><strong>Урон:</strong></label><div style="display:flex; flex-direction:column; gap:5px;">`;
        damages.forEach((dmg, idx) => {
            const checked = idx === 0 ? "checked" : "";
            content += `
            <div style="display:flex; align-items:center;">
                <input type="radio" id="dmg-${item.id}-${idx}" name="damageChoice" value="${idx}" ${checked} style="margin-right:5px;">
                <label for="dmg-${item.id}-${idx}">
                    <strong>${dmg.formula}</strong> 
                    <span style="color:gray;">[${dmg.type}] ${dmg.label}</span>
                </label>
            </div>`;
        });
        content += `</div></div>`;
    }
    
    content += `<br><p style="font-size:0.8em; color:darkred;"><i class="fas fa-exclamation-triangle"></i> При нажатии "Применить" описание будет удалено.</p>`;

    return new Promise((resolve) => {
        new Dialog({
            title: `Обновление: ${item.name}`,
            content: content,
            buttons: {
                apply: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Применить",
                    callback: async (html) => {
                        const updates = { 
                            _id: item.id,
                            "system.description.value": "" 
                        };

                        if (attacks.length > 0) {
                            const idx = html.find('input[name="attackChoice"]:checked').val();
                            if (idx !== undefined) updates["system.bonus.value"] = attacks[idx].value;
                        }

                        if (damages.length > 0) {
                            const idx = html.find('input[name="damageChoice"]:checked').val();
                            if (idx !== undefined) {
                                const selected = damages[idx];
                                const damageKeys = Object.keys(item.system.damageRolls);
                                let targetKey = damageKeys[0] || foundry.utils.randomID();

                                updates[`system.damageRolls.${targetKey}.damage`] = selected.formula;
                                if (selected.type) updates[`system.damageRolls.${targetKey}.damageType`] = selected.type;
                            }
                        }

                        await item.update(updates);
                        ui.notifications.info(`${item.name} обновлен.`);
                        resolve();
                    }
                },
                cancel: {
                    label: "Пропустить",
                    icon: '<i class="fas fa-arrow-right"></i>',
                    callback: () => resolve()
                }
            },
            default: "apply",
            close: () => resolve()
        }).render(true);
    });
}