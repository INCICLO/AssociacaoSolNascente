const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";
const ROUTES_STORAGE_KEY = "sol_nascente_rotas_v2";

const DEPOT = {
  lat: -3.3752,
  lng: -39.2689,
  name: "Base / Galpão da Associação"
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const ROAD_FACTOR = 1.3;

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de Solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    customLocationName: "",
    latitude: "-3.3752",
    longitude: "-39.2689",
    materials: "Papel, Papelão, Óleo de Cozinha Usado",
    quantity: "5",
    unit: "Sacos de 100L",
    frequency: "Semanal (Sexta-feira)",
    notes: "Coleta no galpão lateral",
    status: "AGENDADA",
    createdAt: new Date().toISOString(),
    createdAtFormatted: getFormattedNow()
  }
];

const defaultVehicles = [
  { id: "VEH-1", name: "Triciclo / Reboque", plate: "TRI-01", capacityLiters: 1000, capacityKg: 500, minVolumeLiters: 0 },
  { id: "VEH-2", name: "Caminhão Baú", plate: "CAM-01", capacityLiters: 10000, capacityKg: 2500, minVolumeLiters: 2000 }
];

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

function saveStorageData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    toast("Aviso: Espaço de armazenamento local cheio ou indisponível.");
  }
}

function save() { saveStorageData(STORAGE_KEY, requests); }
function saveVehicles() { saveStorageData(VEHICLES_STORAGE_KEY, vehicles); }
function saveRoutes() { saveStorageData(ROUTES_STORAGE_KEY, generatedRoutes); }

function getFormattedNow() {
  const now = new Date();
  return `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function nextId() {
  const year = new Date().getFullYear();
  const numbers = requests.map(r => Number((r.id || "").split("-").pop())).filter(Number.isFinite);
  return `SOL-${year}-${(Math.max(0, ...numbers) + 1).toString().padStart(6, "0")}`;
}

function nextRouteId() {
  const year = new Date().getFullYear();
  const numbers = generatedRoutes.map(r => Number((r.id || "").split("-").pop())).filter(Number.isFinite);
  return `ROT-${year}-${(Math.max(0, ...numbers) + 1).toString().padStart(6, "0")}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function statusClass(status = "") {
  return status.replaceAll(" ", "-").replaceAll("Á", "A").replaceAll("É", "E").replaceAll("Í", "I").replaceAll("Ó", "O").replaceAll("Ú", "U").toLowerCase();
}

function statusBadge(status) {
  return `<span class="status status-${statusClass(escapeHTML(status))}">${escapeHTML(status)}</span>`;
}

function formatDateBR(date) { return date.toLocaleDateString("pt-BR"); }

function dateToISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * ROAD_FACTOR;
}

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) targetSection.classList.add("active-section");

  const navBtn = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navBtn) navBtn.classList.add("active");

  document.getElementById("sidebar")?.classList.remove("open");

  if (sectionId === "dashboard") renderDashboard();
  if (sectionId === "solicitacoes") renderRequests();
  if (sectionId === "coletas") renderCollections();
  if (sectionId === "veiculos") renderVehicles();
  if (sectionId === "rotas") renderRoutes();
  if (sectionId === "clientes") renderClients();
  if (sectionId === "driver-view") renderDriverView();
}

function checkSpecialURL() {
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

  document.body.classList.remove("public-mode");
  document.body.classList.remove("driver-mode");
  return false;
}

