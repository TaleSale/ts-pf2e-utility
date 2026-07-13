// constructed-creature-ancestries.js

window.ConstructedCreatureAncestry = {
    // Структура: Семейство -> { метка, элементы: { ключ: { имя, uuid } } }
    DATA: {
        dwarf: {
            label: "Дварф",
            items: {
                base: { name: "Дварф", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.W3Z9QerxUxdBIb1r" }
            }
        },
        elf: {
            label: "Эльф",
            items: {
                base: { name: "Эльф", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.4BEolOCWWRCOOOlB" },
                aiuvarin: { name: "Эльф (Аюварин)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.IghACrfAG5BqObVG" }
            }
        },
        gnome: {
            label: "Гном",
            items: {
                base: { name: "Гном", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.b1JjpnGLXmO3lCWj" }
            }
        },
        goblin: {
            label: "Гоблин",
            items: {
                base: { name: "Гоблин", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.hQ27WLTKh9pX5tg9" }
            }
        },
        halfling: {
            label: "Полурослик",
            items: {
                base: { name: "Полурослик", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.LSJQ5di2oNCtO2oN" } // Исправлен ID если был неверный
            }
        },
        human: {
            label: "Человек",
            items: {
                base: { name: "Человек (Стандарт)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.dyYTck449zbIFLqw" },
                cheliax: { name: "Человек (Челиакс)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.vomHHX1LK4jOUVfX" },
                nidal: { name: "Человек (Нидал)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.OYlAwOr6qFtOsftA" }
            }
        },
        nephilim: {
            label: "Нефилим",
            items: {
                tiefling: { name: "Нефилим (Тифлинг)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.8RSHRLxW4OAjfClH" }
            }
        },
        orc: {
            label: "Орк",
            items: {
                base: { name: "Орк", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.QXhusfT0JzA49LR6" },
                dromaar: { name: "Орк (Дромаар)", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.bWnCYUPSEHlNLlxl" }
            }
        },
        strix: {
            label: "Стрикс",
            items: {
                base: { name: "Стрикс", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.cFFBXeAoe8oaJgYk" }
            }
        },
        tengu: {
            label: "Тэнгу",
            items: {
                base: { name: "Тэнгу", uuid: "Compendium.pf2e-ts-adv-v2.Build.Item.Dw7Awdfgj1Z2OfK1" }
            }
        }
    },

    _cache: {},

    getTabHTML: function() {
        const familyOptions = Object.entries(this.DATA).map(([key, val]) => {
            return `<option value="${key}">${val.label}</option>`;
        }).join("");

        return `
        <div class="monster-maker-container">
            <div class="form-group" style="flex:0 0 auto;">
                <label>Семейство Родословной</label>
                <select id="mm-ancestry-family">
                    <option value="none">-- Нет --</option>
                    ${familyOptions}
                </select>
            </div>

            <div id="ancestry-suboption-container" style="display:none; flex-direction:column; flex:1; height:100%;">
                
                <div class="class-suboption-block" style="margin-top: 10px; padding: 5px; background: rgba(111, 66, 193, 0.1); border-left: 3px solid #6f42c1; border-radius: 3px; flex:0 0 auto;">
                    <label style="font-weight:bold;">Вид Родословной:</label>
                    <select id="mm-ancestry-specific" class="subclass-select" style="width: 100%;">
                        <!-- Заполняется JS -->
                    </select>
                </div>

                <div id="ancestry-description-preview" class="enriched-desc" style="display:none;"></div>
            </div>
        </div>
        `;
    },

    activateListeners: function(html, updateCallback) {
        const familySelect = html.find("#mm-ancestry-family");
        const specificSelect = html.find("#mm-ancestry-specific");
        const container = html.find("#ancestry-suboption-container");
        const preview = html.find("#ancestry-description-preview");

        familySelect.change(() => {
            const famKey = familySelect.val();
            
            if (famKey === "none") {
                container.hide();
                specificSelect.empty();
                preview.hide().html("");
            } else {
                const familyData = this.DATA[famKey];
                let options = "";
                Object.entries(familyData.items).forEach(([key, item]) => {
                    options += `<option value="${item.uuid}">${item.name}</option>`;
                });
                specificSelect.html(options);
                container.css("display", "flex");
                specificSelect.trigger("change");
            }
            if (updateCallback) updateCallback();
        });

        specificSelect.change(async () => {
            const uuid = specificSelect.val();
            if (!uuid) return;

            preview.show().html("<em>Загрузка...</em>");
            const data = await this.getParsedData(uuid);
            const enriched = await TextEditor.enrichHTML(data.desc, {async: true});
            preview.html(enriched || "Нет описания.");

            if (updateCallback) updateCallback();
        });
    },

    getSelectedUUID: function(html) {
        const fam = html.find("#mm-ancestry-family").val();
        if (!fam || fam === "none") return null;
        return html.find("#mm-ancestry-specific").val();
    },

    getParsedData: async function(uuid) {
        if (!uuid) return { stats: {}, lores: [], traits: [], desc: "", items: [], hasInnateSpells: false };
        if (this._cache[uuid]) return this._cache[uuid];

        let result = { stats: {}, lores: [], traits: [], desc: "", items: [], hasInnateSpells: false };

        try {
            const item = await fromUuid(uuid);
            if (item) {
                result.desc = item.system.description.value;
                result.items.push(item.toObject());
                
                // Проверка на Врожденные Заклинания (RU и EN)
                if (result.desc.includes("<h2>Врожденные Заклинания</h2>") || 
                    result.desc.includes("<h2>Innate Spells</h2>")) {
                    result.hasInnateSpells = true;
                }

                if (window.ConstructedCreatureParser) {
                    const parsed = window.ConstructedCreatureParser.parseDescription(result.desc);
                    result.stats = parsed.stats;
                    result.lores = parsed.lores;
                }
            }
        } catch (e) {
            console.error("Ancestry load error:", e);
            result.desc = "Ошибка загрузки.";
        }

        this._cache[uuid] = result;
        return result;
    }
};