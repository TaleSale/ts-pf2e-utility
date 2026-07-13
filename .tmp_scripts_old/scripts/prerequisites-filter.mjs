const MODULE_ID = "pf2e-ts-adv-v2";
const INPUT_CLASS = "pf2e-ts-adv-prereq-filter";
const INPUT_NAME = "pf2e-ts-adv-prereq-search";
const SETTING_KEY = "enablePrerequisitesFilter";
const SETTING_DEFAULT = true;
const WAIT_INTERVAL_MS = 50;
const WAIT_TIMEOUT_MS = 30000;

const isPlainObject = (value) =>
    value !== null && typeof value === "object" && value.constructor === Object;

const cleanQuery = (value) => {
    const text = String(value ?? "").toLocaleLowerCase(game.i18n.lang).trim();
    const searchFilter = foundry?.applications?.ux?.SearchFilter;
    return searchFilter?.cleanQuery ? searchFilter.cleanQuery(text) : text;
};

const splitTerms = (value) => cleanQuery(value).split(/\s+/).filter((term) => term.length > 0);

const matchesPrerequisites = (entryPrereqs, queryText) => {
    const terms = splitTerms(queryText);
    if (!terms.length) return true;
    if (!entryPrereqs) return false;
    const tokens = entryPrereqs.split(/\s+/).filter((token) => token.length > 0);
    return terms.every((term) => tokens.some((token) => token.startsWith(term)));
};

const ensurePrereqFilterData = (tab) => {
    if (!tab?.filterData) return;
    if (!tab.filterData.prerequisites) {
        tab.filterData.prerequisites = { text: "" };
    }
    if (tab.defaultFilterData && !tab.defaultFilterData.prerequisites) {
        tab.defaultFilterData.prerequisites = { text: "" };
    }
};

const isFilterEnabled = () => {
    try {
        return game?.settings?.get?.(MODULE_ID, SETTING_KEY) ?? SETTING_DEFAULT;
    } catch {
        return SETTING_DEFAULT;
    }
};

const registerSetting = () => {
    if (!game?.settings?.register) return false;
    const settingId = `${MODULE_ID}.${SETTING_KEY}`;
    if (game.settings.settings?.has?.(settingId)) return true;
    game.settings.register(MODULE_ID, SETTING_KEY, {
        name: "Enable prerequisites filter",
        hint: "Adds a prerequisites search field to the Compendium Browser feats tab.",
        scope: "client",
        config: true,
        default: SETTING_DEFAULT,
        type: Boolean,
        onChange: () => window.location.reload(),
    });
    return true;
};

const syncPrereqInput = (browser) => {
    const input = browser?.element?.querySelector(
        `fieldset.${INPUT_CLASS} input[name="${INPUT_NAME}"]`,
    );
    const text = browser?.tabs?.feat?.filterData?.prerequisites?.text ?? "";
    if (input) {
        input.value = text;
    }
};

const ensurePrereqInput = (browser) => {
    if (!browser?.rendered) return;
    const controlArea = browser.element?.querySelector(".control-area");
    if (!controlArea) return;

    const existing = controlArea.querySelector(`fieldset.${INPUT_CLASS}`);
    if (browser.activeTab?.tabName !== "feat") {
        if (existing) existing.remove();
        return;
    }
    ensurePrereqFilterData(browser.tabs?.feat);
    if (existing) {
        syncPrereqInput(browser);
        return;
    }

    const traitsFieldset = controlArea.querySelector("fieldset");
    if (!traitsFieldset) return;

    const fieldset = document.createElement("fieldset");
    fieldset.classList.add(INPUT_CLASS);

    const legend = document.createElement("legend");
    legend.textContent = game.i18n.localize("PF2E.FeatPrereqLabel");
    fieldset.appendChild(legend);

    const input = document.createElement("input");
    input.type = "search";
    input.name = INPUT_NAME;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = game.i18n.localize("PF2E.CompendiumBrowser.Filter.SearchPlaceholder");
    fieldset.appendChild(input);

    const onInput = foundry.utils.debounce((event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const tab = browser.tabs?.feat;
        if (!tab?.filterData) return;
        ensurePrereqFilterData(tab);
        tab.filterData.prerequisites.text = event.target.value.trim();
        const deepClone = foundry.utils.deepClone ?? globalThis.structuredClone;
        if (deepClone) {
            tab.filterData = deepClone(tab.filterData);
        }
        requestAnimationFrame(() => ensurePrereqInput(browser));
    }, 250);

    input.addEventListener("input", onInput);

    traitsFieldset.after(fieldset);
    syncPrereqInput(browser);
};

