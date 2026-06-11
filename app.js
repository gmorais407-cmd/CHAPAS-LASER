// ── FIREBASE ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, remove, onValue, push, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


const firebaseConfig = {
  apiKey: "AIzaSyBm_byxQCIlwxbWJgvmHY6lfRLSIJbau2c",
  authDomain: "chapas-laser.firebaseapp.com",
  databaseURL: "https://chapas-laser-default-rtdb.firebaseio.com",
  projectId: "chapas-laser",
  storageBucket: "chapas-laser.firebasestorage.app",
  messagingSenderId: "519411251153",
  appId: "1:519411251153:web:38be7b56ca0de21c6212f0",
  measurementId: "G-ZP8DN56C90"
};

const app     = initializeApp(firebaseConfig);
const db      = getDatabase(app);

// ── DADOS INICIAIS (usados apenas se o banco estiver vazio) ──
const STOCK_INICIAL = [
  { id:13, material:"PERFURADA", codigo:"MP0000038", espessura:"0,6 mm",  comp:3, peso_padrao:13.09,  estoque_kg:0,   prateleira:"-" },
  { id:8,  material:"CARBONO",   codigo:"MP0000079", espessura:"1,9 mm",  comp:2, peso_padrao:36.1,   estoque_kg:153.425, prateleira:"B" },
  { id:16, material:"CARBONO",   codigo:"MP0000183", espessura:"3,35 mm", comp:3, peso_padrao:95.46,  estoque_kg:63.9582, prateleira:"B" },
  { id:6,  material:"CARBONO",   codigo:"MP0000077", espessura:"0,9 mm",  comp:2, peso_padrao:17.1,   estoque_kg:34.2,    prateleira:"C" },
  { id:10, material:"ZINCADA",   codigo:"MP0000086", espessura:"2,7 mm",  comp:3, peso_padrao:76.9,   estoque_kg:615.2,   prateleira:"D" },
  { id:4,  material:"INOX",      codigo:"MP0000083", espessura:"2,5 mm",  comp:2, peso_padrao:48.7,   estoque_kg:389.6,   prateleira:"E" },
  { id:5,  material:"INOX",      codigo:"MP0000186", espessura:"3,0 mm",  comp:3, peso_padrao:88.31,  estoque_kg:264.93,  prateleira:"F" },
  { id:3,  material:"INOX",      codigo:"MP0000082", espessura:"2,0 mm",  comp:2, peso_padrao:39.25,  estoque_kg:58.875,  prateleira:"G" },
  { id:7,  material:"CARBONO",   codigo:"MP0000078", espessura:"1,5 mm",  comp:2, peso_padrao:28.5,   estoque_kg:1467.75, prateleira:"H" },
  { id:12, material:"ZINCADA",   codigo:"MP0000187", espessura:"0,9 mm",  comp:3, peso_padrao:25.64,  estoque_kg:76.92,   prateleira:"I" },
  { id:11, material:"ZINCADA",   codigo:"MP0000085", espessura:"1,25 mm", comp:3, peso_padrao:35.6,   estoque_kg:0,       prateleira:"I" },
  { id:1,  material:"INOX",      codigo:"MP0000080", espessura:"0,5 mm",  comp:2, peso_padrao:9.8,    estoque_kg:19.6,    prateleira:"J" },
  { id:2,  material:"INOX",      codigo:"MP0000081", espessura:"1,2 mm",  comp:2, peso_padrao:23.5,   estoque_kg:0,       prateleira:"J" },
  { id:14, material:"LATÃO",     codigo:"MP0000084", espessura:"1,07 mm", comp:1.2, peso_padrao:6.55,   estoque_kg:85.15,    prateleira:"-" },
  { id:15, material:"LATÃO",     codigo:"MP0000295", espessura:"1,25 mm", comp:1.2, peso_padrao:7.65,   estoque_kg:0,    prateleira:"-" },
];