function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">
      <div class="form-group-block">
        <span class="form-block-title">1. Dados do Solicitante</span>
        <label class="form-label">Nome Completo *
          <input name="name" required placeholder="Digite seu nome completo" class="big-input">
        </label>
        <label class="form-label">Telefone de Contato (WhatsApp) *
          <input name="phone" required inputmode="numeric" maxlength="15" placeholder="(88) 99999-9999" class="big-input phone-mask">
        </label>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">2. Tipo de Localidade</span>
        <label class="form-label">Selecione o tipo de local *
          <select name="type" required class="big-select type-select">
            <option value="Residência">Residência</option>
            <option value="Estabelecimento">Estabelecimento Comercial / Empresa</option>
            <option value="Evento">Evento Público ou Privado</option>
            <option value="Condomínio">Condomínio Residencial / Comercial</option>
            <option value="Outro">Outro</option>
          </select>
        </label>
        <div class="custom-location-wrap hidden">
          <label class="form-label">Nome do Estabelecimento / Evento *
            <input name="customLocationName" placeholder="Informe o nome" class="big-input">
          </label>
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">3. Localização Exata</span>
        <button type="button" class="geo-btn">Usar minha localização atual</button>
        <div class="map-container" id="map-${formId}"></div>
        <div class="coords-display">
          <span class="coords-text">Nenhum ponto marcado no mapa</span>
          <input type="hidden" name="latitude" required>
          <input type="hidden" name="longitude" required>
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">4. Resíduos para Coleta</span>
        <div class="materials-grid">
          <label class="material-card"><input type="checkbox" name="materials_list" value="Papel"><span class="card-content"><span class="card-icon">📄</span><span class="card-text">Papel</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Papelão"><span class="card-content"><span class="card-icon">📦</span><span class="card-text">Papelão</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Vidro"><span class="card-content"><span class="card-icon">🍾</span><span class="card-text">Vidro</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Metal"><span class="card-content"><span class="card-icon">🥫</span><span class="card-text">Metal</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Plástico"><span class="card-content"><span class="card-icon">🥤</span><span class="card-text">Plástico</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Eletrônicos"><span class="card-content"><span class="card-icon">💻</span><span class="card-text">Eletrônicos</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" value="Óleo de Cozinha Usado"><span class="card-content"><span class="card-icon">🛢️</span><span class="card-text">Óleo Usado</span></span></label>
          <label class="material-card"><input type="checkbox" name="materials_list" id="otherMaterialCheckbox" value="Outros"><span class="card-content"><span class="card-icon">♻️</span><span class="card-text">Outros</span></span></label>
        </div>
        <div id="otherMaterialWrap" class="hidden" style="margin-top:12px;">
          <label class="form-label">Especificar Resíduo *
            <input name="otherMaterialText" id="otherMaterialText" placeholder="Ex: Baterias..." class="big-input">
          </label>
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">5. Quantidade Estimada</span>
        <div style="display:flex; gap:10px;">
          <input name="quantity" type="number" step="0.1" min="1" required placeholder="Quantidade" class="big-input">
          <select name="unit" required class="big-select">
            <option value="Sacos de 100L">Sacos de 100L</option>
            <option value="Kg">Kg</option>
            <option value="BigBags">BigBags</option>
            <option value="Caixas">Caixas</option>
          </select>
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">6. Frequência</span>
        <select name="frequency" id="frequencySelect" required class="big-select">
          <option value="">Selecione...</option>
          <option value="Única">Única</option>
          <option value="Diária">Diária</option>
          <option value="Semanal">Semanal</option>
        </select>
        <div id="singleDateWrap" class="hidden" style="margin-top:10px;">
          <input type="date" name="preferred_date" id="preferredDateInput" class="big-input">
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">7. Observações</span>
        <textarea name="notes" rows="3" placeholder="Informações adicionais..." class="big-textarea"></textarea>
      </div>

      <button class="primary-btn submit-btn" type="submit">SUBMETER SOLICITAÇÃO</button>
    </form>
  `;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function initFormEvents(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const phoneInput = form.querySelector(".phone-mask");
  if (phoneInput) {
    phoneInput.addEventListener("input", e => { e.target.value = formatPhone(e.target.value); });
  }

  const typeSelect = form.querySelector(".type-select");
  const customWrap = form.querySelector(".custom-location-wrap");
  if (typeSelect && customWrap) {
    typeSelect.addEventListener("change", () => {
      customWrap.classList.toggle("hidden", typeSelect.value === "Residência");
    });
  }

  const otherCheckbox = form.querySelector("#otherMaterialCheckbox");
  const otherWrap = form.querySelector("#otherMaterialWrap");
  if (otherCheckbox && otherWrap) {
    otherCheckbox.addEventListener("change", () => {
      otherWrap.classList.toggle("hidden", !otherCheckbox.checked);
    });
  }

  const frequencySelect = form.querySelector("#frequencySelect");
  const singleDateWrap = form.querySelector("#singleDateWrap");
  if (frequencySelect && singleDateWrap) {
    frequencySelect.addEventListener("change", () => {
      singleDateWrap.classList.toggle("hidden", frequencySelect.value !== "Única");
    });
  }

  initMap(formId);

  form.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!data.latitude || !data.longitude) {
      toast("Confirme o ponto exato da coleta no mapa.");
      return;
    }

    let checkedMaterials = [...form.querySelectorAll('input[name="materials_list"]:checked')].map(c => c.value);
    if (checkedMaterials.length === 0) {
      toast("Selecione ao menos um material.");
      return;
    }

    const request = {
      id: nextId(),
      name: data.name,
      phone: data.phone,
      type: data.type,
      customLocationName: data.type !== "Residência" ? data.customLocationName : "",
      latitude: data.latitude,
      longitude: data.longitude,
      materials: checkedMaterials.join(", "),
      quantity: data.quantity,
      unit: data.unit,
      frequency: data.frequency,
      notes: data.notes || "",
      status: "NOVA",
      createdAt: new Date().toISOString(),
      createdAtFormatted: getFormattedNow()
    };

    requests.push(request);
    save();

    if (document.body.classList.contains("public-mode")) {
      form.innerHTML = `<h2>Solicitação Registrada!</h2><p>Número: <strong>${request.id}</strong></p>`;
    } else {
      closeModal();
      renderDashboard();
      renderRequests();
      toast(`Solicitação ${request.id} registrada.`);
    }
  });
}

function initMap(formId) {
  const mapElement = document.getElementById(`map-${formId}`);
  if (!mapElement) return;

  setTimeout(() => {
    if (typeof L === "undefined") return;

    const map = L.map(mapElement).setView([DEPOT.lat, DEPOT.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    let marker = null;
    const form = document.getElementById(formId);
    const coordsText = form.querySelector(".coords-text");
    const latInput = form.querySelector('input[name="latitude"]');
    const lngInput = form.querySelector('input[name="longitude"]');

    map.on("click", e => {
      if (marker) map.removeLayer(marker);
      marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
      latInput.value = e.latlng.lat.toFixed(6);
      lngInput.value = e.latlng.lng.toFixed(6);
      coordsText.textContent = `Lat: ${e.latlng.lat.toFixed(5)} | Lng: ${e.latlng.lng.toFixed(5)}`;
    });

    const geoBtn = form.querySelector(".geo-btn");
    if (geoBtn) {
      geoBtn.addEventListener("click", () => {
        navigator.geolocation?.getCurrentPosition(pos => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 17);
          if (marker) map.removeLayer(marker);
          marker = L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(map);
          latInput.value = pos.coords.latitude.toFixed(6);
          lngInput.value = pos.coords.longitude.toFixed(6);
          coordsText.textContent = `Lat: ${pos.coords.latitude.toFixed(5)} | Lng: ${pos.coords.longitude.toFixed(5)}`;
        });
      });
    }
  }, 200);
}

function renderCollections() {
  const container = document.getElementById("collectionsContainer");
  if (!container) return;
  container.innerHTML = `<div class="panel"><h2>Gestão de Coletas</h2><p>Total de solicitações: ${requests.length}</p></div>`;
}

function openModal() {
  const container = document.getElementById("modalFormContainer");
  container.innerHTML = buildFormHTML("modalForm");
  initFormEvents("modalForm");
  document.getElementById("requestModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("requestModal").classList.add("hidden");
  document.getElementById("modalFormContainer").innerHTML = "";
}

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); }, 3500);
}

function renderDashboard() {
  const count = s => requests.filter(r => r.status === s).length;
  if (document.getElementById("statNovas")) document.getElementById("statNovas").textContent = count("NOVA");
  if (document.getElementById("statAgendadas")) document.getElementById("statAgendadas").textContent = count("AGENDADA");
  if (document.getElementById("statEmRota")) document.getElementById("statEmRota").textContent = count("EM ROTA");
  if (document.getElementById("statFinalizadas")) document.getElementById("statFinalizadas").textContent = count("FINALIZADA") + count("COLETADA");

  const recentList = document.getElementById("recentList");
  if (recentList) recentList.innerHTML = tableHTML(requests.slice(0, 6), false);
}

function tableHTML(data, withActions = true) {
  if (!data.length) return `<div class="empty-state"><h2>Nenhuma solicitação cadastrada</h2></div>`;
  return `
    <table>
      <thead>
        <tr><th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td><strong>${escapeHTML(r.id)}</strong></td>
            <td>${escapeHTML(r.name)}</td>
            <td>${escapeHTML(r.type)}</td>
            <td>${escapeHTML(r.materials)}</td>
            <td>${statusBadge(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRequests() {
  const table = document.getElementById("requestsTable");
  if (table) table.innerHTML = tableHTML(requests, true);
}

function renderVehicles() {
  const container = document.getElementById("vehiclesList");
  if (container) container.innerHTML = `<p>Veículos cadastrados: ${vehicles.length}</p>`;
}

function renderRoutes() {
  const container = document.getElementById("routesByVehicleContainer");
  if (container) container.innerHTML = `<p>Sistemas de rotas pronto.</p>`;
}

function renderDriverView() {
  const container = document.getElementById("driverRoutesContainer");
  if (container) container.innerHTML = `<p>Nenhuma rota designada no momento.</p>`;
}

function renderClients() {
  const container = document.getElementById("clientsList");
  if (container) container.innerHTML = `<p>Total de Clientes: ${requests.length}</p>`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("novaSolicitacaoBtn")?.addEventListener("click", openModal);
  document.getElementById("novaSolicitacaoBtn2")?.addEventListener("click", openModal);
  document.getElementById("closeModal")?.addEventListener("click", closeModal);

  if (!checkSpecialURL()) {
    renderDashboard();
  }
});
