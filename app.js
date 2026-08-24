// CONSTANTES E ARMAZENAMENTO
const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";

const DEPOT = {
  lat: -3.305048344119856,
  lng: -39.276497989005755,
  name: "Galpão / Base da Associação Sol Nascente"
};

const MAX_STOPS_PER_VEHICLE = 10;

let materialsChartInstance = null;
let completionChartInstance = null;

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de Solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    latitude: "-3.305048",
    longitude: "-39.276497",
    materials: "Papel, Papelão",
    quantity: "5",
    unit: "Sacos de 100L",
    frequency: "Segunda (Tarde)",
    status: "AGENDADA",
    createdAt: new Date().toISOString()
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

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(requests)); }

// UTILITÁRIOS
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

// TROCA DE ABA SEGURA (SEÇÃO)
function showSection(sectionId) {
  try {
    const sections = document.querySelectorAll(".section");
    sections.forEach(s => s.classList.remove("active-section"));

    const navBtns = document.querySelectorAll(".nav-item");
    navBtns.forEach(b => b.classList.remove("active"));

    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.add("active-section");
    }

    const activeNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNav) {
      activeNav.classList.add("active");
    }

    // Executa renderizadores isolados em Try/Catch para não travar o clique
    if (sectionId === "dashboard") renderDashboard();
    if (sectionId === "agenda") renderCalendar();
    if (sectionId === "rotas") renderTodayRoutes();
    if (sectionId === "driver-view") renderDriverView();
    if (sectionId === "solicitacoes") renderRequests();
    if (sectionId === "veiculos") renderVehicles();
  } catch (err) {
    console.error("Erro ao alternar seção:", err);
  }
}

// DASHBOARD
function renderDashboard() {
  try {
    const total = requests.length;
    const realizadas = requests.filter(r => r.status === "COLETADA" || r.status === "FINALIZADA").length;
    const naoRealizadas = total - realizadas;

    const percentR = total ? Math.round((realizadas / total) * 100) : 0;
    const percentNR = total ? Math.round((naoRealizadas / total) * 100) : 0;

    const elR = document.getElementById("statPercentRealizadas");
    if (elR) elR.textContent = `${percentR}%`;

    const elNR = document.getElementById("statPercentNaoRealizadas");
    if (elNR) elNR.textContent = `${percentNR}%`;

    const elEmRota = document.getElementById("statEmRota");
    if (elEmRota) elEmRota.textContent = requests.filter(r => r.status === "EM ROTA").length;

    const elTotal = document.getElementById("statTotal");
    if (elTotal) elTotal.textContent = total;

    renderCharts(realizadas, naoRealizadas);

    const recent = [...requests].reverse().slice(0, 5);
    const recentList = document.getElementById("recentList");
    if (recentList) recentList.innerHTML = buildTableHTML(recent);
  } catch (e) {
    console.error("Erro ao renderizar dashboard:", e);
  }
}

