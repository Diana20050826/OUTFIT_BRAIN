const STORAGE_KEYS = {
  items: "outfitBrain_items_v1",
  outfits: "outfitBrain_outfits_v1",
  plans: "outfitBrain_plans_v1",
  shopping: "outfitBrain_shopping_v1",
  budget: "outfitBrain_budget_v1",
  sync: "outfitBrain_sync_v1"
};
const $ = (selector) => document.querySelector(selector);
let items = loadData(STORAGE_KEYS.items);
let outfits = loadData(STORAGE_KEYS.outfits);
let plans = loadData(STORAGE_KEYS.plans);
let shopping = loadData(STORAGE_KEYS.shopping);
let budget = Number(localStorage.getItem(STORAGE_KEYS.budget) || 0);
let selectedIds = new Set();
let pendingImage = "";
let toastTimer;
let installPrompt = null;

function loadData(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    localStorage.setItem(STORAGE_KEYS.outfits, JSON.stringify(outfits));
    localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(plans));
    localStorage.setItem(STORAGE_KEYS.shopping, JSON.stringify(shopping));
    localStorage.setItem(STORAGE_KEYS.budget, String(budget));
    return true;
  } catch (error) {
    console.error("Não foi possível guardar os dados:", error);
    showToast("O armazenamento está cheio. Exporta uma cópia e reduz as fotografias.");
    return false;
  }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function makeId() { return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function euro(value) { return Number(value || 0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}); }