const registerWrappers = (browser) => {
    if (!browser?.tabs?.feat) return;
    if (!isFilterEnabled()) {
        console.log(`${MODULE_ID} | Compendium Browser prerequisites filter disabled by settings`);
        return;
    }

    const FEAT_TAB_PATH = "game.pf2e.compendiumBrowser.tabs.feat";
    const BROWSER_PATH = "game.pf2e.compendiumBrowser";
    ensurePrereqFilterData(browser.tabs?.feat);

    libWrapper.register(
        MODULE_ID,
        `${FEAT_TAB_PATH}.prepareFilterData`,
        function (wrapped, ...args) {
            const data = wrapped(...args);
            if (!data.prerequisites) {
                data.prerequisites = { text: "" };
            }
            return data;
        },
        "WRAPPER",
    );

    libWrapper.register(
        MODULE_ID,
        `${FEAT_TAB_PATH}.loadData`,
        async function () {
            console.debug(`${MODULE_ID} | Compendium Browser | Started loading feats with prerequisites`);

            if (!this.storeFields.includes("prerequisites")) {
                this.storeFields = [...this.storeFields, "prerequisites"];
            }

            const feats = [];
            const publications = new Set();
            const indexFields = [
                "img",
                "system.actionType.value",
                "system.actions.value",
                "system.category",
                "system.level.value",
                "system.prerequisites.value",
                "system.traits",
                "system.publication",
                "system.source",
            ];

            for await (const { pack, index } of this.browser.packLoader.loadPacks(
                "Item",
                this.browser.loadedPacks("feat"),
                indexFields,
            )) {
                console.debug(
                    `${MODULE_ID} | Compendium Browser | ${pack.metadata.label} - ${index.size} entries found`,
                );
                for (const featData of index) {
                    if (featData.type !== "feat") continue;
                    featData.filters = {};

                    const categoryPaths = ["system.category", "system.featType.value"];
                    const nonCategoryPaths = indexFields.filter((field) => !categoryPaths.includes(field));
                    const categoryPathFound = categoryPaths.some((path) => foundry.utils.hasProperty(featData, path));

                    if (!this.hasAllIndexFields(featData, nonCategoryPaths) || !categoryPathFound) {
                        console.warn(
                            `Feat "${featData.name}" does not have all required data fields.`,
                            `Consider unselecting pack "${pack.metadata.label}" in the compendium browser settings.`,
                        );
                        continue;
                    }

                    const featType = featData.system?.featType;
                    if (isPlainObject(featType) && typeof featType.value === "string") {
                        featData.system.category = featType.value;
                        delete featData.system.featType;
                    }

                    const prereqs = Array.isArray(featData.system?.prerequisites?.value)
                        ? featData.system.prerequisites.value
                        : [];
                    const prereqTextRaw = prereqs
                        .map((prerequisite) => (prerequisite?.value ? prerequisite.value : ""))
                        .filter((value) => value.length > 0)
                        .join(" ");
                    const prereqSearchText = cleanQuery(prereqTextRaw);

                    const skills = new Set();
                    for (const prereq of prereqs) {
                        const text = String(prereq?.value ?? "").toLocaleLowerCase(game.i18n.lang);
                        if (!text) continue;
                        for (const [key, value] of Object.entries(CONFIG.PF2E.skills)) {
                            const translated = game.i18n.localize(value.label).toLocaleLowerCase(game.i18n.lang);
                            if (text.includes(key) || text.includes(translated)) {
                                skills.add(key);
                            }
                        }
                    }

                    const pubSource =
                        featData.system.publication?.title ?? featData.system.source?.value ?? "";
                    const sourceSlug = foundry.utils.slugify?.(pubSource) ?? pubSource.toLowerCase();
                    if (pubSource) publications.add(pubSource);

                    feats.push({
                        type: featData.type,
                        name: featData.name,
                        originalName: featData.originalName,
                        img: featData.img,
                        uuid: featData.uuid,
                        level: featData.system.level.value,
                        category: featData.system.category,
                        skills: [...skills],
                        traits: featData.system.traits.value.map((trait) => trait.replace(/^hb_/, "")),
                        rarity: featData.system.traits.rarity,
                        source: sourceSlug,
                        prerequisites: prereqSearchText,
                    });
                }
            }

            this.indexData = feats;

            this.filterData.checkboxes.category.options = this.generateCheckboxOptions(CONFIG.PF2E.featCategories);
            this.filterData.checkboxes.skills.options = this.generateCheckboxOptions(CONFIG.PF2E.skills);
            this.filterData.checkboxes.rarity.options = this.generateCheckboxOptions(CONFIG.PF2E.rarityTraits);
            this.filterData.source.options = this.generateSourceCheckboxOptions(publications);
            this.filterData.traits.options = this.generateMultiselectOptions(CONFIG.PF2E.featTraits);

            console.debug(`${MODULE_ID} | Compendium Browser | Finished loading feats`);
        },
        "OVERRIDE",
    );

    libWrapper.register(
        MODULE_ID,
        `${FEAT_TAB_PATH}.filterIndexData`,
        function (wrapped, entry) {
            if (!wrapped(entry)) return false;
            const query = this.filterData?.prerequisites?.text ?? "";
            if (!query) return true;
            return matchesPrerequisites(entry?.prerequisites ?? "", query);
        },
        "WRAPPER",
    );

    libWrapper.register(
        MODULE_ID,
        `${FEAT_TAB_PATH}.resetFilters`,
        function (wrapped, ...args) {
            wrapped(...args);
            queueMicrotask(() => syncPrereqInput(this.browser));
        },
        "WRAPPER",
    );

    const tabNames = Array.isArray(browser.dataTabsList)
        ? browser.dataTabsList
        : Object.keys(browser.tabs ?? {});
    for (const tabName of tabNames) {
        libWrapper.register(
            MODULE_ID,
            `game.pf2e.compendiumBrowser.tabs.${tabName}.init`,
            async function (wrapped, ...args) {
                const result = await wrapped(...args);
                ensurePrereqFilterData(this);
                requestAnimationFrame(() => ensurePrereqInput(this.browser));
                return result;
            },
            "WRAPPER",
        );
    }

    libWrapper.register(
        MODULE_ID,
        `${BROWSER_PATH}.openTab`,
        async function (wrapped, ...args) {
            const result = await wrapped(...args);
            if (this.activeTab?.tabName === "feat") {
                requestAnimationFrame(() => ensurePrereqInput(this));
            }
            return result;
        },
        "WRAPPER",
    );

    libWrapper.register(
        MODULE_ID,
        `${BROWSER_PATH}._onClose`,
        function (wrapped, ...args) {
            wrapped(...args);
            const deepClone = foundry.utils.deepClone ?? globalThis.structuredClone;
            const tabs = this.tabsArray ?? Object.values(this.tabs ?? {});
            for (const tab of tabs) {
                if (tab?.defaultFilterData && deepClone) {
                    tab.filterData = deepClone(tab.defaultFilterData);
                }
            }
            ensurePrereqInput(this);
        },
        "WRAPPER",
    );

    libWrapper.register(
        MODULE_ID,
        `${BROWSER_PATH}._onRender`,
        function (wrapped, ...args) {
            const result = wrapped(...args);
            Promise.resolve(result).then(() => {
                ensurePrereqInput(this);
            });
            return result;
        },
        "WRAPPER",
    );

    console.log(`${MODULE_ID} | Compendium Browser prerequisites filter enabled`);
};

const waitForBrowser = () => {
    const start = Date.now();
    const timer = setInterval(() => {
        if (game?.pf2e?.compendiumBrowser) {
            clearInterval(timer);
            registerWrappers(game.pf2e.compendiumBrowser);
            return;
        }
        if (Date.now() - start > WAIT_TIMEOUT_MS) {
            clearInterval(timer);
            console.warn(`${MODULE_ID} | Compendium Browser prerequisites filter init timed out`);
        }
    }, WAIT_INTERVAL_MS);
};

const waitForSettings = () => {
    const start = Date.now();
    const timer = setInterval(() => {
        if (registerSetting()) {
            clearInterval(timer);
            return;
        }
        if (Date.now() - start > WAIT_TIMEOUT_MS) {
            clearInterval(timer);
            console.warn(`${MODULE_ID} | Prerequisites filter setting init timed out`);
        }
    }, WAIT_INTERVAL_MS);
};

waitForSettings();

if (globalThis.Hooks?.once) {
    Hooks.once("libWrapper.Ready", waitForBrowser);
} else {
    waitForBrowser();
}