function renderCharts(realizadas, naoRealizadas) {
  if (typeof Chart === "undefined") return;

  try {
    const ctxMat = document.getElementById("materialsChart")?.getContext("2d");
    if (ctxMat) {
      if (materialsChartInstance) materialsChartInstance.destroy();
      materialsChartInstance = new Chart(ctxMat, {
        type: "doughnut",
        data: {
          labels: ["Papel/Papelão", "Plástico", "Vidro", "Metal"],
          datasets: [{ data: [40, 30, 20, 10], backgroundColor: ["#eb5b2b", "#242a55", "#085157", "#1e7e45"] }]
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
          labels: ["Coletadas", "Não Realizadas"],
          datasets: [{ data: [realizadas, naoRealizadas], backgroundColor: ["#1e7e45", "#eb5b2b"] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  } catch (e) {
    console.error("Erro nos gráficos:", e);
  }
}

function buildTableHTML(data) {
  if (!data.length) return `<div style="padding:20px;text-align:center;">Nenhuma solicitação encontrada.</div>`;
  return `
    <table>
      <thead><tr><th>Código</th><th>Solicitante</th><th>Telefone</th><th>Materiais</th><th>Status</th></tr></thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td><strong>${escapeHTML(r.id)}</strong></td>
            <td>${escapeHTML(r.name)}</td>
            <td>${escapeHTML(r.phone)}</td>
            <td>${escapeHTML(r.materials)} (${r.quantity} ${r.unit})</td>
            <td>${statusBadge(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRequests() {
  const container = document.getElementById("requestsTable");
  if (container) container.innerHTML = buildTableHTML(requests);
}

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
            <td>${v.capacityLiters} L</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCalendar() {
  const container = document.getElementById("calendarContainer");
  if (!container) return;
  const now = new Date();
  container.innerHTML = `
    <div class="calendar-header"><h2>Agenda de Coletas — ${now.toLocaleString("pt-BR", { month: "long" })} / ${now.getFullYear()}</h2></div>
    <div class="calendar-grid">
      <div class="calendar-day-head">Dom</div><div class="calendar-day-head">Seg</div>
      <div class="calendar-day-head">Ter</div><div class="calendar-day-head">Qua</div>
      <div class="calendar-day-head">Qui</div><div class="calendar-day-head">Sex</div>
      <div class="calendar-day-head">Sáb</div>
      ${Array.from({ length: 30 }, (_, i) => `<div class="calendar-cell"><div class="calendar-date-num">${i + 1}</div></div>`).join("")}
    </div>
  `;
}

function renderTodayRoutes() {
  const container = document.getElementById("todayRoutesContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="panel">
      <h2>🚚 Rota Centro - Triciclo 01</h2>
      <p>Limite: 10 paradas no dia</p>
      ${buildTableHTML(requests)}
    </div>
  `;
}

function renderDriverView() {
  const container = document.getElementById("driverRoutesContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="panel">
      <h2>Suas Coletas de Hoje</h2>
      <div style="margin-top:10px;">
        ${requests.map((r, i) => `
          <div style="padding:12px; background:#f5f7fa; border:1px solid #d2d8e0; border-radius:8px; margin-bottom:8px;">
            <strong>#${i + 1} - ${escapeHTML(r.name)}</strong>
            <p>Tel: ${escapeHTML(r.phone)} | ${escapeHTML(r.materials)}</p>
            <button type="button" class="primary-btn" style="margin-top:6px; font-size:12px;" onclick="confirmDriverCollect('${r.id}')">✓ Confirmar Coleta</button>
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
    toast("Coleta confirmada!");
  }
}

function openModal() {
  const modal = document.getElementById("requestModal");
  if (modal) {
    modal.classList.remove("hidden");
    const container = document.getElementById("modalFormContainer");
    if (container) {
      container.innerHTML = `
        <form id="modalForm" class="simplified-form">
          <label>Nome Completo <input name="name" required class="big-input"></label>
          <label>Telefone (WhatsApp) <input name="phone" required class="big-input"></label>
          <label>Dia e Turno
            <select name="frequency" required class="big-select">
              <option value="Segunda (Tarde)">Segunda-feira (Tarde)</option>
              <option value="Terça (Tarde)">Terça-feira (Tarde)</option>
              <option value="Quarta (Tarde)">Quarta-feira (Tarde)</option>
              <option value="Quinta (Noite)">Quinta-feira (Noite)</option>
            </select>
          </label>
          <button type="submit" class="primary-btn">Cadastrar Solicitação</button>
        </form>
      `;

      document.getElementById("modalForm").onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        requests.push({
          id: `SOL-2026-000${requests.length + 1}`,
          name: fd.get("name"),
          phone: fd.get("phone"),
          frequency: fd.get("frequency"),
          materials: "Recicláveis Diversos",
          quantity: "1",
          unit: "Sacos de 100L",
          status: "AGENDADA",
          createdAt: new Date().toISOString()
        });
        saveData();
        closeModal();
        renderDashboard();
        toast("Solicitação cadastrada!");
      };
    }
  }
}

function closeModal() {
  document.getElementById("requestModal")?.classList.add("hidden");
  document.getElementById("vehicleModal")?.classList.add("hidden");
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// EVENT DELEGATION GLOBAL - NUNCA BLOQUEIA CLIQUES
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-section], [data-section-link], .btn-open-modal, #closeModal, #closeVehicleModal, #menuToggle");
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
  }
});

// INICIALIZAÇÃO SEGURA
document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();
});