function showToast(message) {
  const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),3200);
}
function statusLabel(status) { return ({available:"Disponível",wash:"Para lavar",borrowed:"Emprestada"})[status] || "Disponível"; }
function getColorHex(color) {
  return ({"Preto":"#222","Branco":"#fff","Bege":"#d9c6a5","Castanho":"#795548","Cinzento":"#9a9a9a","Azul":"#4275a8","Verde":"#718e63","Vermelho":"#c74e47","Rosa":"#df9ba8","Amarelo":"#e7c85c","Multicolor":"linear-gradient(135deg,#d97757,#d9bd6b,#75966c,#7394bb)","Sem indicação":"#e8e6de"})[color] || "#e8e6de";
}
function getItemImage(item) {
  return item.image ? `<img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy">` : `<span class="photo-placeholder" aria-hidden="true">♧</span>`;
}
function renderClothingCard(item, mode="wardrobe") {
  const id=escapeHTML(item.id), selected=selectedIds.has(item.id), category=escapeHTML(item.category), name=escapeHTML(item.name), color=escapeHTML(item.color||"Sem indicação"), status=item.status||"available";
  let actions="";
  if(mode==="builder") actions=`<div class="card-actions"><button class="${selected?"selected-action":""}" data-toggle-item="${id}">${selected?"✓ Selecionada":"＋ Adicionar ao look"}</button></div>`;
  else if(mode==="wardrobe") actions=`<div class="card-actions"><button data-edit-item="${id}">Editar</button><button class="delete-action" data-delete-item="${id}" aria-label="Apagar ${name}">×</button></div>
    <div class="item-quick-actions"><button data-wear-item="${id}">✓ Usei hoje</button><button data-status-item="${id}" data-next-status="${status==="available"?"wash":status==="wash"?"borrowed":"available"}">Estado: ${statusLabel(status)}</button></div>`;
  return `<article class="clothing-card"><div class="clothing-photo">${getItemImage(item)}<span class="category-chip">${category}</span></div><div class="clothing-info"><h3>${name}</h3><div class="clothing-meta"><span class="color-dot" style="background:${getColorHex(color)}"></span><span>${color}</span>${item.season&&item.season!=="Todas"?`<span>· ${escapeHTML(item.season)}</span>`:""}</div>${mode==="wardrobe"?`<span class="item-status ${status==="wash"?"wash":status==="borrowed"?"borrowed":""}">${statusLabel(status)} · ${Number(item.wears||0)} utilizações</span>${item.price!==""&&item.price!=null?`<div class="clothing-meta" style="margin-top:7px">Compra: ${euro(item.price)} · ${Number(item.wears||0)>0?`${euro(Number(item.price)/Number(item.wears))}/uso`:"ainda sem utilizações"}</div>`:""}`:""}${actions}</div></article>`;
}
function renderStats() {
  $("#statItems").textContent=items.length; $("#statOutfits").textContent=outfits.length;
  $("#statFavorites").textContent=outfits.filter(o=>o.favorite).length;
  $("#statAvailable").textContent=items.filter(i=>(i.status||"available")==="available").length;
}
function renderDashboard() {
  const recent=[...items].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,4);
  $("#recentItems").innerHTML=recent.map(i=>renderClothingCard(i,"recent")).join("");
  $("#recentEmpty").classList.toggle("hidden",items.length>0); $("#recentItems").classList.toggle("hidden",!recent.length);
}
function renderWardrobe() {
  const query=$("#searchItems").value.trim().toLowerCase(), category=$("#filterCategory").value, color=$("#filterColor").value, status=$("#filterStatus").value, sort=$("#sortItems").value;
  let filtered=items.filter(item=>{
    const text=`${item.name} ${item.category} ${item.color} ${item.notes||""}`.toLowerCase();
    return text.includes(query)&&(category==="all"||item.category===category)&&(color==="all"||(item.color||"Sem indicação")===color)&&(status==="all"||(item.status||"available")===status);
  });
  if(sort==="newest")filtered.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(sort==="oldest")filtered.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  if(sort==="name")filtered.sort((a,b)=>a.name.localeCompare(b.name,"pt"));
  if(sort==="mostWorn")filtered.sort((a,b)=>(b.wears||0)-(a.wears||0));
  $("#wardrobeGrid").innerHTML=filtered.map(i=>renderClothingCard(i,"wardrobe")).join(""); $("#wardrobeEmpty").classList.toggle("hidden",filtered.length>0);
}
function renderBuilder() {
  const query=$("#searchBuilder").value.trim().toLowerCase(), category=$("#builderCategory").value;
  const filtered=items.filter(i=>`${i.name} ${i.category} ${i.color}`.toLowerCase().includes(query)&&(category==="all"||i.category===category)&&(i.status||"available")==="available").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("#builderGrid").innerHTML=filtered.map(i=>renderClothingCard(i,"builder")).join(""); $("#builderEmpty").classList.toggle("hidden",items.filter(i=>(i.status||"available")==="available").length>0);
  $("#selectedCount").textContent=selectedIds.size; $("#selectedEmpty").classList.toggle("hidden",selectedIds.size>0);
  $("#selectedGrid").innerHTML=items.filter(i=>selectedIds.has(i.id)).map(item=>`<div class="selected-piece">${getItemImage(item)}<button class="remove-selected" data-toggle-item="${escapeHTML(item.id)}" aria-label="Remover ${escapeHTML(item.name)}">×</button><span>${escapeHTML(item.name)}</span><button class="item-quick-actions" style="border:0;background:#fff;border-radius:7px;padding:5px;font-size:9px" data-swap-item="${escapeHTML(item.id)}">Trocar peça</button></div>`).join("");
}
function renderOutfitCard(outfit) {
  const outfitItems=(outfit.itemIds||[]).map(id=>items.find(i=>i.id===id)).filter(Boolean);
  const collage=outfitItems.slice(0,3).map(i=>i.image?`<img src="${i.image}" alt="${escapeHTML(i.name)}" loading="lazy">`:`<div class="collage-placeholder">♧</div>`).join("");
  return `<article class="outfit-card"><div class="outfit-collage">${collage||'<div class="collage-placeholder">✳</div>'}</div><div class="outfit-details"><h3>${escapeHTML(outfit.name)}</h3><p>${outfitItems.length} ${outfitItems.length===1?"peça":"peças"} · Guardado em ${new Date(outfit.createdAt).toLocaleDateString("pt-PT")}</p><div class="outfit-actions"><button class="${outfit.favorite?"favorite-on":""}" data-favorite-outfit="${escapeHTML(outfit.id)}">${outfit.favorite?"♥ Favorito":"♡ Favoritar"}</button><button data-load-outfit="${escapeHTML(outfit.id)}">Editar look</button><button data-wear-outfit="${escapeHTML(outfit.id)}">Usei este look</button><button data-delete-outfit="${escapeHTML(outfit.id)}">Apagar</button></div></div></article>`;
}
function renderOutfits() {
  $("#outfitsGrid").innerHTML=[...outfits].sort((a,b)=>b.createdAt-a.createdAt).map(renderOutfitCard).join("");
  $("#outfitsEmpty").classList.toggle("hidden",outfits.length>0);
  const fav=outfits.filter(o=>o.favorite).sort((a,b)=>b.createdAt-a.createdAt);
  $("#favoritesGrid").innerHTML=fav.map(renderOutfitCard).join(""); $("#favoritesEmpty").classList.toggle("hidden",fav.length>0);
  const select=$("#planOutfit"),previous=select.value;
  select.innerHTML='<option value="">Escolhe um look guardado</option>'+[...outfits].sort((a,b)=>a.name.localeCompare(b.name,"pt")).map(o=>`<option value="${escapeHTML(o.id)}">${escapeHTML(o.name)}</option>`).join("");
  if(outfits.some(o=>o.id===previous))select.value=previous;
}
function renderPlans() {
  const sorted=[...plans].sort((a,b)=>a.date.localeCompare(b.date));
  const valid=sorted.filter(p=>outfits.some(o=>o.id===p.outfitId));
  $("#plannerList").innerHTML=valid.map(plan=>{
    const outfit=outfits.find(o=>o.id===plan.outfitId),date=new Date(`${plan.date}T12:00:00`);
    return `<article class="plan-card"><div class="plan-date"><strong>${date.toLocaleDateString("pt-PT",{day:"2-digit"})}</strong><small>${date.toLocaleDateString("pt-PT",{month:"short"}).replace(".","")}</small></div><div class="plan-info"><strong>${escapeHTML(outfit.name)}</strong><small>${date.toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</small></div><button data-delete-plan="${escapeHTML(plan.id)}">Remover</button></article>`;
  }).join(""); $("#plannerEmpty").classList.toggle("hidden",valid.length>0); renderWeek();
}
function renderWeek() {
  const today=new Date(),start=new Date(today); start.setHours(12,0,0,0); start.setDate(today.getDate()-((today.getDay()+6)%7));
  $("#weekGrid").innerHTML=Array.from({length:7},(_,index)=>{
    const date=new Date(start);date.setDate(start.getDate()+index);const key=localDateString(date);
    const dayPlans=plans.filter(p=>p.date===key).map(p=>({plan:p,outfit:outfits.find(o=>o.id===p.outfitId)})).filter(x=>x.outfit);
    return `<div class="week-day ${key===localDateString()?"today":""}"><h4>${date.toLocaleDateString("pt-PT",{weekday:"short"})}</h4><strong>${date.getDate()}</strong>${dayPlans.map(x=>`<div class="week-plan">${escapeHTML(x.outfit.name)}</div>`).join("")||'<div class="muted" style="font-size:9px;margin-top:8px">Sem look</div>'}</div>`;
  }).join("");
}
function renderInsights() {
  const total=items.reduce((sum,i)=>sum+Number(i.wears||0),0),value=items.reduce((sum,i)=>sum+Number(i.price||0),0);
  $("#totalWears").textContent=total;$("#wardrobeValue").textContent=euro(value);$("#neverWorn").textContent=items.filter(i=>!Number(i.wears||0)).length;
  const ranked=[...items].sort((a,b)=>(b.wears||0)-(a.wears||0));
  const rows=(list,cost=false)=>list.slice(0,6).map(i=>`<div class="rank-row"><div><strong>${escapeHTML(i.name)}</strong><small>${escapeHTML(i.category)} · ${Number(i.wears||0)} utilizações</small></div><strong>${cost?(Number(i.wears)>0?euro(Number(i.price||0)/Number(i.wears)):"—"):Number(i.wears||0)}</strong></div>`).join("")||'<p class="muted">Adiciona peças para veres as estatísticas.</p>';
  $("#mostWornList").innerHTML=rows(ranked);$("#leastWornList").innerHTML=rows([...items].sort((a,b)=>(a.wears||0)-(b.wears||0)));$("#costPerWearList").innerHTML=rows([...items].filter(i=>i.price!==""&&i.price!=null).sort((a,b)=>(Number(a.price)/(Number(a.wears)||1))-(Number(b.price)/(Number(b.wears)||1))),true);
}
function renderShopping() {
  $("#shoppingBudget").value=budget||"";const total=shopping.filter(s=>!s.done).reduce((sum,s)=>sum+Number(s.price||0),0);
  $("#shoppingTotal").textContent=euro(total);$("#budgetRemaining").textContent=budget>0?euro(budget-total):"Define um orçamento";
  $("#budgetRemaining").style.color=budget>0&&total>budget?"#b34e45":"";
  $("#shoppingList").innerHTML=shopping.map(s=>`<div class="shopping-item ${s.done?"done":""}"><input type="checkbox" data-shop-done="${escapeHTML(s.id)}" ${s.done?"checked":""} aria-label="Marcar ${escapeHTML(s.name)} como comprada"><span class="shopping-name">${escapeHTML(s.name)}</span><span class="shopping-price">${euro(s.price)}</span><button data-delete-shop="${escapeHTML(s.id)}" aria-label="Apagar ${escapeHTML(s.name)}">×</button></div>`).join("");
  $("#shoppingEmpty").classList.toggle("hidden",shopping.length>0);
}
function renderAll(){renderStats();renderDashboard();renderWardrobe();renderBuilder();renderOutfits();renderPlans();renderInsights();renderShopping();$("#storageInfo").textContent=`${items.length} peças · ${outfits.length} looks · ${plans.length} planos · ${shopping.length} itens de compras guardados neste navegador.`;}
const pageTitles={dashboard:"O teu armário, com ideias.",wardrobe:"Cada peça no seu lugar.",outfits:"Combina à tua maneira.",planner:"Prepara os teus próximos dias.",favorites:"Os teus looks preferidos.",insights:"Conhece o teu estilo.",shopping:"Compra com intenção.",settings:"Os teus dados, contigo."};
function navigateTo(page){if(!document.getElementById(page))return;document.querySelectorAll(".page").forEach(s=>s.classList.toggle("active",s.id===page));document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#pageName").textContent=pageTitles[page]||"OUTFIT BRAIN";window.scrollTo({top:0,behavior:"smooth"});if(page==="wardrobe")renderWardrobe();if(page==="outfits")renderBuilder();if(page==="planner")renderPlans();if(page==="insights")renderInsights();if(page==="shopping")renderShopping();}
function openModal(){ $("#itemModal").classList.remove("hidden");document.body.style.overflow="hidden";setTimeout(()=>$("#itemName").focus(),100);}
function resetImagePreview(){pendingImage="";$("#uploadPreview").src="";$("#uploadPreview").classList.add("hidden");$("#uploadIcon").classList.remove("hidden");$("#uploadText").textContent="Adicionar fotografia";$(".upload-area").classList.remove("has-preview");$("#itemImage").value="";}
function closeModal(){ $("#itemModal").classList.add("hidden");document.body.style.overflow="";$("#itemForm").reset();resetImagePreview();$("#modalTitle").textContent="Nova peça";$("#itemForm").dataset.editing="";}
function compressImage(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith("image/"))return reject(new Error("Escolhe um ficheiro de imagem."));const reader=new FileReader();reader.onerror=()=>reject(new Error("Não foi possível ler a fotografia."));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("Não foi possível abrir a fotografia."));image.onload=()=>{const max=1000,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.76));};image.src=reader.result;};reader.readAsDataURL(file);});}
$("#itemImage").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{pendingImage=await compressImage(file);$("#uploadPreview").src=pendingImage;$("#uploadPreview").classList.remove("hidden");$("#uploadIcon").classList.add("hidden");$("#uploadText").textContent="Fotografia selecionada";$(".upload-area").classList.add("has-preview");}catch(err){showToast(err.message||"Não foi possível carregar a fotografia.");}});
$("#itemForm").addEventListener("submit",e=>{
  e.preventDefault();const name=$("#itemName").value.trim(),category=$("#itemCategory").value;if(!name||!category){showToast("Preenche o nome e a categoria da peça.");return;}
  const editingId=$("#itemForm").dataset.editing,old=items.find(i=>i.id===editingId);
  const item={id:editingId||makeId(),name,category,color:$("#itemColor").value,season:$("#itemSeason").value,status:$("#itemStatus").value,price:$("#itemPrice").value===""?"":Number($("#itemPrice").value),wears:Math.max(0,Number($("#itemWears").value)||0),notes:$("#itemNotes").value.trim(),image:pendingImage||old?.image||"",createdAt:old?.createdAt||Date.now(),lastWorn:old?.lastWorn||null};
  const previous=items.slice();items=editingId?items.map(i=>i.id===editingId?item:i):[...items,item];if(!saveData()){items=previous;return;}closeModal();renderAll();showToast(editingId?"Peça atualizada!":"Peça adicionada ao armário!");
});
function editItem(id){const item=items.find(i=>i.id===id);if(!item)return;$("#itemForm").dataset.editing=id;$("#modalTitle").textContent="Editar peça";$("#itemName").value=item.name;$("#itemCategory").value=item.category;$("#itemColor").value=item.color||"Sem indicação";$("#itemSeason").value=item.season||"Todas";$("#itemStatus").value=item.status||"available";$("#itemPrice").value=item.price??"";$("#itemWears").value=item.wears||0;$("#itemNotes").value=item.notes||"";pendingImage=item.image||"";if(pendingImage){$("#uploadPreview").src=pendingImage;$("#uploadPreview").classList.remove("hidden");$("#uploadIcon").classList.add("hidden");$("#uploadText").textContent="Alterar fotografia";$(".upload-area").classList.add("has-preview");}openModal();}
function deleteItem(id){const item=items.find(i=>i.id===id);if(!item||!confirm(`Queres apagar "${item.name}" do teu armário?`))return;const oldItems=items,oldOutfits=outfits;items=items.filter(i=>i.id!==id);selectedIds.delete(id);outfits=outfits.map(o=>({...o,itemIds:(o.itemIds||[]).filter(x=>x!==id)}));if(!saveData()){items=oldItems;outfits=oldOutfits;return;}renderAll();showToast("Peça apagada.");}
function toggleSelectedItem(id){if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);renderBuilder();}
function clearBuilder(){selectedIds.clear();$("#outfitName").value="";renderBuilder();}
function swapSelectedItem(id){const current=items.find(i=>i.id===id);if(!current)return;const candidates=items.filter(i=>!selectedIds.has(i.id)&&(i.status||"available")==="available");if(!candidates.length){showToast("Não há outras peças disponíveis para trocar.");return;}const preferred=candidates.filter(i=>i.category===current.category);const list=preferred.length?preferred:candidates;const names=list.map((i,index)=>`${index+1}. ${i.name} (${i.category})`).join("\n");const choice=prompt(`Escolhe o número da peça para substituir "${current.name}":\n${names}`);if(choice===null)return;const n=Number(choice);if(!Number.isInteger(n)||n<1||n>list.length){showToast("Número inválido.");return;}selectedIds.delete(id);selectedIds.add(list[n-1].id);renderBuilder();}
function generateCombination(){const available=items.filter(i=>(i.status||"available")==="available");if(available.length<2){showToast("Precisas de pelo menos duas peças disponíveis.");return;}const pick=list=>list[Math.floor(Math.random()*list.length)],chosen=[];const dresses=available.filter(i=>i.category==="Vestidos"),tops=available.filter(i=>i.category==="Tops"),bottoms=available.filter(i=>["Calças","Saias"].includes(i.category)),jackets=available.filter(i=>i.category==="Casacos"),shoes=available.filter(i=>i.category==="Calçado"),accessories=available.filter(i=>i.category==="Acessórios");if(dresses.length&&Math.random()<.45)chosen.push(pick(dresses));else{if(tops.length)chosen.push(pick(tops));if(bottoms.length)chosen.push(pick(bottoms));}if(jackets.length&&Math.random()<.55)chosen.push(pick(jackets));if(shoes.length&&Math.random()<.8)chosen.push(pick(shoes));if(accessories.length&&Math.random()<.4)chosen.push(pick(accessories));while(chosen.length<Math.min(2,available.length)){const rest=available.filter(i=>!chosen.some(c=>c.id===i.id));if(!rest.length)break;chosen.push(pick(rest));}selectedIds=new Set(chosen.map(i=>i.id));$("#outfitName").value="Look surpresa";renderBuilder();showToast("Combinação criada! Podes trocar qualquer peça.");}
function saveOutfit(){const chosen=items.filter(i=>selectedIds.has(i.id));if(chosen.length<2){showToast("Seleciona pelo menos duas peças.");return;}const name=$("#outfitName").value.trim()||`Look ${outfits.length+1}`,editingId=$("#outfitName").dataset.editing;let oldOutfits=outfits.slice();if(editingId&&outfits.some(o=>o.id===editingId)){outfits=outfits.map(o=>o.id===editingId?{...o,name,itemIds:chosen.map(i=>i.id)}:o);$("#outfitName").dataset.editing="";}else outfits.push({id:makeId(),name,itemIds:chosen.map(i=>i.id),favorite:false,createdAt:Date.now()});if(!saveData()){outfits=oldOutfits;return;}clearBuilder();renderAll();showToast("Look guardado na tua coleção!");}
function toggleFavorite(id){const o=outfits.find(x=>x.id===id);if(!o)return;o.favorite=!o.favorite;if(!saveData()){o.favorite=!o.favorite;return;}renderAll();showToast(o.favorite?"Adicionado aos favoritos!":"Retirado dos favoritos.");}
function loadOutfit(id){const o=outfits.find(x=>x.id===id);if(!o)return;selectedIds=new Set(o.itemIds.filter(x=>items.some(i=>i.id===x)));$("#outfitName").value=o.name;$("#outfitName").dataset.editing=o.id;navigateTo("outfits");renderBuilder();$("#outfitName").scrollIntoView({behavior:"smooth",block:"center"});}
function deleteOutfit(id){const o=outfits.find(x=>x.id===id);if(!o||!confirm(`Queres apagar o look "${o.name}"?`))return;const oldOutfits=outfits,oldPlans=plans;outfits=outfits.filter(x=>x.id!==id);plans=plans.filter(p=>p.outfitId!==id);if(!saveData()){outfits=oldOutfits;plans=oldPlans;return;}renderAll();showToast("Look apagado.");}
function addPlan(){const date=$("#planDate").value,outfitId=$("#planOutfit").value;if(!date||!outfitId)return showToast("Escolhe uma data e um look.");if(date<localDateString())return showToast("Escolhe hoje ou uma data futura.");if(plans.some(p=>p.date===date&&p.outfitId===outfitId))return showToast("Este look já está planeado para essa data.");plans.push({id:makeId(),date,outfitId});if(!saveData()){plans.pop();return;}renderPlans();$("#planOutfit").value="";showToast("Look adicionado à agenda!");}
function deletePlan(id){const old=plans;plans=plans.filter(p=>p.id!==id);if(!saveData()){plans=old;return;}renderPlans();showToast("Plano removido.");}
function recordWear(id){const item=items.find(i=>i.id===id);if(!item)return;item.wears=Number(item.wears||0)+1;item.lastWorn=localDateString();saveData();renderAll();showToast(`Utilização registada: ${item.name}.`);}
function recordOutfitWear(id){const outfit=outfits.find(o=>o.id===id);if(!outfit)return;const today=localDateString();(outfit.itemIds||[]).forEach(id=>{const i=items.find(x=>x.id===id);if(i){i.wears=Number(i.wears||0)+1;i.lastWorn=today;}});saveData();renderAll();showToast("Utilização do look registada!");}
function changeItemStatus(id,next){const item=items.find(i=>i.id===id);if(!item)return;item.status=next;saveData();renderAll();showToast(`Estado atualizado: ${statusLabel(next).toLowerCase()}.`);}
function addShoppingItem(event){event.preventDefault();const name=$("#shoppingName").value.trim();if(!name)return;shopping.push({id:makeId(),name,price:Math.max(0,Number($("#shoppingPrice").value)||0),done:false});if(!saveData()){shopping.pop();return;}$("#shoppingForm").reset();renderShopping();showToast("Adicionado à lista de compras.");}
function toggleShopDone(id,done){const item=shopping.find(s=>s.id===id);if(!item)return;item.done=done;saveData();renderShopping();}
function deleteShop(id){const old=shopping;shopping=shopping.filter(s=>s.id!==id);if(!saveData()){shopping=old;return;}renderShopping();}
function exportData(){const data={app:"OUTFIT BRAIN",version:2,exportedAt:new Date().toISOString(),items,outfits,plans,shopping,budget};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`outfit-brain-backup-${localDateString()}.json`;a.click();URL.revokeObjectURL(url);showToast("Cópia de segurança exportada.");}
function importData(file){const reader=new FileReader();reader.onerror=()=>showToast("Não foi possível ler o ficheiro.");reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data||!Array.isArray(data.items)||!Array.isArray(data.outfits)||!Array.isArray(data.plans))throw new Error("Formato inválido");if(!confirm("A importação vai substituir os dados atuais. Continuar?"))return;items=data.items;outfits=data.outfits;plans=data.plans;shopping=Array.isArray(data.shopping)?data.shopping:[];budget=Number(data.budget)||0;if(!saveData())return;renderAll();showToast("Cópia restaurada com sucesso.");}catch(err){showToast("Ficheiro inválido. Escolhe uma cópia do OUTFIT BRAIN.");}};reader.readAsText(file);}
async function getWeather(){const title=$("#weatherTitle"),text=$("#weatherText");if(!navigator.geolocation){title.textContent="Localização indisponível";text.textContent="O navegador não permite obter a localização. Podes usar o site sem esta função.";return;}title.textContent="A consultar…";text.textContent="A obter a previsão meteorológica para a tua localização.";navigator.geolocation.getCurrentPosition(async pos=>{try{const {latitude,longitude}=pos.coords;const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`;const response=await fetch(url);if(!response.ok)throw new Error("Não foi possível consultar o tempo.");const data=await response.json(),c=data.current,d=data.daily;const temp=Math.round(c.temperature_2m),feels=Math.round(c.apparent_temperature),rain=d.precipitation_probability_max?.[0]??0,code=c.weather_code;let condition=code===0?"céu limpo":code<=3?"céu parcialmente nublado":code<=48?"nevoeiro":code<=67?"chuva":code<=77?"neve":code<=82?"aguaceiros":code<=86?"neve": "trovoada";let suggestion=temp<10?"Casaco quente, camisola e calçado fechado.":temp<17?"Camadas leves e um casaco que possas tirar.":temp<24?"Roupa confortável e uma camada leve para o fim do dia.":"Peças frescas e respiráveis.";if(rain>=40)suggestion+=" Leva também um impermeável ou guarda-chuva.";title.textContent=`${temp} °C · ${condition}`;text.textContent=`Sensação térmica de ${feels} °C. Probabilidade máxima de precipitação: ${rain}%. Sugestão: ${suggestion}`;}catch(err){title.textContent="Não foi possível obter a previsão";text.textContent="Verifica a ligação à internet e tenta novamente.";showToast("A consulta meteorológica falhou.");}},()=>{title.textContent="A localização não foi autorizada";text.textContent="Permite a localização nas definições do navegador para receber sugestões de roupa."},{enableHighAccuracy:false,timeout:10000,maximumAge:600000});}
function loadSyncConfig(){try{return JSON.parse(localStorage.getItem(STORAGE_KEYS.sync)||"{}");}catch{return {};}}
function setupSyncSettings(){const config=loadSyncConfig();$("#supabaseUrl").value=config.url||"";$("#supabaseKey").value=config.key||"";$("#syncUserId").value=config.userId||"";if(config.url&&config.key&&config.userId)$("#syncStatus").textContent="Configuração guardada. A sincronização só funcionará depois de criares a tabela, ativar autenticação e integrar políticas de segurança no Supabase.";}
function saveSyncConfig(){const url=$("#supabaseUrl").value.trim(),key=$("#supabaseKey").value.trim(),userId=$("#syncUserId").value.trim();if((url||key||userId)&&!(url&&key&&userId)){showToast("Preenche os três campos ou deixa-os vazios.");return;}localStorage.setItem(STORAGE_KEYS.sync,JSON.stringify({url,key,userId}));$("#syncStatus").textContent=url?"Configuração guardada neste navegador; a sincronização ainda não está ativa até configurar a base de dados e a autenticação.":"Sem configuração de sincronização. Os dados continuam guardados localmente.";showToast("Configuração guardada.");}
const pageTitlesUnused = null;

document.addEventListener("click",event=>{
  const page=event.target.closest("[data-page]");if(page)navigateTo(page.dataset.page);
  const go=event.target.closest("[data-go]");if(go){event.preventDefault();navigateTo(go.dataset.go);}
  if(event.target.closest("[data-add]"))openModal();
  const toggle=event.target.closest("[data-toggle-item]");if(toggle)toggleSelectedItem(toggle.dataset.toggleItem);
  const swap=event.target.closest("[data-swap-item]");if(swap)swapSelectedItem(swap.dataset.swapItem);
  const edit=event.target.closest("[data-edit-item]");if(edit)editItem(edit.dataset.editItem);
  const del=event.target.closest("[data-delete-item]");if(del)deleteItem(del.dataset.deleteItem);
  const fav=event.target.closest("[data-favorite-outfit]");if(fav)toggleFavorite(fav.dataset.favoriteOutfit);
  const load=event.target.closest("[data-load-outfit]");if(load)loadOutfit(load.dataset.loadOutfit);
  const delOutfit=event.target.closest("[data-delete-outfit]");if(delOutfit)deleteOutfit(delOutfit.dataset.deleteOutfit);
  const delPlan=event.target.closest("[data-delete-plan]");if(delPlan)deletePlan(delPlan.dataset.deletePlan);
  const wear=event.target.closest("[data-wear-item]");if(wear)recordWear(wear.dataset.wearItem);
  const wearOutfit=event.target.closest("[data-wear-outfit]");if(wearOutfit)recordOutfitWear(wearOutfit.dataset.wearOutfit);
  const status=event.target.closest("[data-status-item]");if(status)changeItemStatus(status.dataset.statusItem,status.dataset.nextStatus);
  const delShop=event.target.closest("[data-delete-shop]");if(delShop)deleteShop(delShop.dataset.deleteShop);
  const shopDone=event.target.closest("[data-shop-done]");if(shopDone)toggleShopDone(shopDone.dataset.shopDone,shopDone.checked);
});
$("#openAdd").addEventListener("click",openModal);$("#closeModal").addEventListener("click",closeModal);$("#cancelModal").addEventListener("click",closeModal);
$("#itemModal").addEventListener("click",e=>{if(e.target===$("#itemModal"))closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#itemModal").classList.contains("hidden"))closeModal();});
["searchItems","filterCategory","filterColor","filterStatus","sortItems"].forEach(id=>$("#"+id).addEventListener(id==="searchItems"?"input":"change",renderWardrobe));
$("#searchBuilder").addEventListener("input",renderBuilder);$("#builderCategory").addEventListener("change",renderBuilder);
$("#generateOutfit").addEventListener("click",generateCombination);$("#clearOutfit").addEventListener("click",clearBuilder);$("#saveOutfit").addEventListener("click",saveOutfit);$("#addPlan").addEventListener("click",addPlan);
$("#thisWeek").addEventListener("click",renderWeek);$("#shoppingForm").addEventListener("submit",addShoppingItem);
$("#shoppingBudget").addEventListener("change",()=>{budget=Math.max(0,Number($("#shoppingBudget").value)||0);saveData();renderShopping();});
$("#exportData").addEventListener("click",exportData);$("#importData").addEventListener("change",e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value="";});
$("#getWeather").addEventListener("click",getWeather);$("#saveSyncConfig").addEventListener("click",saveSyncConfig);
$("#installApp").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installApp").disabled=true;});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("#installApp").disabled=false;$("#installApp").textContent="Instalar OUTFIT BRAIN";});
window.addEventListener("appinstalled",()=>showToast("OUTFIT BRAIN instalado!"));
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Service worker indisponível:",err)));}
$("#todayLabel").textContent=new Date().toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
$("#planDate").min=localDateString();$("#planDate").value=localDateString();$("#shoppingBudget").value=budget||"";
setupSyncSettings();renderAll();
