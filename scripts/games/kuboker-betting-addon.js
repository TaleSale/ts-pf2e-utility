/**
 * Kuboker Betting Addon - Ultra Stable
 */

const K_GAME_ID = "kuboker";
const K_MODULE_ID = "ts-pf2e-utility";

const K_STRINGS = {
    betting: "Ставки",
    pot: "БАНК",
    step: "Шаг",
    limit: "Лимит",
    call: "Call",
    allin: "All-in",
    fold: "Fold",
    paid: "ОК",
    need: "Нужно",
    start: "Старт"
};

const K_CURR = { mm: "мм", sm: "см", zm: "зм", pm: "пм" };

Hooks.once("ready", () => {
    const api = game.modules.get(K_MODULE_ID)?.api;
    if (!api) return;

    // --- 1. ЛОГИКА (HandleAction Patch) ---
    const patchLogic = () => {
        const kuboker = api.games?.[K_GAME_ID] || Object.values(api.games || {}).find(g => g.id === K_GAME_ID);
        if (!kuboker || kuboker._bettingPatched) return;

        const originalHandle = kuboker.handleAction;
        kuboker.handleAction = async function(args) {
            const { action, data, state, senderId } = args;
            const isGM = game.users.get(senderId)?.isGM;

            // ГАРАНТИЯ ОБЪЕКТА: Создаем базу, если ее нет
            if (!state.betting) {
                state.betting = { enabled: false, pot: 0, currentMaxBet: 0, config: { initial: 1, currency: "zm", step: 1, limit: 10 } };
            }

            switch (action) {
                case "bet-toggle":
                    if (isGM) state.betting.enabled = Boolean(data.enabled);
                    return true;

                case "bet-config":
                    if (isGM) state.betting.config = { ...state.betting.config, ...data.config };
                    return true;

                case "bet-raise": {
                    const p = state.players[data.actorId];
                    const step = Number(state.betting.config.step);
                    const limit = Number(state.betting.config.limit);
                    if (state.betting.currentMaxBet + step > limit) return this.handleAction({...args, action: "bet-allin"});
                    const toPay = (state.betting.currentMaxBet - (p.betContributed || 0)) + step;
                    p.betContributed = (p.betContributed || 0) + toPay;
                    state.betting.currentMaxBet += step;
                    state.betting.pot += toPay;
                    state.log.unshift(`<div style="font-size:11px; color:#4caf50;">🪙 <b>${p.name}</b> +${step}</div>`);
                    return true;
                }

                case "bet-call": {
                    const p = state.players[data.actorId];
                    const diff = state.betting.currentMaxBet - (p.betContributed || 0);
                    if (diff <= 0) return true;
                    p.betContributed = (p.betContributed || 0) + diff;
                    state.betting.pot += diff;
                    return true;
                }

                case "bet-allin": {
                    const p = state.players[data.actorId];
                    const limit = Number(state.betting.config.limit);
                    const diff = limit - (p.betContributed || 0);
                    p.betContributed = limit;
                    state.betting.currentMaxBet = limit;
                    state.betting.pot += diff;
                    state.log.unshift(`<div style="font-size:11px; color:#ff9800; border:1px solid #ff9800; padding:2px; background:rgba(255,152,0,0.1);">🔥 <b>${p.name}</b>: ALL-IN</div>`);
                    return true;
                }

                case "bet-fold": {
                    const p = state.players[data.actorId];
                    p.isParticipating = false;
                    state.log.unshift(`<div style="font-size:11px; color:#ff5252;">❌ <b>${p.name}</b>: Пас</div>`);
                    return true;
                }

                case "deal": {
                    const res = await originalHandle(args);
                    if (res && state.betting?.enabled) {
                        const init = Number(state.betting.config.initial);
                        state.betting.currentMaxBet = init;
                        let total = 0;
                        for (let p of Object.values(state.players)) {
                            if (p.isParticipating) { p.betContributed = init; total += init; }
                            else p.betContributed = 0;
                        }
                        state.betting.pot = total;
                    }
                    return res;
                }

                // Ловим сброс стейта
                case "clear":
                case "reset-game": {
                    const res = await originalHandle(args);
                    const oldConfig = state.betting?.config;
                    const oldEnabled = state.betting?.enabled;
                    state.betting = { 
                        enabled: action === "clear" ? oldEnabled : false, 
                        pot: 0, 
                        currentMaxBet: 0, 
                        config: action === "clear" ? oldConfig : { initial: 1, currency: "zm", step: 1, limit: 10 } 
                    };
                    return res;
                }
            }
            return originalHandle(args);
        };
        kuboker._bettingPatched = true;
    };

    // --- 2. UI ИНЪЕКЦИЯ ---
    const injectUI = (app, html) => {
        const data = app.getData();
        const state = data.state;
        if (!state) return;
        
        // Гарантия наличия объекта для рендера
        if (!state.betting) state.betting = { enabled: false, pot: 0, currentMaxBet: 0, config: { initial: 1, currency: "zm", step: 1, limit: 10 } };
        const b = state.betting;

        html.find(".kb-bet-gm-ui, .kb-bet-contribution, .kb-bet-pot-display, .kb-bet-row-btns").remove();

        // ГМ ФУТЕР
        if (game.user.isGM) {
            const footerLeft = html.find(".tsu-footer > div:first-child");
            footerLeft.append(`
                <div class="kb-bet-gm-ui" style="display:flex; align-items:center; gap:6px; margin-left:10px; padding-left:10px; border-left:1px solid rgba(255,255,255,0.1);">
                    <label class="tsu-checkbox kb-debug-label" style="margin:0;"><input type="checkbox" class="kb-bet-toggle" ${b.enabled ? 'checked' : ''}><span>🪙</span></label>
                    ${b.enabled ? `
                        <input type="number" class="kb-dc-input kb-bet-init" value="${b.config.initial}" style="width:30px; height:20px;">
                        <select class="kb-dc-input kb-bet-curr" style="width:45px; height:20px; font-size:10px; background:#111; color:gold; border-color:#444;">
                            ${Object.entries(K_CURR).map(([k,v]) => `<option value="${k}" ${b.config.currency === k ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                        <span style="font-size:10px; opacity:0.5;">${K_STRINGS.step}:</span><input type="number" class="kb-dc-input kb-bet-step" value="${b.config.step}" style="width:30px; height:20px;">
                        <span style="font-size:10px; opacity:0.5;">${K_STRINGS.limit}:</span><input type="number" class="kb-dc-input kb-bet-limit" value="${b.config.limit}" style="width:35px; height:20px;">
                    ` : ''}
                </div>
            `);
        }

        if (!b.enabled) return;

        // БАНК В ПРИКУПЕ (Справа)
        const stockRow = html.find(".kb-stock-block");
        stockRow.css("position", "relative").append(`
            <div class="kb-bet-pot-display" style="position:absolute; right:15px; top:50%; transform:translateY(-50%); text-align:right;">
                <div style="font-size:9px; opacity:0.5; letter-spacing:1px; line-height:1;">${K_STRINGS.pot}</div>
                <div style="font-size:24px; color:gold; font-weight:bold; text-shadow:0 0 8px rgba(0,0,0,1); line-height:1.1;">${b.pot} <span style="font-size:12px; font-weight:normal;">${K_CURR[b.config.currency]}</span></div>
            </div>
        `);

        // КАРТОЧКИ ИГРОКОВ
        html.find(".tsu-player-card").each(function() {
            const actorId = $(this).find("[data-actor-id]").first().data("actorId");
            const pState = state.players[actorId];
            const pView = data.players.find(p => p.id === actorId);
            if (!pState || !pState.isParticipating) return;

            const contributed = pState.betContributed || 0;
            const need = b.currentMaxBet - contributed;

            // Вклад игрока справа в имени
            $(this).find(".tsu-player-name").append(`
                <span class="kb-bet-contribution" style="float:right; font-weight:normal; font-size:11px; color:${need > 0 ? '#ff8b8b' : '#8eff8e'}; margin-left:10px;">
                    ${need > 0 ? `-${need} ` : ''}(${contributed} ${K_CURR[b.config.currency]})
                </span>
            `);

            // Кнопки в ряд только владельцу
            if (pView?.isVisualOwner) {
                $(this).append(`
                    <div class="kb-bet-row-btns" style="display:flex; gap:2px; margin-top:5px; padding-top:5px; border-top:1px solid rgba(255,255,255,0.05);">
                        <button type="button" class="tsu-small-button kb-btn-sm kb-bet-action" data-action="bet-raise" data-actor-id="${actorId}" style="flex:1; font-size:10px; height:20px; white-space:nowrap;">+${b.config.step}</button>
                        <button type="button" class="tsu-small-button kb-btn-sm kb-bet-action" data-action="bet-call" data-actor-id="${actorId}" ${need <= 0 ? 'disabled' : ''} style="flex:1; font-size:10px; height:20px;">${K_STRINGS.call}</button>
                        <button type="button" class="tsu-small-button kb-btn-sm kb-bet-action" data-action="bet-allin" data-actor-id="${actorId}" style="flex:1.5; font-size:10px; height:20px; border-color:orange; color:orange;">${K_STRINGS.allin}</button>
                        <button type="button" class="tsu-small-button kb-btn-sm kb-bet-action" data-action="bet-fold" data-actor-id="${actorId}" style="flex:1; font-size:10px; height:20px; opacity:0.6;">${K_STRINGS.fold}</button>
                    </div>
                `);
            }
        });

        // СОБЫТИЯ
        html.find(".kb-bet-toggle").on("change", (e) => {
            api.requestGameAction(K_GAME_ID, "bet-toggle", { enabled: e.target.checked });
            setTimeout(() => app.render(true), 200);
        });

        html.find(".kb-bet-init, .kb-bet-curr, .kb-bet-step, .kb-bet-limit").on("change", () => {
            const config = { 
                initial: Number(html.find(".kb-bet-init").val()), 
                currency: html.find(".kb-bet-curr").val(), 
                step: Number(html.find(".kb-bet-step").val()), 
                limit: Number(html.find(".kb-bet-limit").val()) 
            };
            api.requestGameAction(K_GAME_ID, "bet-config", { config });
        });

        html.find(".kb-bet-action").on("click", (e) => {
            api.requestGameAction(K_GAME_ID, e.currentTarget.dataset.action, { actorId: e.currentTarget.dataset.actorId });
        });
    };

    Hooks.on("renderKubokerApplication", (app, html) => {
        if (!app._bettingRefreshPatched) {
            const oldRefresh = app.refresh;
            app.refresh = async function(...args) { await oldRefresh.apply(this, args); injectUI(this, this.element); };
            app._bettingRefreshPatched = true;
        }
        patchLogic();
        injectUI(app, html);
    });
});