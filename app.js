// CONFIGURAÇÕES GERAIS E PERSISTÊNCIA
const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";

const DEPOT = {
  lat: -3.305048344119856,
  lng: -39.276497989005755,
  name: "Galpão / Base da Associação Sol Nascente"
};

let materialsChartInstance = null;
let completionChartInstance = null;

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Maria Silva",
    phone: "(88) 99888-7766",
    type: "Residência",
    latitude: "-3.305048",
    longitude: "-39.276497",
    materials: "Papel, Papelão",
    quantity: "3",
    unit: "Sacos de 100L",
    frequency: "Segunda (Tarde)",
    status: "AGENDADA",
    createdAt: new Date().toISOString(),
    createdAtFormatted: "24/08/2026 às 13:50"
  }
];

const defaultVehicles = [
  { id: "VEH-1", name: "Triciclo Centro", plate: "TRI-01", type: "TRICICLO", capacityLiters: 1000 },
  { id: "VEH-2", name: "Caminhão Baú", plate: "CAM-01", type: "CAMINHAO", capacityLiters: 10000 }
];

function loadData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    return fallback;
  }
}

let requests = loadData(STORAGE_KEY, defaultRequests);
let vehicles = loadData(VEHICLES_STORAGE_KEY, defaultVehicles);

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Erro ao salvar no localStorage:", e);
  }
}

function saveVehicles() {
  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
  } catch (e) {
    console.error("Erro ao salvar veículos:", e);
  }
}

