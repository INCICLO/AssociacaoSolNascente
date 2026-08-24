const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";
const ROUTES_STORAGE_KEY = "sol_nascente_rotas_v2";

// ============================================================
// CONFIGURAÇÕES GERAIS E LOCALIZAÇÃO FIXA DA ASSOCIAÇÃO
// ============================================================

const DEPOT = {
  lat: -3.305048344119856,
  lng: -39.276497989005755,
  name: "Galpão / Base da Associação Sol Nascente"
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const ROAD_FACTOR = 1.3; // Fator de correção de malha viária urbana
const MAX_STOPS_PER_VEHICLE = 10; // Limite diário de pontos por veículo

let materialsChartInstance = null;
let completionChartInstance = null;

// ============================================================
// DADOS PADRÃO
// ============================================================

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de Solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    customLocationName: "",
    latitude: "-3.305048",
    longitude: "-39.276497",
    materials: "Papel, Papelão",
    quantity: "5",
    unit: "Sacos de 100L",
    frequency: "Segunda (Tarde)",
    notes: "Coleta na recepção",
    status: "AGENDADA",
    createdAt: new Date().toISOString()
  }
];

const defaultVehicles = [
  {
    id: "VEH-1",
    name: "Triciclo / Reboque Centro",
    plate: "TRI-01",
    type: "TRICICLO",
    capacityLiters: 1000,
    capacityKg: 500
  },
  {
    id: "VEH-2",
    name: "Caminhão Baú Geral",
    plate: "CAM-01",
    type: "CAMINHAO",
    capacityLiters: 10000,
    capacityKg: 2500
  }
];

// ============================================================
// CARREGAMENTO E SALVAMENTO
// ============================================================

function loadStorageData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    return fallback;
  }
}

let requests = loadStorageData(STORAGE_KEY, defaultRequests);
let vehicles = loadStorageData(VEHICLES_STORAGE_KEY, defaultVehicles);
let generatedRoutes = loadStorageData(ROUTES_STORAGE_KEY, []);

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(requests)); }
function saveVehicles() { localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles)); }
function saveRoutes() { localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(generatedRoutes)); }

// ============================================================
// UTILITÁRIOS E CÁLCULO DE DISTÂNCIA
// ============================================================

function dateToISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * ROAD_FACTOR;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function statusBadge(status) {
  const cleanStatus = status.replaceAll(" ", "-").toLowerCase();
  return `<span class="status status-${cleanStatus}">${escapeHTML(status)}</span>`;
}

// Verifica se o ponto de coleta é no Centro de Trairi (Raio aproximado de 2.5km do centro)
function isCentroTrairi(lat, lng) {
  const centroLat = -3.2778;
  const centroLng = -39.2688;
  return distanceKm(Number(lat), Number(lng), centroLat, centroLng) <= 3.5;
}

// ============================================================
// DASHBOARD COM MÉTRICAS E GRÁFICOS DE INDICADORES
// ============================================================

function renderDashboard() {
  const total = requests.length;
  const realizadas = requests.filter(r => r.status === "COLETADA" || r.status === "FINALIZADA").length;
  const naoRealizadas = total - realizadas;

  const percentRealizadas = total ? Math.round((realizadas / total) * 100) : 0;
  const percentNaoRealizadas = total ? Math.round((naoRealizadas / total) * 100) : 0;

  document.getElementById("statPercentRealizadas").textContent = `${percentRealizadas}%`;
  document.getElementById("statCountRealizadas").textContent = `${realizadas} coletas concluídas`;

  document.getElementById("statPercentNaoRealizadas").textContent = `${percentNaoRealizadas}%`;
  document.getElementById("statCountNaoRealizadas").textContent = `${naoRealizadas} pendentes / canceladas`;

  document.getElementById("statEmRota").textContent = requests.filter(r => r.status === "EM ROTA").length;
  document.getElementById("statTotal").textContent = total;

  renderDashboardCharts(realizadas, naoRealizadas);

  const recent = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentList = document.getElementById("recentList");
  if (recentList) recentList.innerHTML = tableHTML(recent, false);
}