// ── LOADING OVERLAY ──
function showLoading(msg="Conectando ao banco de dados..."){
  let el=document.getElementById("fb-loading");
  if(!el){
    el=document.createElement("div");
    el.id="fb-loading";
    el.style.cssText="position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;font-family:'DM Sans',sans-serif";
    el.innerHTML=`<div style="width:40px;height:40px;border:4px solid #d0e4ef;border-top-color:#0366a5;border-radius:50%;animation:spin .8s linear infinite"></div><div style="color:#0366a5;font-weight:600;font-size:15px" id="fb-loading-msg">${msg}</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  } else { document.getElementById("fb-loading-msg").textContent=msg; }
}
function hideLoading(){ const el=document.getElementById("fb-loading"); if(el) el.remove(); }

showLoading();
const _loadingTimeout = setTimeout(() => {
  hideLoading();
  showToast("⚠️ Conexão lenta com o banco. Verifique sua internet e recarregue a página.", "err");
}, 12000);

const MAT_COLORS = {
  INOX:      { dot:"#0366a5", badge:"#e8f4fb", text:"#0366a5" },
  CARBONO:   { dot:"#546e7a", badge:"#eceff1", text:"#37474f" },
  ZINCADA:   { dot:"#3eac48", badge:"#e8f5e9", text:"#2e7d32" },
  PERFURADA: { dot:"#e68900", badge:"#fff8e1", text:"#b45309" },
  LATÃO:     { dot:"#b8860b", badge:"#fffde7", text:"#7a5c00" },
};

// ── STATE ──
let stock = [];
let history = [];
let currentFilter = "TODOS";
let histTab = "entrada";
let activeItem = null;
let openShelves = new Set(["A","B","C","D","E","F","G","H","I","J"]);

const fmt   = n => Number(n).toFixed(2);
const fmtN  = n => { const v=Number(n); return v===Math.floor(v)?String(v):parseFloat(v.toFixed(4)).toString(); };
const nowStr  = () => new Date().toLocaleString("pt-BR");
const nowISO  = () => new Date().toISOString();

function calcMetros(s) {
  if (!s.peso_padrao||s.peso_padrao<=0) return 0;
  return (s.estoque_kg/s.peso_padrao)*s.comp;
}
function calcUnidades(s) {
  if (!s.peso_padrao||s.peso_padrao<=0) return 0;
  return s.estoque_kg/s.peso_padrao;
}

function showToast(msg,type="ok") {
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.style.background=type==="err"?"#d32f2f":"#2e7d32";
  t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"),3200);
}

function setView(v) {
  ["dashboard","mapeamento","historico","calc","admin","pdfs","pecas"].forEach(id=>{
    const el = document.getElementById("view-"+id);
    const nav = document.getElementById("nav-"+id);
    if(el) el.classList.toggle("hidden",id!==v);
    if(nav) nav.classList.toggle("active",id===v);
  });
  if (v==="historico") renderHistory();
  if (v==="calc")      populateCalcSelect();
  if (v==="mapeamento") renderMapping();
  if (v==="admin") renderAdminTable();
  if (v==="pdfs") renderPdfs();
  if (v==="pecas") renderPecas();
}

function openModal(id){document.getElementById(id).classList.remove("hidden");}
function closeModal(id){document.getElementById(id).classList.add("hidden");}

// ── MAT CARDS ──
function renderMatCards() {
  const mats=["INOX","CARBONO","ZINCADA","PERFURADA","LATÃO"];
  const allKg=stock.reduce((a,b)=>a+b.estoque_kg,0);
  let html=mats.map(mat=>{
    const items=stock.filter(s=>s.material===mat);
    const total=items.reduce((a,b)=>a+b.estoque_kg,0);
    const c=MAT_COLORS[mat];
    return `<div class="mat-card${currentFilter===mat?' selected':''}" onclick="setFilter('${mat}')">
      <div class="mat-card-top"><div class="mat-dot" style="background:${c.dot}"></div><div class="mat-name">${mat}</div></div>
      <div class="mat-kg">${fmt(total)} <span class="mat-kg-unit">kg</span></div>
      <div class="mat-count">${items.length} tipo${items.length!==1?'s':''}</div>
    </div>`;
  }).join("");
  html+=`<div class="mat-card${currentFilter==='TODOS'?' selected':''}" onclick="setFilter('TODOS')" style="border-style:dashed">
    <div class="mat-card-top"><div class="mat-dot" style="background:#aaa"></div><div class="mat-name">TODOS</div></div>
    <div class="mat-kg">${fmt(allKg)} <span class="mat-kg-unit">kg</span></div>
    <div class="mat-count">${stock.length} tipos</div>
  </div>`;
  document.getElementById("matCards").innerHTML=html;
}

// ── SHELF MAP ──
function toggleShelf(letter) {
  if (openShelves.has(letter)) openShelves.delete(letter); else openShelves.add(letter);
  const card=document.getElementById("shelf-card-"+letter);
  if (card) card.classList.toggle("open",openShelves.has(letter));
}

function renderShelfMap() {
  const letters=["A","B","C","D","E","F","G","H","I","J"];
  const html=letters.map(letter=>{
    const items=stock.filter(s=>s.prateleira===letter);
    const isOpen=openShelves.has(letter);
    const isEmpty=items.length===0;
    const totalKg=items.reduce((a,b)=>a+b.estoque_kg,0);
    const isRetalho=letter==="A";
    const matSet=[...new Set(items.map(i=>i.material))];
    const matPreview=matSet.slice(0,3).map(m=>{
      const c=MAT_COLORS[m]||{badge:"#eee",text:"#555"};
      return `<span style="display:inline-block;background:${c.badge};color:${c.text};border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;margin-right:3px">${m}</span>`;
    }).join("");
    let subText=isEmpty?"Prateleira vazia":isRetalho?`Retalhos · ${items.length} item${items.length!==1?'s':''}`:
      `${items.length} item${items.length!==1?'s':''} · ${matSet.join(', ')}`;
    const letterBg=isRetalho?"":`background:${isEmpty?'#f0f4f8':'var(--bg3)'};color:${isEmpty?'#aaa':'var(--blue)'};border:1.5px solid ${isEmpty?'#dde':'var(--border)'}`;
    const itemsHtml=isEmpty?`<div class="shelf-empty-msg">Nenhum item nesta prateleira</div>`:
      items.map(s=>{
        const c=MAT_COLORS[s.material]||{badge:"#eee",text:"#555"};
        const metros=calcMetros(s);
        const isZero=s.estoque_kg<=0;
        return `<div class="shelf-item-row${isZero?' zero':''}">
          <span class="shelf-item-esp">${s.espessura}</span>
          <span class="shelf-item-mat" style="background:${c.badge};color:${c.text}">${s.material}</span>
          <span class="shelf-item-sep">—</span>
          <span class="shelf-item-metros">${isZero?'0,00 m':fmt(metros)+' m'}</span>
          ${isZero?`<span class="shelf-item-zero">SEM ESTOQUE</span>`:`<span class="shelf-item-peso">${fmt(s.estoque_kg)} kg</span>`}
        </div>`;
      }).join("");
    return `<div class="shelf-card${isRetalho?' retalho':''}${isEmpty?' empty':''}${isOpen?' open':''}" id="shelf-card-${letter}">
      <div class="shelf-card-header" onclick="toggleShelf('${letter}')">
        <div class="shelf-header-left">
          <div class="shelf-letter-badge" style="${letterBg}">${letter}</div>
          <div>
            <div class="shelf-header-name">Prateleira ${letter}${isRetalho?' — RETALHOS':''}</div>
            <div class="shelf-header-meta">${subText}</div>
          </div>
        </div>
        <div class="shelf-header-right">
          ${!isEmpty?`<span class="shelf-total-badge">${fmt(totalKg)} kg</span>`:''}
          ${!isEmpty?matPreview:''}
          <span class="shelf-chevron">▼</span>
        </div>
      </div>
      <div class="shelf-card-body"><div class="shelf-items-list">${itemsHtml}</div></div>
    </div>`;
  }).join("");
  document.getElementById("shelfList").innerHTML=html;
}

// ── MAPEAMENTO ──
function renderMapping() {
  const letters=["A","B","C","D","E","F","G","H","I","J"];
  let html="";
  letters.forEach(letter=>{
    const items=stock.filter(s=>s.prateleira===letter);
    const isRetalho=letter==="A";
    html+=`<div class="mapping-shelf-group">`;
    if (isRetalho) {
      html+=`<div class="mapping-retalho-row">
        <div class="mapping-letter retalho">${letter}</div>
        <div style="font-weight:700;color:#b45309;font-size:13px;letter-spacing:.5px">RETALHOS</div>
        <div style="text-align:center;color:#b45309;font-weight:700;font-family:'DM Mono',monospace">—</div>
        <div style="text-align:right;color:#b45309;font-weight:700;font-family:'DM Mono',monospace">—</div>
      </div>`;
    } else if (items.length===0) {
      html+=`<div class="mapping-item">
        <div class="mapping-letter" style="color:#bbb">${letter}</div>
        <div style="color:#bbb;font-size:12px;font-style:italic">Prateleira vazia</div>
        <div></div><div></div>
      </div>`;
    } else {
      items.forEach((s,idx)=>{
        const c=MAT_COLORS[s.material]||{badge:"#eee",text:"#555"};
        const unid=calcUnidades(s);
        const isZero=s.estoque_kg<=0;
        html+=`<div class="mapping-item${isZero?' zero-item':''}">
          <div class="mapping-letter">${idx===0?letter:''}</div>
          <div><span class="mapping-chip" style="background:${c.badge};color:${c.text}">${s.espessura} ${s.material}</span></div>
          <div class="mapping-qty${isZero?' zero':''}">${isZero?'0':fmtN(unid)}</div>
          <div class="mapping-peso${isZero?' zero':''}">${isZero?'0':fmt(s.estoque_kg)}</div>
        </div>`;
      });
    }
    html+=`</div>`;
  });
  document.getElementById("mappingBody").innerHTML=html;
  const mats=[...new Set(stock.map(s=>s.material))];
  document.getElementById("mappingLegend").innerHTML=
    mats.map(m=>{const c=MAT_COLORS[m]||{dot:"#aaa"};return `<span><span class="legend-dot" style="background:${c.dot}"></span>${m}</span>`;}).join("")+
    `<span style="margin-left:auto;color:#d32f2f;font-weight:700;font-size:11px">■ vermelho = sem estoque</span>`;
}

// ── FILTER TABS ──
function renderFilterTabs() {
  const mats=["TODOS","INOX","CARBONO","ZINCADA","PERFURADA","LATÃO"];
  document.getElementById("filterTabs").innerHTML=mats.map(m=>
    `<button class="filter-tab${currentFilter===m?' active':''}" onclick="setFilter('${m}')">${m}</button>`
  ).join("");
}
function setFilter(mat){currentFilter=mat;renderMatCards();renderFilterTabs();renderStockTable();}

// ── STOCK TABLE ──
function renderStockTable() {
  const items=currentFilter==="TODOS"?stock:stock.filter(s=>s.material===currentFilter);
  document.getElementById("stockTable").innerHTML=items.map(s=>{
    const c=MAT_COLORS[s.material];
    const metros=calcMetros(s);
    const isZero=s.estoque_kg<=0;
    return `<tr${isZero?' class="zero-row"':''}>
      <td><span class="badge-mat" style="background:${c.badge};color:${c.text}">${s.material}</span></td>
      <td><span class="cod-tag">${s.codigo}</span></td>
      <td>${s.espessura}</td>
      <td style="font-family:'DM Mono',monospace;font-weight:700${isZero?';color:#d32f2f':''}">${fmt(s.estoque_kg)} kg</td>
      <td><span class="metros-badge${isZero?' zero':''}">📏 ${fmt(metros)} m</span></td>
      <td><div class="row-actions">
        <button class="btn-add" onclick="openEntrada(${s.id})">+ Entrada</button>
        <button class="btn-rem" onclick="openSaida(${s.id})">− Saída</button>
      </div></td>
    </tr>`;
  }).join("");
}

// ── MODAL ENTRADA ──
function openEntrada(itemId){
  activeItem=stock.find(s=>s.id===itemId);if(!activeItem)return;
  document.getElementById("entradaSub").textContent=`${activeItem.material} · ${activeItem.espessura} · ${activeItem.codigo}`;
  document.getElementById("ent-metros").value="";
  document.getElementById("ent-prateleira").value=activeItem.prateleira!=="-"?activeItem.prateleira:"";
  document.getElementById("ent-obs").value="";
  document.getElementById("entradaPreview").classList.add("hidden");
  openModal("modalEntrada");
}
function entradaCalc(){
  if(!activeItem)return;
  const m=parseFloat(document.getElementById("ent-metros").value);
  const prev=document.getElementById("entradaPreview");
  if(!m||m<=0){prev.classList.add("hidden");return;}
  const kg=(activeItem.peso_padrao/activeItem.comp)*m;
  document.getElementById("entradaPreviewLabel").textContent=`${activeItem.comp}m = ${fmt(activeItem.peso_padrao)} kg  →  ${m}m =`;
  document.getElementById("entradaPreviewKg").innerHTML=`${fmt(kg)} <span>kg</span>`;
  prev.classList.remove("hidden");
}
function confirmarEntrada(){
  const metros=parseFloat(document.getElementById("ent-metros").value);
  if(!metros||metros<=0){showToast("Informe a metragem recebida.","err");return;}
  const kg=(activeItem.peso_padrao/activeItem.comp)*metros;
  const prat=document.getElementById("ent-prateleira").value.trim().toUpperCase();
  const obs=document.getElementById("ent-obs").value.trim();
  const novoEstoque=activeItem.estoque_kg+kg;
  const novaPrat=prat||activeItem.prateleira;
  // Salva estoque no Firebase
  update(ref(db,`stock/${activeItem.id}`),{estoque_kg:novoEstoque,prateleira:novaPrat});
  // Salva histórico no Firebase
  const hrec={tipo:"ENTRADA",isoDate:nowISO(),data:nowStr(),material:activeItem.material,espessura:activeItem.espessura,codigo:activeItem.codigo,metros,peso_kg:kg,prateleira:novaPrat,obs:obs||"—",solicitante:"—",destino:"—",descricao:"—"};
  push(ref(db,"history"),hrec);
  closeModal("modalEntrada");showToast(`✅ +${fmt(kg)} kg adicionados!`);
}

// ── MODAL SAÍDA ──
function openSaida(itemId){
  activeItem=stock.find(s=>s.id===itemId);if(!activeItem)return;
  document.getElementById("saidaSub").textContent=`${activeItem.material} · ${activeItem.espessura} · ${activeItem.codigo} · Estoque: ${fmt(activeItem.estoque_kg)} kg`;
  ["sai-metros","sai-manual","sai-solicitante","sai-descricao"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("saidaPreview").classList.add("hidden");
  openModal("modalSaida");
}
function saidaCalc(){
  if(!activeItem)return;
  const m=parseFloat(document.getElementById("sai-metros").value);
  const prev=document.getElementById("saidaPreview");
  if(!m||m<=0){prev.classList.add("hidden");return;}
  const kg=(activeItem.peso_padrao/activeItem.comp)*m;
  document.getElementById("saidaPreviewLabel").textContent=`${activeItem.comp}m = ${fmt(activeItem.peso_padrao)} kg  →  ${m}m =`;
  document.getElementById("saidaPreviewKg").innerHTML=`${fmt(kg)} <span>kg</span>`;
  prev.classList.remove("hidden");
}
function confirmarSaida(){
  const metros=parseFloat(document.getElementById("sai-metros").value);
  const manual=parseFloat(document.getElementById("sai-manual").value);
  if(!metros&&!manual){showToast("Informe o comprimento ou peso manual.","err");return;}
  const kg=manual||(activeItem.peso_padrao/activeItem.comp)*metros;
  if(kg>activeItem.estoque_kg){showToast(`⚠️ Estoque insuficiente! Disponível: ${fmt(activeItem.estoque_kg)} kg`,"err");return;}
  const destino=document.getElementById("sai-destino").value;
  const solicitante=document.getElementById("sai-solicitante").value.trim()||"—";
  const descricao=document.getElementById("sai-descricao").value.trim()||"—";
  const novoEstoque=activeItem.estoque_kg-kg;
  // Salva estoque no Firebase
  update(ref(db,`stock/${activeItem.id}`),{estoque_kg:novoEstoque});
  // Salva histórico no Firebase
  const hrec={tipo:"SAÍDA",isoDate:nowISO(),data:nowStr(),material:activeItem.material,espessura:activeItem.espessura,codigo:activeItem.codigo,metros:metros||"—",peso_kg:kg,prateleira:activeItem.prateleira,destino,solicitante,descricao,obs:"—"};
  push(ref(db,"history"),hrec);
  closeModal("modalSaida");showToast(`✅ Saída de ${fmt(kg)} kg registrada!`);
}

// ── HISTÓRICO ──
function setHistTab(tab){
  histTab=tab;
  document.getElementById("htab-entrada").classList.toggle("active",tab==="entrada");
  document.getElementById("htab-saida").classList.toggle("active",tab==="saida");
  document.getElementById("hf-sol-wrap").style.display=tab==="saida"?"flex":"none";
  renderHistory();
}
function renderHistory(){
  const mat=document.getElementById("hf-material").value;
  const mes=document.getElementById("hf-mes").value;
  const ano=document.getElementById("hf-ano").value;
  const sol=(document.getElementById("hf-solicitante")?.value||"").toLowerCase();
  let items=history.filter(h=>h.tipo===(histTab==="entrada"?"ENTRADA":"SAÍDA"));
  if(mat)items=items.filter(h=>h.material===mat);
  if(mes)items=items.filter(h=>String(new Date(h.isoDate).getMonth()+1).padStart(2,"0")===mes);
  if(ano)items=items.filter(h=>String(new Date(h.isoDate).getFullYear())===ano);
  if(sol&&histTab==="saida")items=items.filter(h=>h.solicitante.toLowerCase().includes(sol));
  const empty=document.getElementById("histEmpty");
  const thead=document.getElementById("histHead");
  const tbody=document.getElementById("histTable");
  thead.innerHTML=histTab==="entrada"
    ?`<tr><th>Data</th><th>Material</th><th>Código</th><th>Espessura</th><th>Metros</th><th>Peso (kg)</th><th>Prateleira</th><th>Observação</th></tr>`
    :`<tr><th>Data</th><th>Material</th><th>Código</th><th>Espessura</th><th>Metros</th><th>Peso (kg)</th><th>Destino</th><th>Solicitante</th><th>Descrição</th></tr>`;
  if(!items.length){tbody.innerHTML="";empty.classList.remove("hidden");return;}
  empty.classList.add("hidden");
  tbody.innerHTML=items.map(h=>{
    const c=MAT_COLORS[h.material]||{badge:"#eee",text:"#333"};
    if(histTab==="entrada")return `<tr>
      <td style="font-size:12px;white-space:nowrap;color:var(--text2)">${h.data}</td>
      <td><span class="badge-mat" style="background:${c.badge};color:${c.text}">${h.material}</span></td>
      <td><span class="cod-tag">${h.codigo}</span></td>
      <td>${h.espessura}</td>
      <td style="font-family:'DM Mono',monospace">${h.metros}m</td>
      <td style="font-family:'DM Mono',monospace;color:var(--green);font-weight:700">+${fmt(h.peso_kg)} kg</td>
      <td>${h.prateleira&&h.prateleira!=="-"?`<span style="background:var(--bg3);color:var(--blue);font-weight:700;font-size:12px;padding:2px 9px;border-radius:5px;font-family:'DM Mono',monospace">${h.prateleira}</span>`:"—"}</td>
      <td style="font-size:12px;color:var(--text2)">${h.obs}</td>
    </tr>`;
    return `<tr>
      <td style="font-size:12px;white-space:nowrap;color:var(--text2)">${h.data}</td>
      <td><span class="badge-mat" style="background:${c.badge};color:${c.text}">${h.material}</span></td>
      <td><span class="cod-tag">${h.codigo}</span></td>
      <td>${h.espessura}</td>
      <td style="font-family:'DM Mono',monospace">${h.metros}m</td>
      <td style="font-family:'DM Mono',monospace;color:#d32f2f;font-weight:700">−${fmt(h.peso_kg)} kg</td>
      <td><span style="font-size:12px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:600">${h.destino}</span></td>
      <td>${h.solicitante}</td>
      <td style="font-size:12px;color:var(--text2)">${h.descricao}</td>
    </tr>`;
  }).join("");
}

// ── CALCULADORA ──
function populateCalcSelect(){
  document.getElementById("calcSelect").innerHTML=`<option value="">-- Preencher automaticamente --</option>`+
    stock.map(s=>`<option value="${s.id}">${s.material} ${s.espessura} (${s.codigo}) — ${s.comp}m / ${fmt(s.peso_padrao)}kg</option>`).join("");
}
function calcAutoFill(){
  const id=parseInt(document.getElementById("calcSelect").value);
  const item=stock.find(s=>s.id===id);
  if(item){document.getElementById("calcPeso").value=item.peso_padrao;document.getElementById("calcBase").value=item.comp;calcUpdate();}
}
function calcUpdate(){
  const p=parseFloat(document.getElementById("calcPeso").value);
  const b=parseFloat(document.getElementById("calcBase").value);
  const u=parseFloat(document.getElementById("calcUsado").value);
  if(p&&b&&u){const kg=(p/b)*u;document.getElementById("calcResult").innerHTML=`${fmt(kg)} <span>kg</span>`;document.getElementById("calcFormula").textContent=`${b}m = ${fmt(p)} kg  →  ${u}m = ${fmt(kg)} kg`;}
  else{document.getElementById("calcResult").innerHTML=`— <span>kg</span>`;document.getElementById("calcFormula").textContent="";}
}

// ── RENDER ALL ──
function renderAll(){renderMatCards();renderFilterTabs();renderStockTable();}
function updateDate(){document.getElementById("headerDate").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).toUpperCase();}

document.querySelectorAll(".modal-overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)o.classList.add("hidden");}));
updateDate();
setInterval(updateDate,60000);

// ── FIREBASE LISTENERS ──
// Escuta mudanças no estoque em tempo real
onValue(ref(db,"stock"), snapshot => {
  clearTimeout(_loadingTimeout);
  const data = snapshot.val();
  if (!data) {
    // Banco vazio — carrega dados iniciais
    showLoading("Primeiro acesso: carregando dados iniciais...");
    const obj = {};
    STOCK_INICIAL.forEach(s => { obj[s.id] = s; });
    set(ref(db,"stock"), obj).then(() => hideLoading()).catch(() => hideLoading());
  } else {
    stock = Object.values(data);
    hideLoading();
    renderAll();
    if(document.getElementById("view-mapeamento") && !document.getElementById("view-mapeamento").classList.contains("hidden")) renderMapping();
    if(document.getElementById("view-calc") && !document.getElementById("view-calc").classList.contains("hidden")) populateCalcSelect();
    if(document.getElementById("view-admin") && !document.getElementById("view-admin").classList.contains("hidden")) renderAdminTable();
  }
}, error => {
  clearTimeout(_loadingTimeout);
  hideLoading();
  showToast("⚠️ Erro ao conectar ao banco: " + error.message, "err");
});

// Escuta mudanças no histórico em tempo real
onValue(ref(db,"history"), snapshot => {
  const data = snapshot.val();
  history = data ? Object.values(data).sort((a,b) => new Date(b.isoDate) - new Date(a.isoDate)) : [];
  if(document.getElementById("view-historico") && !document.getElementById("view-historico").classList.contains("hidden")) renderHistory();
});
// ── ADMIN AUTH ──
let adminAuthenticated = false;
let itemToDelete = null;

function requestAdminAccess() {
  if (adminAuthenticated) {
    setView('admin');
    return;
  }
  document.getElementById('admin-senha').value = '';
  document.getElementById('admin-erro').style.display = 'none';
  openModal('modalAdmin');
  setTimeout(() => document.getElementById('admin-senha').focus(), 100);
}

function verificarSenha() {
  const h = s => s.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0);
  const entered = document.getElementById('admin-senha').value;
  // hash of '501123'
  if (h(entered) === h('501123')) {
    adminAuthenticated = true;
    closeModal('modalAdmin');
    setView('admin');
    // Atualiza banner de PDF se estiver na aba
    if(document.getElementById("view-pdfs") && !document.getElementById("view-pdfs").classList.contains("hidden")) renderPdfs();
  } else {
    document.getElementById('admin-erro').style.display = 'block';
    document.getElementById('admin-senha').value = '';
    document.getElementById('admin-senha').focus();
  }
}

function renderAdminTable() {
  const sorted = [...stock].sort((a,b) => a.id - b.id);
  document.getElementById('adminTable').innerHTML = sorted.map(s => `<tr>
    <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">${s.id}</td>
    <td><span class="badge-mat" style="background:${MAT_COLORS[s.material]?.badge||'#eee'};color:${MAT_COLORS[s.material]?.text||'#333'}">${s.material}</span></td>
    <td><span class="cod-tag">${s.codigo}</span></td>
    <td>${s.espessura}</td>
    <td style="font-family:'DM Mono',monospace">${s.comp}m</td>
    <td style="font-family:'DM Mono',monospace">${fmt(s.peso_padrao)} kg</td>
    <td style="font-family:'DM Mono',monospace;font-weight:700;color:${s.estoque_kg<=0?'#d32f2f':'var(--green)'}">${fmt(s.estoque_kg)} kg</td>
    <td><span style="background:var(--bg3);color:var(--blue);font-weight:700;font-size:12px;padding:2px 8px;border-radius:5px;font-family:'DM Mono',monospace">${s.prateleira}</span></td>
    <td><div class="row-actions">
      <button class="btn-rem" onclick="solicitarExcluir(${s.id})">🗑 Excluir</button>
    </div></td>
  </tr>`).join('');
}

function solicitarExcluir(itemId) {
  const item = stock.find(s => s.id === itemId);
  if (!item) return;
  itemToDelete = item;
  document.getElementById('excluirSub').textContent = `Excluir "${item.material} ${item.espessura} (${item.codigo})" com ${fmt(item.estoque_kg)} kg em estoque?`;
  openModal('modalExcluir');
}

function confirmarExcluir() {
  if (!itemToDelete) return;
  remove(ref(db, `stock/${itemToDelete.id}`)).then(() => {
    closeModal('modalExcluir');
    showToast(`✅ Chapa ${itemToDelete.codigo} excluída.`);
    itemToDelete = null;
  }).catch(e => showToast('⚠️ Erro ao excluir: ' + e.message, 'err'));
}

function cadastrarChapa() {
  const material = document.getElementById('cad-material').value;
  const codigo   = document.getElementById('cad-codigo').value.trim().toUpperCase();
  const espessura= document.getElementById('cad-espessura').value.trim();
  const prateleira= document.getElementById('cad-prateleira').value.trim().toUpperCase() || '-';
  const comp     = parseFloat(document.getElementById('cad-comp').value);
  const peso_padrao = parseFloat(document.getElementById('cad-peso').value);
  const estoque_kg  = parseFloat(document.getElementById('cad-estoque').value) || 0;

  if (!material || !codigo || !espessura || !comp || !peso_padrao) {
    showToast('⚠️ Preencha todos os campos obrigatórios (*)', 'err');
    return;
  }
  if (stock.some(s => s.codigo === codigo)) {
    showToast('⚠️ Já existe uma chapa com esse código!', 'err');
    return;
  }
  const maxId = stock.length > 0 ? Math.max(...stock.map(s => s.id)) : 0;
  const newId = maxId + 1;
  const novaChapa = { id: newId, material, codigo, espessura, comp, peso_padrao, estoque_kg, prateleira };

  set(ref(db, `stock/${newId}`), novaChapa).then(() => {
      showToast(`✅ Chapa ${codigo} cadastrada com sucesso!`);
      ['cad-material','cad-codigo','cad-espessura','cad-prateleira','cad-comp','cad-peso','cad-estoque']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  }).catch(e => showToast('⚠️ Erro ao cadastrar: ' + e.message, 'err'));
}

// ── PDF DRAWINGS (base64 no Realtime Database) ──
// Metadados ficam em /pdfs/{id} — leve, carregado sempre
// Conteúdo fica em /pdf_data/{id} — só lido ao clicar Abrir
let pdfs = [];

onValue(ref(db,"pdfs"), snapshot => {
  const data = snapshot.val();
  pdfs = data ? Object.values(data) : [];
  if(document.getElementById("view-pdfs") && !document.getElementById("view-pdfs").classList.contains("hidden")) renderPdfs();
});

function renderPdfs() {
  const grid        = document.getElementById("pdfGrid");
  const empty       = document.getElementById("pdfEmpty");
  const uploadArea  = document.getElementById("pdf-upload-area");
  const adminBanner = document.getElementById("pdf-admin-banner");

  if(adminAuthenticated) {
    uploadArea.classList.remove("hidden");
    adminBanner.classList.remove("hidden");
  } else {
    uploadArea.classList.add("hidden");
    adminBanner.classList.add("hidden");
  }

  const search   = (document.getElementById("pdfSearch")?.value || "").toLowerCase().trim();
  const filtered = search ? pdfs.filter(p => p.name.toLowerCase().includes(search)) : pdfs;

  if(!pdfs.length){ grid.innerHTML=""; empty.classList.remove("hidden"); return; }
  if(!filtered.length){
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text3)"><div style="font-size:32px;margin-bottom:8px">🔍</div><div style="font-weight:600">Nenhum resultado para "<em>${search}</em>"</div></div>`;
    empty.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = filtered.map(pdf => {
    const sizeStr = pdf.size ? ` · ${(pdf.size/1024).toFixed(0)} KB` : '';
    const delBtn  = adminAuthenticated
      ? `<button class="btn-pdf-del" data-pdfid="${pdf.id}" onclick="deletePdf(this.dataset.pdfid)">🗑 Excluir</button>`
      : '';
    return `
    <div class="pdf-card" id="pdfcard-${pdf.id}">
      <div class="pdf-card-header">
        <div class="pdf-card-icon">📄</div>
        <div>
          <div class="pdf-card-name">${pdf.name.replace(/</g,'&lt;')}</div>
          <div class="pdf-card-meta">${(pdf.date||'').replace(/</g,'&lt;')}${sizeStr}</div>
        </div>
      </div>
      <div class="pdf-card-body">
        <button class="btn-pdf-view" id="btnabrir-${pdf.id}" onclick="abrirPdf('${pdf.id}')">🔍 Abrir</button>
        ${delBtn}
      </div>
    </div>`;
  }).join('');
}

function setPdfStatus(msg, cor){
  const el = document.getElementById("pdf-status-msg");
  if(!el) return;
  el.textContent    = msg;
  el.style.display  = msg ? "block" : "none";
  el.style.color    = cor || "var(--blue)";
}

function abrirPdf(pdfId){
  const btn = document.getElementById("btnabrir-"+pdfId);
  if(btn){ btn.textContent = "⏳ Carregando..."; btn.disabled = true; }

  get(ref(db, `pdf_data/${pdfId}`))
    .then(snap => {
      if(btn){ btn.textContent = "🔍 Abrir"; btn.disabled = false; }
      const base64 = snap.val();
      if(!base64){ showToast("⚠️ PDF não encontrado no servidor.", "err"); return; }
      const byteChars = atob(base64);
      const bytes     = new Uint8Array(byteChars.length);
      for(let i=0; i<byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], {type:"application/pdf"});
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
    })
    .catch(e => {
      if(btn){ btn.textContent = "🔍 Abrir"; btn.disabled = false; }
      showToast("⚠️ Erro ao carregar PDF: " + e.message, "err");
    });
}

