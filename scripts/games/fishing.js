import { MODULE_ID, escapeHtml as esc, getGameState, requestGameAction, userCanControlActor } from '../core.js';
import { DC, SIZES, LOCATIONS, SHOP, fishPrice, catchForRoll, degree, initialState } from './fishing-data.js';
const ID='fishing';
const flag=item=>item.getFlag(MODULE_ID,'fishing');
const money=cp=>`${(cp/100).toLocaleString('ru-RU')} зм`;
const now=()=>game.time.worldTime;
const log=(s,text)=>{s.log.unshift(text);s.log=s.log.slice(0,40);};
const owned=()=>game.actors.filter(a=>a.type==='character'&&userCanControlActor(a));
const sizeOptions=selected=>SIZES.slice(1).map((n,i)=>`<option value="${i+1}" ${selected===i+1?'selected':''}>${n}</option>`).join('');
function skills(actor,reel=false) {
 return Object.entries(actor?.skills??{}).filter(([key,stat])=> (reel?['athletics','survival']:['nature','survival']).includes(key) || /fishing|рыбал|рыболов/i.test(`${key} ${stat.label}`));
}
async function check(actor,slug,dc,modifiers,label) {
 const stat=actor.getStatistic(slug);
 const roll=await stat.roll({dc:{value:dc},skipDialog:true,extraRollOptions:['action:fishing'],modifiers,label});
 if(!roll) return null;
 return roll.degreeOfSuccess ?? roll.options?.degreeOfSuccess ?? degree(roll.total,dc,roll.dice?.[0]?.results?.find(r=>r.active!==false)?.result);
}
const NOTIFICATION_CHANNEL=`module.${MODULE_ID}`;
function showNotification(userId,message,level='info') {
 const payload={type:'fishing-notification',userId,message,level};
 if(game.user?.id===userId) globalThis.ui?.notifications?.[level]?.(message);
 else game.socket?.emit(NOTIFICATION_CHANNEL,payload);
}
if(typeof Hooks!=='undefined') Hooks.once('ready',()=>{
 game.socket?.on(NOTIFICATION_CHANNEL,payload=>{
  if(payload?.type!=='fishing-notification'||payload.userId!==game.user.id) return;
  const level=['info','warn','error'].includes(payload.level)?payload.level:'info';
  ui.notifications[level](String(payload.message??''));
 });
});
async function note(actor,text,img=null) {
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<div style="padding:12px;border:1px solid #81505b;border-radius:5px;background:linear-gradient(135deg,#201720,#152a30);color:#eee"><h3 style="color:#e5c790;border:0;margin:0 0 10px">${img?'Удачный улов!':'Рыболовное столкновение'}</h3>${img?`<img src="${esc(img)}" alt="Пойманная рыба" style="display:block;width:120px;height:120px;object-fit:contain;margin:8px auto;border:0">`:''}<p>${esc(text)}</p></div>`});
}

const RULES=`<h3>Рыбачить / Go Fishing</h3><p><em>Исследование • 10 минут</em><br>Нужны удочка, наживка и водоём. Природа, Выживание или Знания рыбалки против КС уровня локации.</p><p><b>Критический успех:</b> два d20 по таблице водоёма, выбрать больший. <b>Успех:</b> один d20. Затем «Выудить добычу». <b>Провал:</b> нет поклёвки. <b>Критический провал:</b> никто не может рыбачить здесь час.</p><h3>Выудить добычу / Reel In ↩</h3><p><em>Манипуляция</em><br>Атлетика, Выживание или Знания рыбалки против КС уровня − 2 + размер рыбы.</p><p><b>Критический успех:</b> трофей, размер +1, цена ×3; на неделю +1 обстоятельства к Дипломатии с местными любителями рыбалки. <b>Успех:</b> рыба поймана. <b>Провал:</b> сорвалась. <b>Критический провал:</b> рыба утаскивает вас в воду на размер × 5 футов.</p><h3>Снаряжение и столкновения</h3><p>Лодка: +2 к d20 таблицы (результат 20+ означает столкновение). Профессиональные снасти: +1 предмета к выуживанию. Части существа: бонус обстоятельства к рыбалке, равный превышению уровня существа над уровнем локации, максимум +5; мастер задаёт уровень наживки снизу.</p><p>Столкновение начинается после успешного выуживания. Существо обычно на 2 уровня выше локации; при критическом успехе оно получает «Ошеломлён 3» в первый ход. Размер существа задаёт мастер. Существо и сокровище по таблице наград за столкновение добавляет мастер.</p><h3>Еда, свежесть и стоимость</h3><p>Размеры 1–6: Крошечный, Маленький, Средний, Большой, Огромный, Исполинский. Рыба кормит столько же человек. Приготовление и длительность эффекта: размер × 10 минут; еда занимает 10 минут. Эффекты еды и трофея применяет мастер по описанию предмета.</p><p>Цена: доход за задачу уровня водоёма. Ценность 1 — провал, 2 — обучен, 3 — эксперт, 4 — мастер, 5 — легенда. Через сутки свежая рыба портится. Заморозка сохраняет её неделю; каждый дополнительный день — чистая проверка КС 11, при провале ценность −1 (минимум 0). Проверки сохранности выполняются при продаже или готовке. Нулевая ценность не даёт пищевого эффекта.</p><h3>Рыбное место / Fishing Spot</h3><p>Заклинание позволяет рыбачить за минуту без снастей в магическом водоёме уровня ранг × 2. Ранг выбирается при использовании; расход ячейки учитывается вручную. Размер и ценность рыбы равны половине ранга (округление вниз, минимум 1). Без заклинания в магическом водоёме: размер = уровень / 4, ценность = уровень / 3, округление вниз.</p>`;
export class FishingApplication extends Application {
 static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:'tsu-fishing',title:'Рыбалка',width:960,height:700,resizable:true,classes:['tsu-window']});}
 async _renderInner(){
 const s=getGameState(ID)??initialState();
 const actors=owned();
 const actor=actors.find(a=>a.id===this.actorId)??actors.find(a=>a.id===game.user.character?.id)??actors[0];
 this.actorId=actor?.id;
 const pending=s.pending[actor?.id];
 const equipment=actor?.items.filter(i=>['rod','professional'].includes(flag(i)?.kind)||/fishing-tackle/.test(i.slug??''))??[];
 const bait=actor?.items.filter(i=>flag(i)?.kind==='bait'&&i.system.quantity>0)??[];
 const fish=actor?.items.filter(i=>flag(i)?.kind==='fish')??[];
 const options=(entries)=>entries.map(([id,stat])=>`<option value="${esc(id)}">${esc(stat.label)}</option>`).join('');
 const table=LOCATIONS[s.location];
 const tab=this.activeTab??'fishing';
 const image='icons/consumables/meat/fish-whole-blue.webp';
 const inventory=[...equipment,...bait];
 const meals=actor?.items.filter(i=>flag(i)?.kind==='meal')??[];
 const inventoryHtml=inventory.length?inventory.map(i=>`<div class="fish-row"><img src="${esc(i.img??'icons/tools/fishing/rod-wood-blue-tan.webp')}" alt=""><div><b>${esc(i.name)}</b><small>${flag(i)?.kind==='bait'?'Наживка':i.system.equipped?.carryType==='held'?'В руках':'В инвентаре'}</small></div><strong>×${i.system.quantity}</strong></div>`).join(''):'<p class="fish-empty">Снастей пока нет. Всё необходимое можно купить рядом.</p>';
 const shopHtml=SHOP.map(p=>`<div class="fish-row"><img src="${p.kind==='bait'?'icons/tools/fishing/hook-dressed-red-green.webp':'icons/tools/fishing/rod-wood-blue-tan.webp'}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.description)}</small></div><button data-action="buy" data-product="${p.id}" ${actor?'':'disabled'}>${money(p.cp)} · Купить</button></div>`).join('');
 const catchHtml=fish.map(i=>{
  const f=flag(i),expired=now()-f.caughtAt>=(f.frozen?7:1)*86400;
  return `<div class="fish-catch"><div class="fish-row"><img src="${image}" alt=""><div><b>${esc(i.name)}</b><small>${SIZES[f.size]} · ${expired?'Испорчена':money(fishPrice(f.level,f.value,f.trophy))}${f.frozen?' · Заморожена':''}</small></div></div><p>${esc(f.effect)}</p><div class="fish-actions"><button data-action="sell" data-item="${i.id}" ${expired?'disabled':''}>Продать</button><button data-action="cook" data-item="${i.id}" ${expired?'disabled':''}>Приготовить · ${f.size*10} мин.</button>${!f.frozen&&!expired?`<button data-action="freeze" data-item="${i.id}" title="Нужен источник холода">Заморозить</button>`:''}</div></div>`;
 }).join('');
 const mealHtml=meals.map(i=>`<div class="fish-row"><img src="${image}" alt=""><div><b>${esc(i.name)}</b><small>${i.system.quantity} порц. · ${flag(i).readyAt>now()?`Готовится, ещё ${Math.ceil((flag(i).readyAt-now())/60)} мин.`:'Готово к подаче'}</small></div></div>`).join('');
 return $(`<style>
 #tsu-fishing .window-content{padding:0!important;display:flex;flex-direction:column;overflow:hidden!important;background:#101114;color:#ddd;min-height:0}
 #tsu-fishing .fish-shell{display:flex;flex-direction:column;flex:1;min-height:0;width:100%;overflow:hidden;font:13px "Signika",sans-serif;--fish-accent:#8a3947}
 .fish-shell *{box-sizing:border-box}.fish-shell button{font:inherit;color:#eee;background:linear-gradient(#373b41,#25282d);border:1px solid #50545b;border-radius:3px;min-height:30px;cursor:pointer;padding:4px 10px;margin:0;width:auto}.fish-shell button:hover{border-color:#c9868e;background:#49323a}.fish-shell button:disabled{opacity:.4;cursor:default}
 .fish-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(110deg,#290d16,#161a20);border-bottom:1px solid #6c2939;flex:none}.fish-head h1{font:23px Georgia,serif;border:0;color:#f0d8d7;margin:0}.fish-subtitle{color:#b1a6a9;font-size:12px;margin-top:4px}
 .fish-toolbar{display:flex;align-items:center;gap:16px;padding:10px 16px;background:#181a1f;flex:none}.fish-toolbar label{flex:1;display:flex;align-items:center;gap:10px;margin:0}.fish-wallet{color:#dabf80;white-space:nowrap}
 .fish-tabs{display:flex;padding:0 16px;background:#181a1f;border-bottom:1px solid #4c3038;gap:4px;flex:none}.fish-tabs button{flex:1;border:0;border-radius:3px 3px 0 0;background:transparent;color:#aaa;padding:10px}.fish-tabs button.active{background:#401722;color:#f3dfdf;box-shadow:inset 0 -2px #bf6977}
 .fish-body{flex:1;min-height:0;overflow:auto;padding:16px;scrollbar-color:#555 #181a1f;scrollbar-width:thin}.fish-pane[hidden]{display:none!important}.fish-columns{display:grid;grid-template-columns:1fr 1.2fr;gap:20px}.fish-shell h3{font:16px Georgia,serif;color:#dcc4c5;border-bottom:1px solid #393237;margin:0 0 12px;padding-bottom:8px}
 .fish-row{display:flex;align-items:center;gap:10px;border-bottom:1px solid #303138;padding:10px 0}.fish-row img{width:38px;height:38px;object-fit:cover;border:1px solid #555;border-radius:3px}.fish-row>div{flex:1;min-width:0}.fish-row b{font-weight:500;color:#e5dedb}.fish-row small{display:block;color:#96969f;font-size:11px;line-height:1.5;margin-top:4px}.fish-row button{white-space:nowrap;font-size:12px}.fish-row strong{color:#c6b686}
 .fish-shell select,.fish-shell input{width:100%;height:30px;background:#202329;color:#ddd;border:1px solid #4b4b54;border-radius:3px;padding:3px 7px;font:inherit}.fish-shell select option{background:#202329;color:#ddd}.fish-shell label{display:block;font-size:12px;color:#aaa;margin:8px 0}.fish-shell input[type=checkbox]{height:14px;width:14px;vertical-align:middle;accent-color:#a54b60}
 .fish-card{max-width:640px;margin:0 auto;padding:18px;background:#191b20;border:1px solid #34343d;border-top:2px solid #874353;border-radius:4px}.fish-cast>label{display:inline-block;width:calc(50% - 8px);margin:6px 3px;vertical-align:top}.fish-cast>button{width:100%;margin-top:16px;min-height:38px;background:linear-gradient(#7b263a,#451522);border-color:#9b4b5e}.fish-magic{margin-top:10px;color:#999;font-size:12px}.fish-shell summary{cursor:pointer;padding:8px 0}.fish-log{font-size:12px;color:#aaa;padding:6px 0}.fish-history{max-width:640px;margin:12px auto;color:#888}.fish-empty{padding:24px 12px;text-align:center;color:#888;font-size:13px}.fish-muted{color:#999;font-size:12px}
 .fish-catch{padding:0 14px 12px;border:1px solid #3a343b;border-radius:4px;background:#191b20;margin-bottom:12px}.fish-catch p{font-size:12px;color:#aaa}.fish-actions{display:flex;gap:8px;flex-wrap:wrap}.fish-footer{flex:none;background:linear-gradient(#1a1017,#101115);border-top:1px solid #49323d;display:flex;flex-wrap:wrap;align-items:end;gap:8px;padding:10px 14px;max-height:35%;overflow:auto}.fish-footer label{flex:1;min-width:100px;margin:0;font-size:11px}.fish-footer-title{width:100%;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#b18b94}.fish-footer button{font-size:11px}
 </style><div class="fish-shell"><header class="fish-head"><div><h1>Рыбалка</h1><div class="fish-subtitle">${esc(table.name)} · уровень ${s.level} · КС ${DC[s.level]}${s.blockedUntil>now()?` · Рыба напугана ещё ${Math.ceil((s.blockedUntil-now())/60)} мин.`:''}</div></div><button data-action="rules">Правила</button></header>
 <div class="fish-toolbar"><label>Персонаж <select name="actor">${actors.map(a=>`<option value="${a.id}" ${a.id===actor?.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><span class="fish-wallet">${actor?money(actor.inventory.coins.copperValue):'Нет персонажа'}</span></div>
 <nav class="fish-tabs" aria-label="Разделы рыбалки">${[['gear','Снаряжение и магазин'],['fishing','Рыбалка'],['catch','Улов · Продажа и готовка']].map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav>
 <main class="fish-body"><section class="fish-pane" data-pane="gear" ${tab!=='gear'?'hidden':''}><div class="fish-columns"><div><h3>Мои снасти</h3>${inventoryHtml}</div><div><h3>Рыболовная лавка</h3>${shopHtml}</div></div></section>
 <section class="fish-pane" data-pane="fishing" ${tab!=='fishing'?'hidden':''}>${actor?`<div class="fish-card fish-cast"><h3>${pending?'Рыба на крючке':'Забросить удочку'}</h3>${pending?`<p>${esc(pending.name)} · ${SIZES[pending.size]} · КС ${DC[pending.level]-2+pending.size}</p><label>Навык<select name="skill">${options(skills(actor,true))}</select></label><button data-action="reel">Выудить добычу ↩</button>`:`<label>Навык<select name="skill">${options(skills(actor))}</select></label><label>Удочка / снасти<select name="rod">${equipment.length?'':'<option value="">Купите удочку в лавке</option>'}${equipment.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label><label>Наживка<select name="bait">${bait.map(i=>`<option value="${i.id}">${esc(i.name)} ×${i.system.quantity}</option>`).join('')}</select></label><label><input type="checkbox" name="boat"> Рыбалка с лодки</label><details class="fish-magic"><summary>Рыбалка с помощью магии</summary><p>Заклинание Fishing Spot: 1 минута, снасти не нужны.</p><label><input name="useSpell" type="checkbox"> Использовать заклинание</label><label>Ранг заклинания<input name="spellRank" type="number" value="1" min="1" max="10"></label></details><button data-action="fish" ${s.blockedUntil>now()?'disabled':''}>Рыбачить</button>`}</div>`:'<p class="fish-empty">Выберите доступного персонажа.</p>'}<details class="fish-history"><summary>История рыбалки</summary>${s.log.map(t=>`<div class="fish-log">${esc(t)}</div>`).join('')}</details></section>
 <section class="fish-pane" data-pane="catch" ${tab!=='catch'?'hidden':''}><h3>Свежий улов</h3>${catchHtml||'<p class="fish-empty">Здесь появится пойманная рыба.</p>'}${meals.length?`<h3>На кухне</h3>${mealHtml}`:''}</section></main>${game.user.isGM?`<footer class="fish-footer"><div class="fish-footer-title"><i class="fas fa-sliders-h"></i> Управление водоёмом · Мастер</div><label>Вид локации<select name="location">${Object.entries(LOCATIONS).map(([id,l])=>`<option value="${id}" ${id===s.location?'selected':''}>${l.name}</option>`).join('')}</select></label><label>Уровень<input name="level" type="number" min="0" max="20" value="${s.level}"></label><label>Размер существа<select name="combatSize">${sizeOptions(s.combatSize)}</select></label><label>Уровень существа-наживки<input name="baitLevel" type="number" min="-1" max="25" value="${s.baitLevel??-1}" title="−1: обычная наживка"></label><button data-action="configure">Применить</button><button data-action="advance">+10 минут</button><button data-action="clear-block">Снять испуг</button></footer>`:''}</div>`);
 }

 openRules() {
  const s=getGameState(ID)??initialState();
  const table=LOCATIONS[s.location];
  const rows=table.limits.map((limit,i)=>`<tr><td>${i?table.limits[i-1]+1:1}–${limit}</td><td>${esc(table.fish[i])}</td><td>${s.location==='magic'?'Особый':SIZES[i+1]}</td></tr>`).join('');
  new Dialog({title:'Рыбалка · Правила',content:`<article style="padding:12px;line-height:1.6">${RULES}<h3>${esc(table.name)} · Таблица улова</h3><table>${rows}<tr><td>20+</td><td>Рыболовное столкновение</td><td>Особый</td></tr></table></article>`,buttons:{close:{label:'Закрыть'}},default:'close'},{width:640,height:700,resizable:true}).render(true);
 }
 activateListeners(html){super.activateListeners(html);html.find('[data-tab]').on('click',e=>{this.activeTab=e.currentTarget.dataset.tab;html.find('[data-pane]').each((_i,el)=>{el.hidden=el.dataset.pane!==this.activeTab;});html.find('[data-tab]').each((_i,el)=>{const active=el.dataset.tab===this.activeTab;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});});html.find('[name=actor]').on('change',e=>{this.actorId=e.currentTarget.value;this.render(false);});html.find('[data-action]').on('click',async e=>{const b=e.currentTarget;if(b.dataset.action==='rules'){this.openRules();return;}const val=n=>html.find(`[name=${n}]`).val();b.disabled=true;try{if(!game.user.isGM&&!game.users.activeGM)return ui.notifications.warn('Для рыбалки нужен подключённый мастер.');await requestGameAction(ID,b.dataset.action,{actorId:this.actorId,itemId:b.dataset.item,product:b.dataset.product,skill:val('skill'),rodId:val('rod'),baitId:val('bait'),boat:html.find('[name=boat]').prop('checked'),spellRank:html.find('[name=useSpell]').prop('checked')?Number(val('spellRank')):0,location:val('location'),level:Number(val('level')),combatSize:Number(val('combatSize')),baitLevel:Number(val('baitLevel'))});}catch(error){console.error(error);ui.notifications.error(error.message);}finally{b.disabled=false;}});}
}
async function handleAction({action,data,state:s,senderId,canUserControlActor}) {
 const sender=game.users.get(senderId);
 if(!sender) return false;
 const report=text=>{log(s,text);showNotification(senderId,text);};
 if(['configure','advance','clear-block'].includes(action)){
  if(!sender.isGM)return false;
  if(action==='advance')await game.time.advance(600);
  if(action==='clear-block')s.blockedUntil=0;
  if(action==='configure'){
   if(!Object.hasOwn(LOCATIONS,data.location)||!Number.isInteger(data.level)||data.level<0||data.level>20||!Number.isInteger(data.combatSize)||data.combatSize<1||data.combatSize>6||!Number.isInteger(data.baitLevel)||data.baitLevel< -1||data.baitLevel>25)return false;
   Object.assign(s,{location:data.location,level:data.level,combatSize:data.combatSize,baitLevel:data.baitLevel});
  }
  return true;
 }
 const actor=game.actors.get(data.actorId);
 if(!actor||actor.type!=='character'||!canUserControlActor(actor.id,senderId))return false;
 if(action==='buy'){
  const p=SHOP.find(p=>p.id===data.product);if(!p)return false;
  if(!await actor.inventory.removeCoins({cp:p.cp},{byValue:true})){showNotification(senderId,'Недостаточно монет для покупки.','warn');return false;}
  try{await actor.createEmbeddedDocuments('Item',[{name:p.name,type:'equipment',img:p.kind==='bait'?'icons/tools/fishing/hook-dressed-red-green.webp':'icons/tools/fishing/rod-wood-blue-tan.webp',system:{quantity:p.quantity,price:{value:{cp:p.kind==='bait'?1:p.cp}},description:{value:`<p>${p.description}</p>`},equipped:{carryType:p.kind==='bait'?'worn':'held',handsHeld:p.kind==='bait'?0:2}},flags:{[MODULE_ID]:{fishing:{kind:p.kind}}}}]);}catch(error){await actor.inventory.addCoins({cp:p.cp});throw error;}
  report(`${actor.name}: покупка «${p.name}», ${money(p.cp)}.`);return true;
 }
 if(action==='freeze'||action==='sell'||action==='cook'){
  const item=actor.items.get(data.itemId);const f=item&&flag(item);if(f?.kind!=='fish'||item.system.quantity<1)return false;
  const age=now()-f.caughtAt;
  if(action==='freeze'){if(f.frozen||age>=86400)return false;await item.setFlag(MODULE_ID,'fishing',{...f,frozen:true});report(`${actor.name}: рыба заморожена; наличие источника холода подтверждает мастер.`);return true;}
  const updated={...f};
  if(age>=(f.frozen?7:1)*86400) updated.value=0;
  else if(f.frozen){const days=Math.max(0,Math.floor(age/86400));for(let day=f.checkedDays??0;day<days;day++){const roll=await new Roll('1d20').evaluate();if(roll.total<11)updated.value=Math.max(0,updated.value-1);}updated.checkedDays=days;}
  await item.setFlag(MODULE_ID,'fishing',updated);
  if(action==='cook') {
   if(age>=(f.frozen?7:1)*86400){showNotification(senderId,'Испорченную рыбу нельзя приготовить.','warn');return true;}
   const portions=f.size;
   const effect=updated.value>0?f.effect:'Обычная еда без особого эффекта.';
   const description=`<p>${esc(effect)}</p><p>Приготовление: ${portions*10} минут. Приём пищи: 10 минут. Эффект: ${portions*10} минут. Порций: ${portions}.</p>`;
   const meals=await actor.createEmbeddedDocuments('Item',[{name:`Приготовленная рыба: ${f.name}`,type:'equipment',img:'icons/consumables/meat/fish-whole-blue.webp',system:{quantity:portions,price:{value:{cp:0}},description:{value:description}},flags:{[MODULE_ID]:{fishing:{kind:'meal',effect,readyAt:now()+portions*600,location:f.location,level:f.level,size:f.size}}}}]);
   try {
    if(item.system.quantity>1)await item.update({'system.quantity':item.system.quantity-1});else await item.delete();
   } catch(error) {
    for(const meal of meals)await meal.delete();
    throw error;
   }
   report(`${actor.name}: готовится «${f.name}», ${portions} порц. Будет готово через ${portions*10} мин.`);
   return true;
  }
  const cp=fishPrice(f.level,updated.value,f.trophy);if(!cp){report(`${actor.name}: рыба не имеет продажной стоимости.`);return true;}
  const snapshot=item.toObject();
  if(item.system.quantity>1)await item.update({'system.quantity':item.system.quantity-1});else await item.delete();
  try{await actor.inventory.addCoins({cp});}catch(error){if(actor.items.has(item.id))await actor.items.get(item.id).update({'system.quantity':snapshot.system.quantity});else await actor.createEmbeddedDocuments('Item',[snapshot],{keepId:true});throw error;}
  report(`${actor.name}: продана «${item.name}» за ${money(cp)}.`);return true;
 }
 if(action==='fish'){
  if(s.pending[actor.id]||s.blockedUntil>now())return false;
  const rank=data.spellRank;
  if(!Number.isInteger(rank)||rank<0||rank>10||!skills(actor).some(([k])=>k===data.skill))return false;
  const rod=actor.items.get(data.rodId),bait=actor.items.get(data.baitId);
  if(!rank&&(!rod||!(['rod','professional'].includes(flag(rod)?.kind)||/fishing-tackle/.test(rod.slug??''))||rod.system.quantity<1||rod.system.equipped?.carryType!=='held'||!bait||flag(bait)?.kind!=='bait'||bait.system.quantity<1)){showNotification(senderId,'Нужны удочка в руках и наживка. Проверьте снаряжение в листе персонажа.','warn');return false;}
  const location=rank?'magic':s.location,level=rank?rank*2:s.level;
  const bonus=Math.max(0,Math.min(5,(s.baitLevel??-1)-level));
  const modifiers=!rank&&bonus?[new game.pf2e.Modifier({label:'Наживка из существа',modifier:bonus,type:'circumstance'})]:[];
  const result=await check(actor,data.skill,DC[level],modifiers,'Рыбачить');if(result===null)return false;
  if(!rank)await bait.update({'system.quantity':bait.system.quantity-1});
  if(result===0){s.blockedUntil=now()+3600;report(`${actor.name}: критический провал — рыба напугана на час.`);return true;}
  if(result===1){report(`${actor.name}: рыба не клюёт (${rank?1:10} мин.).`);return true;}
  const roll=await new Roll(`${result===3?'2d20kh':'1d20'}${data.boat?'+2':''}`).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:`Рыбалка: ${LOCATIONS[location].name}`});
  s.pending[actor.id]={...catchForRoll(location,level,roll.total,{spellRank:rank,combatSize:s.combatSize}),professional:!rank&&(flag(rod)?.kind==='professional'||/professional/.test(rod.slug??'')),rodId:rank?null:rod.id};
  report(`${actor.name}: на крючке — ${s.pending[actor.id].name} (${rank?1:10} мин.).`);return true;
 }
 if(action==='reel'){
  const f=s.pending[actor.id];if(!f||!skills(actor,true).some(([k])=>k===data.skill))return false;
  const rod=f.rodId?actor.items.get(f.rodId):null;
  if(f.rodId&&(!rod||rod.system.quantity<1||rod.system.equipped?.carryType!=='held'))return false;
  const modifiers=f.professional?[new game.pf2e.Modifier({label:'Профессиональные снасти',modifier:1,type:'item'})]:[];
  const result=await check(actor,data.skill,DC[f.level]-2+f.size,modifiers,'Выудить добычу');if(result===null)return false;
  let message;
  let catchImage=null;
  if(result<2)message=result===0?`Рыба утаскивает вас в воду на ${f.size*5} футов!`:'Рыба сорвалась.';
  else if(f.combat)message=`Рыболовное столкновение! Существо уровня ${f.level+2}.${result===3?' Ошеломлён 3 в первый ход.':''} Существо и награду добавляет мастер.`;
  else {
   const trophy=result===3;const size=Math.min(6,f.size+(trophy?1:0));const cp=fishPrice(f.level,f.value,trophy);
   const name=`${trophy?'Трофей: ':''}${f.name}`;
   await actor.createEmbeddedDocuments('Item',[{name,type:'treasure',img:'icons/consumables/meat/fish-whole-blue.webp',system:{quantity:1,price:{value:{cp}},description:{value:`<p>${esc(f.effect)}</p><p>Размер: ${SIZES[size]}; порций: ${size}. Приготовление и эффект: ${size*10} мин. Еда: 10 мин.</p>${trophy?'<p>На неделю +1 обстоятельства к Дипломатии с местными любителями рыбалки.</p>':''}`}},flags:{[MODULE_ID]:{fishing:{...f,kind:'fish',size,trophy,caughtAt:now(),checkedDays:0}}}}]);
   catchImage='icons/consumables/meat/fish-whole-blue.webp';
   message=`Поймана ${name}, ${SIZES[size]}, ${money(cp)}.`;
  }
  delete s.pending[actor.id];log(s,`${actor.name}: ${message}`);if(result>=2)await note(actor,message,catchImage);else showNotification(senderId,message,'warn');return true;
 }
 return false;
}
export function createFishingGameDefinition(){return {id:ID,primaryGMOnly:true,i18nRoot:'Games.Fishing',createInitialState:initialState,createApplication:()=>new FishingApplication(),handleAction};}