function renderDashboardCharts(realizadas, naoRealizadas) {
  if (typeof Chart === "undefined") return;

  // 1. CHART DE CATEGORIA DE RESÍDUOS
  const categoryTotals = {};
  requests.forEach(r => {
    if (!r.materials) return;
    const liters = convertToLiters(r.quantity, r.unit, r.materials);
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

  // 2. CHART DE PERCENTUAL DE CONCLUSÃO
  const ctxComp = document.getElementById("completionChart")?.getContext("2d");
  if (ctxComp) {
    if (completionChartInstance) completionChartInstance.destroy();
    completionChartInstance = new Chart(ctxComp, {
      type: "pie",
      data: {
        labels: ["Coletadas / Concluídas", "Não Realizadas / Pendentes"],
        datasets: [{
          data: [realizadas, naoRealizadas],
          backgroundColor: ["#1e7e45", "#eb5b2b"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

// ============================================================
// CONVERSÃO E ESTIMATIVAS DE CARGA
// ============================================================

function convertToLiters(qtyStr, unitStr, matStr = "") {
  const qty = parseFloat(qtyStr) || 0;
  const unit = (unitStr || "").toLowerCase();
  if (unit.includes("saco")) return qty * 100;
  if (unit.includes("bigbag")) return qty * 1000;
  if (unit.includes("caixa")) return qty * 50;
  if (unit.includes("kg")) return qty / 0.15;
  return qty;
}

function estimateWeightKg(qtyStr, unitStr, matStr = "") {
  const qty = parseFloat(qtyStr) || 0;
  if ((unitStr || "").toLowerCase().includes("kg")) return qty;
  return convertToLiters(qtyStr, unitStr, matStr) * 0.15;
}

// ============================================================
// FORMULÁRIO COM DIAS E TURNOS FIXOS DE COLETA
// ============================================================

function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">
      <div class="form-group-block">
        <label class="form-label">Nome Completo *
          <input name="name" required placeholder="Digite o nome completo" class="big-input">
        </label>
        <label class="form-label">Telefone (WhatsApp) *
          <input name="phone" required placeholder="(88) 99999-9999" class="big-input">
        </label>
      </div>

      <div class="form-group-block">
        <label class="form-label">Dia e Turno Preferencial para Coleta *
          <select name="frequency" required class="big-select">
            <option value="">Selecione a opção disponível...</option>
            <option value="Segunda (Tarde)">Segunda-feira (Tarde)</option>
            <option value="Terça (Tarde)">Terça-feira (Tarde)</option>
            <option value="Quarta (Tarde)">Quarta-feira (Tarde)</option>
            <option value="Quinta (Noite)">Quinta-feira (Noite)</option>
          </select>
        </label>
      </div>

      <div class="form-group-block">
        <label class="form-label">Localização da Coleta</label>
        <div class="map-container" id="map-${formId}"></div>
        <input type="hidden" name="latitude" required>
        <input type="hidden" name="longitude" required>
      </div>

      <div class="form-group-block">
        <label class="form-label">Resíduos para Coleta</label>
        <div class="materials-grid">
          <label><input type="checkbox" name="materials_list" value="Papel"> Papel / Papelão</label>
          <label><input type="checkbox" name="materials_list" value="Plástico"> Plástico / PET</label>
          <label><input type="checkbox" name="materials_list" value="Vidro"> Vidro</label>
          <label><input type="checkbox" name="materials_list" value="Metal"> Metal</label>
        </div>
      </div>

      <div class="form-group-block row-group" style="display:flex; gap:10px;">
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

      <button class="primary-btn submit-btn" type="submit">SUBMETER SOLICITAÇÃO</button>
    </form>
  `;
}

// ============================================================
// MAPA E SELEÇÃO DE LOCALIZAÇÃO
// ============================================================

function initMap(formId) {
  const mapElement = document.getElementById(`map-${formId}`);
  if (!mapElement || typeof L === "undefined") return;

  const map = L.map(mapElement).setView([DEPOT.lat, DEPOT.lng], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  // Marcador fixo do galpão da associação
  L.marker([DEPOT.lat, DEPOT.lng]).addTo(map).bindPopup(DEPOT.name);

  let marker = null;
  map.on("click", e => {
    if (marker) map.removeLayer(marker);
    marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

    const form = document.getElementById(formId);
    form.querySelector('input[name="latitude"]').value = e.latlng.lat.toFixed(6);
    form.querySelector('input[name="longitude"]').value = e.latlng.lng.toFixed(6);
  });
}

// ============================================================
// ROTEIRIZAÇÃO DO DIA E REGRAS DE VEÍCULOS
// ============================================================

function generateTodayRoutes() {
  const todayISO = dateToISO(new Date());
  const todayRequests = requests.filter(r => r.status === "AGENDADA" || r.status === "EM ROTA");

  const unassigned = [...todayRequests];
  const routes = [];

  // Otimização e Separação por regras do veículo
  vehicles.forEach(vehicle => {
    if (!unassigned.length) return;

    const assignedStops = [];
    let currentCapacityLiters = 0;

    for (let i = unassigned.length - 1; i >= 0; i--) {
      if (assignedStops.length >= MAX_STOPS_PER_VEHICLE) break; // Limite de 10 pontos

      const req = unassigned[i];
      const inCentro = isCentroTrairi(req.latitude, req.longitude);

      // Regra 1: Triciclo exclusivo para o centro
      if (vehicle.type === "TRICICLO" && !inCentro) continue;

      // Regra 2: Caminhão apenas para fora do centro
      if (vehicle.type === "CAMINHAO" && inCentro) continue;

      const liters = convertToLiters(req.quantity, req.unit, req.materials);
      if (currentCapacityLiters + liters <= vehicle.capacityLiters) {
        assignedStops.push(req);
        currentCapacityLiters += liters;
        unassigned.splice(i, 1);
      }
    }

    if (assignedStops.length) {
      routes.push({
        id: `ROT-${todayISO}-${vehicle.id}`,
        vehicleName: vehicle.name,
        vehiclePlate: vehicle.plate,
        stops: assignedStops,
        totalLiters: Math.round(currentCapacityLiters)
      });
    }
  });

  return routes;
}

function renderTodayRoutes() {
  const container = document.getElementById("todayRoutesContainer");
  if (!container) return;

  const routes = generateTodayRoutes();
  if (!routes.length) {
    container.innerHTML = `<div class="empty-state"><h2>Nenhuma rota agendada para o dia de hoje</h2></div>`;
    return;
  }

  container.innerHTML = routes.map(route => `
    <div class="panel" style="margin-bottom:16px;">
      <h2>🚚 ${escapeHTML(route.vehicleName)} (${escapeHTML(route.vehiclePlate)})</h2>
      <p>Total Paradas: ${route.stops.length} / 10 | Volume: ${route.totalLiters} L</p>
      <table>
        <thead>
          <tr><th>Order</th><th>Solicitante</th><th>Local</th><th>Endereço / Mapa</th></tr>
        </thead>
        <tbody>
          ${route.stops.map((stop, idx) => `
            <tr>
              <td><strong>#${idx + 1}</strong></td>
              <td>${escapeHTML(stop.name)}</td>
              <td>${isCentroTrairi(stop.latitude, stop.longitude) ? "Centro de Trairi" : "Distrito / Periferia"}</td>
              <td><a href="https://maps.google.com/?q=${stop.latitude},${stop.longitude}" target="_blank">Abrir Google Maps</a></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `).join("");
}

// ============================================================
// TELA EXCLUSIVA DO MOTORISTA (MODO APP)
// ============================================================

function renderDriverView() {
  const container = document.getElementById("driverRoutesContainer");
  if (!container) return;

  const routes = generateTodayRoutes();
  if (!routes.length) {
    container.innerHTML = `<div class="empty-state"><h2>Você não possui coletas atribuídas para hoje.</h2></div>`;
    return;
  }

  container.innerHTML = routes.map(route => `
    <div class="panel" style="margin-bottom:20px;">
      <h2>Veículo: ${escapeHTML(route.vehicleName)}</h2>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
        ${route.stops.map((stop, idx) => `
          <div style="padding:14px; background:var(--background); border-radius:8px; border:1px solid var(--border);">
            <h3>${idx + 1}. ${escapeHTML(stop.name)}</h3>
            <p><strong>Tel:</strong> ${escapeHTML(stop.phone)}</p>
            <p><strong>Materiais:</strong> ${escapeHTML(stop.materials)} (${stop.quantity} ${stop.unit})</p>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <a href="https://maps.google.com/?q=${stop.latitude},${stop.longitude}" target="_blank" class="primary-btn" style="text-decoration:none; font-size:12px;">🗺️ Navegar</a>
              <button class="secondary-btn" onclick="markAsCollected('${stop.id}')">✓ Confirmar Coleta</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function markAsCollected(reqId) {
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = "COLETADA";
    save();
    renderDriverView();
    renderDashboard();
    toast("Coleta confirmada!");
  }
}

// ============================================================
// CALENDÁRIO / AGENDA DE COLETAS
// ============================================================

function renderCalendar() {
  const container = document.getElementById("calendarContainer");
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let daysHTML = "";
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = requests.filter(r => r.status === "AGENDADA").length;

    daysHTML += `
      <div class="calendar-cell">
        <div class="calendar-date-num">${day}</div>
        ${count ? `<span class="calendar-badge">${count} coletas</span>` : ""}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="calendar-header">
      <h2>Mês Atual (${now.toLocaleString("pt-BR", { month: "long" })})</h2>
    </div>
    <div class="calendar-grid">
      <div class="calendar-day-head">Dom</div>
      <div class="calendar-day-head">Seg</div>
      <div class="calendar-day-head">Ter</div>
      <div class="calendar-day-head">Qua</div>
      <div class="calendar-day-head">Qui</div>
      <div class="calendar-day-head">Sex</div>
      <div class="calendar-day-head">Sáb</div>
      ${daysHTML}
    </div>
  `;
}

// ============================================================
// NAVEGAÇÃO SPA E INICIALIZAÇÃO
// ============================================================

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active-section");

  if (sectionId === "dashboard") renderDashboard();
  if (sectionId === "agenda") renderCalendar();
  if (sectionId === "rotas") renderTodayRoutes();
  if (sectionId === "driver-view") renderDriverView();
}

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "driver") {
    document.body.classList.add("driver-mode");
    showSection("driver-view");
  } else {
    renderDashboard();
  }

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  document.getElementById("shareDriverAppBtn")?.addEventListener("click", () => {
    const driverUrl = `${window.location.origin}${window.location.pathname}?mode=driver`;
    navigator.clipboard.writeText(driverUrl);
    toast("Link do App do Motorista copiado!");
  });
});

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}