function handlePdfSelect(event){
  const file = event.target.files[0];
  if(file) uploadPdf(file);
  event.target.value = "";
}

function handlePdfDrop(event){
  event.preventDefault();
  document.getElementById("pdfDropZone").classList.remove("drag-over");
  const file = event.dataTransfer.files[0];
  if(file && file.type==="application/pdf") uploadPdf(file);
  else showToast("⚠️ Apenas arquivos PDF são aceitos.", "err");
}

function uploadPdf(file){
  if(!adminAuthenticated){ showToast("🔐 Acesso restrito a administradores.", "err"); return; }
  if(file.type !== "application/pdf"){ showToast("⚠️ Apenas arquivos PDF são aceitos.", "err"); return; }
  if(file.size > 8 * 1024 * 1024){ showToast("⚠️ PDF muito grande. Máximo 8 MB.", "err"); return; }

  const duplicado = pdfs.find(p => p.name.toLowerCase() === file.name.toLowerCase());
  if(duplicado){
    showToast(`⚠️ Já existe um PDF com o nome "${file.name}". Renomeie ou exclua o existente.`, "err");
    return;
  }

  setPdfStatus("📖 Lendo arquivo...");

  const reader = new FileReader();
  reader.onload = e => {
    // e.target.result = "data:application/pdf;base64,XXXX..."
    const base64 = e.target.result.split(",")[1];
    const pdfId  = push(ref(db,"pdfs")).key;

    setPdfStatus("☁️ Enviando para o servidor...");

    const pdfRecord = {
      id:   pdfId,
      name: file.name,
      size: file.size,
      date: new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})
    };

    // Salva metadados e conteúdo em paralelo
    Promise.all([
      set(ref(db, `pdfs/${pdfId}`),     pdfRecord),
      set(ref(db, `pdf_data/${pdfId}`), base64)
    ])
    .then(() => {
      setPdfStatus("");
      showToast(`✅ PDF "${file.name}" salvo com sucesso!`);
    })
    .catch(e => {
      setPdfStatus("");
      showToast("⚠️ Erro ao salvar: " + e.message, "err");
    });
  };
  reader.onerror = () => { setPdfStatus(""); showToast("⚠️ Erro ao ler o arquivo.", "err"); };
  reader.readAsDataURL(file);
}