// UTILITÁRIOS DE DATA, HORA E FORMATO
function getFormattedNow() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} às ${timeStr}`;
}

function escapeHTML(str = "") {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function statusBadge(status) {
  const clean = String(status).replaceAll(" ", "-").toLowerCase();
  return `<span class="status status-${clean}">${escapeHTML(status)}</span>`;
}

function convertToLiters(qtyStr, unitStr) {
  const qty = parseFloat(qtyStr) || 0;
  const unit = (unitStr || "").toLowerCase();
  if (unit.includes("saco")) return qty * 100;
  if (unit.includes("bigbag")) return qty * 1000;
  if (unit.includes("caixa")) return qty * 50;
  return qty;
}

// ROTEAMENTO DE SEÇÕES E URLS
function checkURLParams() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("form") === "public") {
    document.body.classList.add("public-mode");
    const container = document.getElementById("publicFormContainer");
    if (container) {
      container.innerHTML = buildFormHTML("publicForm");
      initFormEvents("publicForm");
    }
    showSection("public-form-section");
    return true;
  }

  if (urlParams.get("mode") === "driver") {
    document.body.classList.add("driver-mode");
    showSection("driver-view");
    return true;
  }

  return false;
}

function showSection(sectionId) {
  try {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

    const target = document.getElementById(sectionId);
    if (target) target.classList.add("active-section");

    const activeNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNav) activeNav.classList.add("active");

    document.getElementById("sidebar")?.classList.remove("open");

    if (sectionId === "dashboard") renderDashboard();
    if (sectionId === "solicitacoes") renderRequests();
    if (sectionId === "clientes") renderClients();
    if (sectionId === "veiculos") renderVehicles();
    if (sectionId === "agenda") renderCalendar();
    if (sectionId === "rotas") renderTodayRoutes();
    if (sectionId === "driver-view") renderDriverView();
  } catch (err) {
    console.error("Erro na navegação:", err);
  }
}

// DASHBOARD E GRÁFICOS
function renderDashboard() {
  const total = requests.length;
  const realizadas = requests.filter(r => r.status === "COLETADA" || r.status === "FINALIZADA").length;
  const naoRealizadas = total - realizadas;

  const percentR = total ? Math.round((realizadas / total) * 100) : 0;
  const percentNR = total ? Math.round((naoRealizadas / total) * 100) : 0;

  const elR = document.getElementById("statPercentRealizadas");
  if (elR) elR.textContent = `${percentR}%`;

  const countR = document.getElementById("statCountRealizadas");
  if (countR) countR.textContent = `${realizadas} coletas concluídas`;

  const elNR = document.getElementById("statPercentNaoRealizadas");
  if (elNR) elNR.textContent = `${percentNR}%`;

  const countNR = document.getElementById("statCountNaoRealizadas");
  if (countNR) countNR.textContent = `${naoRealizadas} pendentes / canceladas`;

  const elEmRota = document.getElementById("statEmRota");
  if (elEmRota) elEmRota.textContent = requests.filter(r => r.status === "EM ROTA").length;

  const elTotal = document.getElementById("statTotal");
  if (elTotal) elTotal.textContent = total;

  renderCharts(realizadas, naoRealizadas);

  const recent = [...requests].reverse().slice(0, 5);
  const recentList = document.getElementById("recentList");
  if (recentList) recentList.innerHTML = buildTableHTML(recent, false);
}

function renderCharts(realizadas, naoRealizadas) {
  if (typeof Chart === "undefined") return;

  try {
    const categoryTotals = {};
    requests.forEach(r => {
      if (!r.materials) return;
      const liters = convertToLiters(r.quantity, r.unit);
      const list = r.materials.split(",").map(m => m.trim());
      const vol = liters / (list.length || 1);
      list.forEach(m => { categoryTotals[m] = (categoryTotals[m] || 0) + vol; });
    });

    const ctxMat = document.getElementById("materialsChart")?.getContext("2d");
    if (ctxMat) {
      if (materialsChartInstance) materialsChartInstance.destroy();
      materialsChartInstance = new Chart(ctxMat, {
        type: "doughnut",
        data: {
          labels: Object.keys(categoryTotals).length ? Object.keys(categoryTotals) : ["Sem dados"],
          datasets: [{
            data: Object.values(categoryTotals).length ? Object.values(categoryTotals) : [1],
            backgroundColor: ["#eb5b2b", "#242a55", "#085157", "#1e7e45", "#f4a261"]
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    const ctxComp = document.getElementById("completionChart")?.getContext("2d");
    if (ctxComp) {
      if (completionChartInstance) completionChartInstance.destroy();
      completionChartInstance = new Chart(ctxComp, {
        type: "pie",
        data: {
          labels: ["Coletadas / Concluídas", "Não Realizadas / Pendentes"],
          datasets: [{ data: [realizadas, naoRealizadas], backgroundColor: ["#1e7e45", "#eb5b2b"] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  } catch (e) {
    console.error("Erro ao gerar gráficos:", e);
  }
}

// TABELA DE SOLICITAÇÕES
function buildTableHTML(data, withActions = true) {
  if (!data.length) return `<div style="padding:20px;text-align:center;color:var(--muted);">Nenhuma solicitação registrada.</div>`;
  return `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Solicitante / Telefone</th>
          <th>Data / Hora do Cadastro</th>
          <th>Turno Agendado</th>
          <th>Materiais / Qtd</th>
          <th>Status</th>
          ${withActions ? "<th>Ação</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td><strong>${escapeHTML(r.id)}</strong></td>
            <td><strong>${escapeHTML(r.name)}</strong><br><small>${escapeHTML(r.phone)}</small></td>
            <td><small>🕒 ${escapeHTML(r.createdAtFormatted || "Data não gravada")}</small></td>
            <td><small>${escapeHTML(r.frequency || "Não informada")}</small></td>
            <td>${escapeHTML(r.materials)}<br><small><strong>Total:</strong> ${escapeHTML(r.quantity)} ${escapeHTML(r.unit)}</small></td>
            <td>${statusBadge(r.status)}</td>
            ${withActions ? `
              <td>
                <select onchange="updateRequestStatus('${r.id}', this.value)" style="padding:4px 6px; font-size:12px;">
                  ${["NOVA", "EM ANÁLISE", "AGENDADA", "EM ROTA", "COLETADA", "FINALIZADA"]
                    .map(s => `<option value="${s}" ${s === r.status ? "selected" : ""}>${s}</option>`)
                    .join("")}
                </select>
              </td>
            ` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function updateRequestStatus(id, newStatus) {
  const req = requests.find(r => r.id === id);
  if (req) {
    req.status = newStatus;
    saveData();
    renderDashboard();
    toast("Status atualizado!");
  }
}

function renderRequests() {
  const query = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const statusFilter = document.getElementById("statusFilter")?.value || "";

  const filtered = requests.filter(r => {
    const text = `${r.id} ${r.name} ${r.phone} ${r.materials}`.toLowerCase();
    return (!query || text.includes(query)) && (!statusFilter || r.status === statusFilter);
  });

  const container = document.getElementById("requestsTable");
  if (container) container.innerHTML = buildTableHTML(filtered, true);
}

// CLIENTES
function renderClients() {
  const container = document.getElementById("clientsList");
  if (!container) return;

  if (!requests.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;">Nenhum cliente cadastrado.</div>`;
    return;
  }

  container.innerHTML = requests.map(r => `
    <article class="client-card">
      <h3>${escapeHTML(r.name)}</h3>
      <p><strong>Tel:</strong> ${escapeHTML(r.phone)}</p>
      <p><strong>Turno:</strong> ${escapeHTML(r.frequency)}</p>
      <p><strong>Cadastrado em:</strong> ${escapeHTML(r.createdAtFormatted || "-")}</p>
      <p><strong>Status:</strong> ${statusBadge(r.status)}</p>
    </article>
  `).join("");
}

// VEÍCULOS
function renderVehicles() {
  const container = document.getElementById("vehiclesList");
  if (!container) return;
  container.innerHTML = `
    <table>
      <thead><tr><th>Identificador</th><th>Nome</th><th>Placa</th><th>Tipo</th><th>Capacidade</th></tr></thead>
      <tbody>
        ${vehicles.map(v => `
          <tr>
            <td><strong>${escapeHTML(v.id)}</strong></td>
            <td>${escapeHTML(v.name)}</td>
            <td>${escapeHTML(v.plate)}</td>
            <td>${escapeHTML(v.type)}</td>
            <td>${v.capacityLiters} Litros</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// CALENDÁRIO
function renderCalendar() {
  const container = document.getElementById("calendarContainer");
  if (!container) return;
  const now = new Date();
  container.innerHTML = `
    <div style="margin-bottom:12px;"><h2>Mês Atual — ${now.toLocaleString("pt-BR", { month: "long" })} / ${now.getFullYear()}</h2></div>
    <div class="calendar-grid">
      <div class="calendar-day-head">Dom</div><div class="calendar-day-head">Seg</div>
      <div class="calendar-day-head">Ter</div><div class="calendar-day-head">Qua</div>
      <div class="calendar-day-head">Qui</div><div class="calendar-day-head">Sex</div>
      <div class="calendar-day-head">Sáb</div>
      ${Array.from({ length: 30 }, (_, i) => `<div class="calendar-cell"><div class="calendar-date-num">${i + 1}</div></div>`).join("")}
    </div>
  `;
}

// ROTAS E TELA DO MOTORISTA
function renderTodayRoutes() {
  const container = document.getElementById("todayRoutesContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="panel">
      <h2>🚚 Rotas Otimizadas do Dia</h2>
      <p>Abaixo estão os itinerários gerados para os veículos cadastrados.</p>
      ${buildTableHTML(requests, false)}
    </div>
  `;
}

function renderDriverView() {
  const container = document.getElementById("driverRoutesContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="panel">
      <h2>Minhas Coletas de Hoje</h2>
      <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
        ${requests.map((r, i) => `
          <div style="padding:14px; background:#f5f7fa; border:1px solid #d2d8e0; border-radius:8px;">
            <strong>#${i + 1} - ${escapeHTML(r.name)}</strong>
            <p><strong>Tel:</strong> ${escapeHTML(r.phone)}</p>
            <p><strong>Materiais:</strong> ${escapeHTML(r.materials)} (${r.quantity} ${r.unit})</p>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" class="primary-btn" style="text-decoration:none; font-size:12px;">🗺️ Abrir Google Maps</a>
              <button type="button" class="secondary-btn" onclick="confirmDriverCollect('${r.id}')">✓ Confirmar Coleta</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function confirmDriverCollect(id) {
  const req = requests.find(r => r.id === id);
  if (req) {
    req.status = "COLETADA";
    saveData();
    renderDriverView();
    toast("Coleta confirmada pelo motorista!");
  }
}

// FORMULÁRIO E MODAIS
function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">
      <div class="form-group-block">
        <label class="form-label">Nome Completo *
          <input name="name" required placeholder="Digite seu nome completo" class="big-input">
        </label>
        <label class="form-label">Telefone (WhatsApp) *
          <input name="phone" required placeholder="(88) 99999-9999" class="big-input">
        </label>
      </div>

      <div class="form-group-block">
        <label class="form-label">Dia e Turno Preferencial para Coleta *
          <select name="frequency" required class="big-select">
            <option value="">Selecione o turno disponível...</option>
            <option value="Segunda (Tarde)">Segunda-feira (Tarde)</option>
            <option value="Terça (Tarde)">Terça-feira (Tarde)</option>
            <option value="Quarta (Tarde)">Quarta-feira (Tarde)</option>
            <option value="Quinta (Noite)">Quinta-feira (Noite)</option>
          </select>
        </label>
      </div>

      <div class="form-group-block">
        <label class="form-label">Selecione os Resíduos Recicláveis *</label>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:4px;">
          <label><input type="checkbox" name="materials_list" value="Papel"> Papel / Papelão</label>
          <label><input type="checkbox" name="materials_list" value="Plástico"> Plástico / PET</label>
          <label><input type="checkbox" name="materials_list" value="Vidro"> Vidro</label>
          <label><input type="checkbox" name="materials_list" value="Metal"> Metal / Latas</label>
        </div>
      </div>

      <div class="form-group-block" style="display:flex; gap:10px;">
        <label class="form-label" style="flex:1;">Quantidade *
          <input name="quantity" type="number" step="0.1" required placeholder="Ex: 5" class="big-input">
        </label>
        <label class="form-label" style="flex:1;">Unidade *
          <select name="unit" required class="big-select">
            <option value="Sacos de 100L">Sacos de 100 Litros</option>
            <option value="Kg">Kg</option>
            <option value="BigBags">BigBags</option>
          </select>
        </label>
      </div>

      <div class="form-group-block">
        <label class="form-label">Confirme o Ponto no Mapa</label>
        <div class="map-container" id="map-${formId}"></div>
        <input type="hidden" name="latitude" value="${DEPOT.lat}">
        <input type="hidden" name="longitude" value="${DEPOT.lng}">
      </div>

      <button class="primary-btn submit-btn" type="submit" style="margin-top:10px; width:100%;">SUBMETER SOLICITAÇÃO</button>
    </form>
  `;
}

function openModal() {
  const modal = document.getElementById("requestModal");
  if (modal) {
    modal.classList.remove("hidden");
    const container = document.getElementById("modalFormContainer");
    if (container) {
      container.innerHTML = buildFormHTML("modalForm");
      initFormEvents("modalForm");
    }
  }
}

function closeModal() {
  document.getElementById("requestModal")?.classList.add("hidden");
  document.getElementById("vehicleModal")?.classList.add("hidden");
}

function initFormEvents(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  // Mapa
  const mapElement = form.querySelector(`#map-${formId}`);
  if (mapElement && typeof L !== "undefined") {
    setTimeout(() => {
      const map = L.map(mapElement).setView([DEPOT.lat, DEPOT.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      L.marker([DEPOT.lat, DEPOT.lng]).addTo(map).bindPopup("Galpão Associação");

      let marker = null;
      map.on("click", e => {
        if (marker) map.removeLayer(marker);
        marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        form.querySelector('input[name="latitude"]').value = e.latlng.lat.toFixed(6);
        form.querySelector('input[name="longitude"]').value = e.latlng.lng.toFixed(6);
      });
    }, 200);
  }

  // Submit do formulário
  form.onsubmit = e => {
    e.preventDefault();
    const formData = new FormData(form);

    const materialsChecked = [
      ...form.querySelectorAll('input[name="materials_list"]:checked')
    ].map(cb => cb.value);

    const newRequest = {
      id: `SOL-2026-${String(requests.length + 1).padStart(6, "0")}`,
      name: formData.get("name"),
      phone: formData.get("phone"),
      frequency: formData.get("frequency"),
      materials: materialsChecked.length ? materialsChecked.join(", ") : "Recicláveis Geral",
      quantity: formData.get("quantity"),
      unit: formData.get("unit"),
      latitude: formData.get("latitude") || DEPOT.lat,
      longitude: formData.get("longitude") || DEPOT.lng,
      status: "NOVA",
      createdAt: new Date().toISOString(),
      createdAtFormatted: getFormattedNow()
    };

    requests.push(newRequest);
    saveData();

    if (document.body.classList.contains("public-mode")) {
      form.innerHTML = `
        <div style="text-align:center; padding:30px 10px;">
          <h2 style="color:var(--navy);">Solicitação Registrada!</h2>
          <p>O seu código de acompanhamento é: <strong>${newRequest.id}</strong></p>
          <p><small>Registrado em: ${newRequest.createdAtFormatted}</small></p>
          <button type="button" class="primary-btn" onclick="window.location.reload()" style="margin-top:15px;">Fazer Nova Solicitação</button>
        </div>
      `;
    } else {
      closeModal();
      renderDashboard();
      renderRequests();
      toast(`Solicitação ${newRequest.id} cadastrada com sucesso!`);
    }
  };
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// EVENT DELEGATION GLOBAL (CLIQUES ILIMITADOS SEM TRAVAMENTO)
document.addEventListener("click", e => {
  const target = e.target.closest("[data-section], [data-section-link], .btn-open-modal, #closeModal, #closeVehicleModal, #menuToggle, #shareFormBtn, #shareDriverAppBtn, #novoVeiculoBtn");
  if (!target) return;

  if (target.dataset.section) {
    showSection(target.dataset.section);
  } else if (target.dataset.sectionLink) {
    showSection(target.dataset.sectionLink);
  } else if (target.classList.contains("btn-open-modal")) {
    openModal();
  } else if (target.id === "closeModal" || target.id === "closeVehicleModal") {
    closeModal();
  } else if (target.id === "menuToggle") {
    document.getElementById("sidebar")?.classList.toggle("open");
  } else if (target.id === "novoVeiculoBtn") {
    document.getElementById("vehicleModal")?.classList.remove("hidden");
  } else if (target.id === "shareFormBtn") {
    const publicUrl = `${window.location.origin}${window.location.pathname}?form=public`;
    navigator.clipboard?.writeText(publicUrl);
    toast("Link público copiado!");
  } else if (target.id === "shareDriverAppBtn") {
    const driverUrl = `${window.location.origin}${window.location.pathname}?mode=driver`;
    navigator.clipboard?.writeText(driverUrl);
    toast("Link do App Motorista copiado!");
  }
});

// SUBMIT DO FORMULÁRIO DE VEÍCULOS
document.addEventListener("DOMContentLoaded", () => {
  const vehicleForm = document.getElementById("vehicleForm");
  if (vehicleForm) {
    vehicleForm.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(vehicleForm);
      vehicles.push({
        id: `VEH-${vehicles.length + 1}`,
        name: fd.get("name"),
        plate: fd.get("plate"),
        type: fd.get("type"),
        capacityLiters: parseFloat(fd.get("capacityLiters")) || 1000
      });
      saveVehicles();
      closeModal();
      renderVehicles();
      toast("Veículo cadastrado!");
    };
  }

  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  if (searchInput) searchInput.oninput = renderRequests;
  if (statusFilter) statusFilter.onchange = renderRequests;

  if (!checkURLParams()) {
    renderDashboard();
  }
});
