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
const ROAD_FACTOR = 1.3;
const MAX_STOPS_PER_VEHICLE = 10;

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

function isCentroTrairi(lat, lng) {
  const centroLat = -3.2778;
  const centroLng = -39.2688;
  return distanceKm(Number(lat), Number(lng), centroLat, centroLng) <= 3.5;
}

// ============================================================
// DASHBOARD COM MÉTRICAS E GRÁFICOS
// ============================================================

function renderDashboard() {
  const total = requests.length;
  const realizadas = requests.filter(r => r.status === "COLETADA" || r.status === "FINALIZADA").length;
  const naoRealizadas = total - realizadas;

  const percentRealizadas = total ? Math.round((realizadas / total) * 100) : 0;
  const percentNaoRealizadas = total ? Math.round((naoRealizadas / total) * 100) : 0;

  const statRealizadas = document.getElementById("statPercentRealizadas");
  if (statRealizadas) statRealizadas.textContent = `${percentRealizadas}%`;
  
  const countRealizadas = document.getElementById("statCountRealizadas");
  if (countRealizadas) countRealizadas.textContent = `${realizadas} coletas concluídas`;

  const statNaoRealizadas = document.getElementById("statPercentNaoRealizadas");
  if (statNaoRealizadas) statNaoRealizadas.textContent = `${percentNaoRealizadas}%`;
  
  const countNaoRealizadas = document.getElementById("statCountNaoRealizadas");
  if (countNaoRealizadas) countNaoRealizadas.textContent = `${naoRealizadas} pendentes / canceladas`;

  const statEmRota = document.getElementById("statEmRota");
  if (statEmRota) statEmRota.textContent = requests.filter(r => r.status === "EM ROTA").length;
  
  const statTotal = document.getElementById("statTotal");
  if (statTotal) statTotal.textContent = total;

  renderDashboardCharts(realizadas, naoRealizadas);

  const recent = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentList = document.getElementById("recentList");
  if (recentList) recentList.innerHTML = tableHTML(recent, false);
}

function renderDashboardCharts(realizadas, naoRealizadas) {
  if (typeof Chart === "undefined") return;

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
// CONVERSÃO E TABELAS
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

function tableHTML(data, withActions = true) {
  if (!data.length) return `<div class="empty-state"><h2>Nenhum registro encontrado</h2></div>`;
  return `
    <table>
      <thead>
        <tr><th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td><strong>${escapeHTML(r.id)}</strong></td>
            <td>${escapeHTML(r.name)}<br><small>${escapeHTML(r.phone)}</small></td>
            <td>${escapeHTML(r.type)}</td>
            <td>${escapeHTML(r.materials)} (${r.quantity} ${r.unit})</td>
            <td>${statusBadge(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ============================================================
// MODAIS E FORMULÁRIOS
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
        <label class="form-label">Dia e Turno Preferencial *
          <select name="frequency" required class="big-select">
            <option value="">Selecione...</option>
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

function openModal() {
  const container = document.getElementById("modalFormContainer");
  if (!container) return;
  container.innerHTML = buildFormHTML("modalForm");
  initMap("modalForm");
  document.getElementById("requestModal")?.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("requestModal")?.classList.add("hidden");
}

function initMap(formId) {
  const mapElement = document.getElementById(`map-${formId}`);
  if (!mapElement || typeof L === "undefined") return;

  setTimeout(() => {
    const map = L.map(mapElement).setView([DEPOT.lat, DEPOT.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    L.marker([DEPOT.lat, DEPOT.lng]).addTo(map).bindPopup(DEPOT.name);

    let marker = null;
    map.on("click", e => {
      if (marker) map.removeLayer(marker);
      marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

      const form = document.getElementById(formId);
      if (form) {
        form.querySelector('input[name="latitude"]').value = e.latlng.lat.toFixed(6);
        form.querySelector('input[name="longitude"]').value = e.latlng.lng.toFixed(6);
      }
    });
  }, 200);
}

// ============================================================
// CALENDÁRIO E ROTAS
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
      <h2>${now.toLocaleString("pt-BR", { month: "long" })} / ${year}</h2>
    </div>
    <div class="calendar-grid">
      <div class="calendar-day-head">Dom</div><div class="calendar-day-head">Seg</div>
      <div class="calendar-day-head">Ter</div><div class="calendar-day-head">Qua</div>
      <div class="calendar-day-head">Qui</div><div class="calendar-day-head">Sex</div>
      <div class="calendar-day-head">Sáb</div>
      ${daysHTML}
    </div>
  `;
}

function generateTodayRoutes() {
  const todayISO = dateToISO(new Date());
  const todayRequests = requests.filter(r => r.status === "AGENDADA" || r.status === "EM ROTA");

  const unassigned = [...todayRequests];
  const routes = [];

  vehicles.forEach(vehicle => {
    if (!unassigned.length) return;

    const assignedStops = [];
    let currentCapacityLiters = 0;

    for (let i = unassigned.length - 1; i >= 0; i--) {
      if (assignedStops.length >= MAX_STOPS_PER_VEHICLE) break;

      const req = unassigned[i];
      const inCentro = isCentroTrairi(req.latitude, req.longitude);

      if (vehicle.type === "TRICICLO" && !inCentro) continue;
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
      <p>Paradas: ${route.stops.length} / 10 | Volume: ${route.totalLiters} L</p>
      <table>
        <thead>
          <tr><th>Order</th><th>Solicitante</th><th>Local</th><th>Endereço / Mapa</th></tr>
        </thead>
        <tbody>
          ${route.stops.map((stop, idx) => `
            <tr>
              <td><strong>#${idx + 1}</strong></td>
              <td>${escapeHTML(stop.name)}</td>
              <td>${isCentroTrairi(stop.latitude, stop.longitude) ? "Centro de Trairi" : "Distrito"}</td>
              <td><a href="https://maps.google.com/?q=${stop.latitude},${stop.longitude}" target="_blank">Abrir Google Maps</a></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `).join("");
}

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
            <p><strong>Materiais:</strong> ${escapeHTML(stop.materials || "Recicláveis")} (${stop.quantity} ${stop.unit})</p>
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
// NAVEGAÇÃO E INICIALIZAÇÃO SEGURA
// ============================================================

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active-section");

  const navBtn = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navBtn) navBtn.classList.add("active");

  if (sectionId === "dashboard") renderDashboard();
  if (sectionId === "agenda") renderCalendar();
  if (sectionId === "rotas") renderTodayRoutes();
  if (sectionId === "driver-view") renderDriverView();
}

function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (section) showSection(section);
    });
  });

  bindClick("menuToggle", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
  });

  bindClick("novaSolicitacaoBtn", openModal);
  bindClick("novaSolicitacaoBtn2", openModal);
  bindClick("closeModal", closeModal);
  bindClick("closeClientModal", () => {
    document.getElementById("clientModal")?.classList.add("hidden");
  });
  bindClick("closeVehicleModal", () => {
    document.getElementById("vehicleModal")?.classList.add("hidden");
  });

  bindClick("shareDriverAppBtn", () => {
    const driverUrl = `${window.location.origin}${window.location.pathname}?mode=driver`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(driverUrl);
      toast("Link do App do Motorista copiado!");
    } else {
      prompt("Copie o link do motorista:", driverUrl);
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "driver") {
    document.body.classList.add("driver-mode");
    showSection("driver-view");
  } else {
    renderDashboard();
  }
});

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}