function deletePdf(pdfId){
  if(!adminAuthenticated){ showToast("🔐 Acesso restrito a administradores.", "err"); return; }
  if(!confirm("Excluir este PDF?")) return;
  Promise.all([
    remove(ref(db, `pdfs/${pdfId}`)),
    remove(ref(db, `pdf_data/${pdfId}`))
  ]).then(()=> showToast("✅ PDF removido."))
    .catch(e => showToast("⚠️ Erro: "+e.message, "err"));
}

// ── PEÇAS POR CHAPA ──
let pecas = [];

onValue(ref(db,"pecas"), snapshot => {
  const data = snapshot.val();
  pecas = data ? Object.values(data) : [];
  if(document.getElementById("view-pecas") && !document.getElementById("view-pecas").classList.contains("hidden")) renderPecas();
});

function renderPecas(){
  const search = (document.getElementById("pecasSearch")?.value||"").toLowerCase();
  const grid = document.getElementById("pecasGrid");
  const empty = document.getElementById("pecasEmpty");
  let filtered = pecas;
  if(search) filtered = pecas.filter(p =>
    p.codigoPeca.toLowerCase().includes(search) ||
    (p.codigoChapa||"").toLowerCase().includes(search)
  );
  if(!filtered.length){ grid.innerHTML=""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");
  grid.innerHTML = filtered.map(p => {
    const chapa = stock.find(s => s.codigo === p.codigoChapa);
    const c = chapa ? (MAT_COLORS[chapa.material]||{badge:"#eee",text:"#555"}) : {badge:"#eee",text:"#555"};
    return `
    <div class="peca-card">
      <div class="peca-card-top">
        <span class="peca-codigo">${p.codigoPeca}</span>
        <div style="text-align:right">
          <div class="peca-count-badge">${p.quantidade}</div>
          <div class="peca-count-sub">peças/chapa</div>
        </div>
      </div>
      <div class="peca-info">
        <span class="badge-mat" style="background:${c.badge};color:${c.text};font-size:10px">${chapa?chapa.material:"—"}</span>
        &nbsp;<span class="cod-tag" style="font-size:10px">${p.codigoChapa||"—"}</span>
        ${chapa ? `&nbsp;· ${chapa.espessura}` : ''}<br>
        ${p.compUsado ? `<span style="color:var(--text3);font-size:11px">📏 ${p.compUsado}m de chapa</span><br>` : ''}
        ${p.obs && p.obs !== "—" ? `<span style="color:var(--text3);font-size:11px">📝 ${p.obs}</span>` : ''}
      </div>
      <div class="peca-actions">
        <button class="btn-peca-edit" onclick="editarPeca('${p.id}')">✏️ Editar</button>
        <button class="btn-peca-del" onclick="excluirPeca('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function openPecaModal(){
  document.getElementById("peca-edit-id").value = "";
  document.getElementById("pecaModalTitle").textContent = "➕ Cadastrar Peça por Chapa";
  document.getElementById("peca-codigo").value = "";
  document.getElementById("peca-qtd").value = "";
  document.getElementById("peca-comp-usado").value = "";
  document.getElementById("peca-obs").value = "";
  document.getElementById("peca-chapa").innerHTML =
    `<option value="">-- Selecionar chapa --</option>` +
    stock.map(s=>`<option value="${s.codigo}">${s.codigo} — ${s.material} ${s.espessura}</option>`).join('');
  openModal("modalPeca");
}

function editarPeca(id){
  const p = pecas.find(x => x.id === id);
  if(!p) return;
  document.getElementById("peca-edit-id").value = id;
  document.getElementById("pecaModalTitle").textContent = "✏️ Editar Peça";
  document.getElementById("peca-codigo").value = p.codigoPeca;
  document.getElementById("peca-qtd").value = p.quantidade;
  document.getElementById("peca-comp-usado").value = p.compUsado||"";
  document.getElementById("peca-obs").value = p.obs||"";
  document.getElementById("peca-chapa").innerHTML =
    `<option value="">-- Selecionar chapa --</option>` +
    stock.map(s=>`<option value="${s.codigo}"${s.codigo===p.codigoChapa?' selected':''}>${s.codigo} — ${s.material} ${s.espessura}</option>`).join('');
  openModal("modalPeca");
}

function salvarPeca(){
  const editId = document.getElementById("peca-edit-id").value;
  const codigoPeca = document.getElementById("peca-codigo").value.trim().toUpperCase();
  const codigoChapa = document.getElementById("peca-chapa").value;
  const quantidade = parseInt(document.getElementById("peca-qtd").value);
  const compUsado = parseFloat(document.getElementById("peca-comp-usado").value)||null;
  const obs = document.getElementById("peca-obs").value.trim()||"—";

  if(!codigoPeca){ showToast("⚠️ Informe o código da peça.", "err"); return; }
  if(!codigoChapa){ showToast("⚠️ Selecione a chapa.", "err"); return; }
  if(!quantidade||quantidade<1){ showToast("⚠️ Informe a quantidade de peças.", "err"); return; }

  const record = {codigoPeca, codigoChapa, quantidade, compUsado, obs};

  if(editId){
    record.id = editId;
    set(ref(db,`pecas/${editId}`), record).then(()=>{
      closeModal("modalPeca");
      showToast(`✅ Peça ${codigoPeca} atualizada!`);
    }).catch(e => showToast("⚠️ Erro: "+e.message, "err"));
  } else {
    const newId = push(ref(db,"pecas")).key;
    record.id = newId;
    set(ref(db,`pecas/${newId}`), record).then(()=>{
      closeModal("modalPeca");
      showToast(`✅ Peça ${codigoPeca} — ${quantidade} peças/chapa cadastradas!`);
    }).catch(e => showToast("⚠️ Erro: "+e.message, "err"));
  }
}

function excluirPeca(id){
  if(!confirm("Excluir este registro de peça?")) return;
  remove(ref(db,`pecas/${id}`))
    .then(()=> showToast("✅ Peça removida."))
    .catch(e => showToast("⚠️ Erro: "+e.message, "err"));
}

// ── EXPOSE TO WINDOW (fixes onclick in module scope) ──
Object.assign(window, {
  setView, setFilter, toggleShelf, renderShelfMap,
  openEntrada, openSaida, entradaCalc, saidaCalc,
  confirmarEntrada, confirmarSaida,
  openModal, closeModal,
  setHistTab, renderHistory,
  calcAutoFill, calcUpdate,
  requestAdminAccess, verificarSenha,
  cadastrarChapa, solicitarExcluir, confirmarExcluir,
  renderPdfs, handlePdfSelect, handlePdfDrop, deletePdf, abrirPdf,
  renderPecas, openPecaModal, editarPeca, salvarPeca, excluirPeca
});