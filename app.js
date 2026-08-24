const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";
const ROUTES_STORAGE_KEY = "sol_nascente_rotas_v2";

// ============================================================
// CONFIGURAÇÕES GERAIS
// ============================================================

const DEPOT = {
  lat: -3.3752,
  lng: -39.2689,
  name: "Base / Galpão da Associação"
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const ROAD_FACTOR = 1.3;
const searchCache = new Map();

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
  {
    id: "VEH-1",
    name: "Triciclo / Reboque",
    plate: "TRI-01",
    capacityLiters: 1000,
    capacityKg: 500,
    minVolumeLiters: 0
  },
  {
    id: "VEH-2",
    name: "Caminhão Baú",
    plate: "CAM-01",
    capacityLiters: 10000,
    capacityKg: 2500,
    minVolumeLiters: 2000
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
    console.error(`Erro ao carregar do localStorage [${key}]:`, e);
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
    console.error(`Erro ao salvar no localStorage [${key}]:`, e);
    toast("Aviso: Espaço de armazenamento local cheio ou indisponível.");
  }
}

function save() { saveStorageData(STORAGE_KEY, requests); }
function saveVehicles() { saveStorageData(VEHICLES_STORAGE_KEY, vehicles); }
function saveRoutes() { saveStorageData(ROUTES_STORAGE_KEY, generatedRoutes); }

// ============================================================
// BACKUP E EXPORTAÇÃO / IMPORTAÇÃO DE DADOS
// ============================================================

function exportData() {
  const exportObject = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    requests,
    vehicles,
    generatedRoutes
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sol_nascente_backup_${dateToISO(new Date())}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  toast("Backup exportado com sucesso!");
}

function importData(jsonFile) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.requests && imported.vehicles) {
        requests = imported.requests;
        vehicles = imported.vehicles;
        generatedRoutes = imported.generatedRoutes || [];

        save();
        saveVehicles();
        saveRoutes();

        renderDashboard();
        renderRequests();
        renderCollections();
        toast("Dados importados com sucesso!");
      } else {
        throw new Error("Estrutura de arquivo inválida.");
      }
    } catch (err) {
      alert("Falha ao importar o arquivo. Verifique se o JSON é válido.");
    }
  };
  reader.readAsText(jsonFile);
}

// ============================================================
// UTILITÁRIOS E FORMATADORES
// ============================================================

function getFormattedNow() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} às ${timeStr}`;
}

function nextId() {
  const year = new Date().getFullYear();
  const numbers = requests
    .map(r => Number((r.id || "").split("-").pop()))
    .filter(Number.isFinite);

  const next = (Math.max(0, ...numbers) + 1).toString().padStart(6, "0");
  return `SOL-${year}-${next}`;
}

function nextRouteId() {
  const year = new Date().getFullYear();
  const numbers = generatedRoutes
    .map(r => Number((r.id || "").split("-").pop()))
    .filter(Number.isFinite);

  const next = (Math.max(0, ...numbers) + 1).toString().padStart(6, "0");
  return `ROT-${year}-${next}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function statusClass(status = "") {
  return status
    .replaceAll(" ", "-")
    .replaceAll("Á", "A").replaceAll("É", "E").replaceAll("Í", "I").replaceAll("Ó", "O").replaceAll("Ú", "U")
    .toLowerCase();
}

function statusBadge(status) {
  return `<span class="status status-${statusClass(escapeHTML(status))}">${escapeHTML(status)}</span>`;
}

function formatDateBR(date) { return date.toLocaleDateString("pt-BR"); }

function dateToISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;

  const haversineDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return haversineDist * ROAD_FACTOR;
}

// ============================================================
// NAVEGAÇÃO E MODOS ESPECIAIS (URL)
// ============================================================

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

// ============================================================
// ESTRUTURA COMPLETA DO FORMULÁRIO (INCLUINDO ÓLEO DE COZINHA)
// ============================================================

function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">
      <!-- 1 -->
      <div class="form-group-block">
        <span class="form-block-title">1. Dados do Solicitante</span>
        <label class="form-label">
          Nome Completo *
          <input name="name" required maxlength="100" placeholder="Digite seu nome completo" class="big-input">
        </label>
        <label class="form-label">
          Telefone de Contato (WhatsApp) *
          <input name="phone" required inputmode="numeric" maxlength="15" placeholder="(88) 99999-9999" class="big-input phone-mask">
        </label>
      </div>

      <!-- 2 -->
      <div class="form-group-block">
        <span class="form-block-title">2. Tipo de Localidade</span>
        <label class="form-label">
          Selecione o tipo de local para a coleta *
          <select name="type" required class="big-select type-select">
            <option value="Residência">Residência</option>
            <option value="Estabelecimento">Estabelecimento Comercial / Empresa</option>
            <option value="Evento">Evento Público ou Privado</option>
            <option value="Condomínio">Condomínio Residencial / Comercial</option>
            <option value="Outro">Outro</option>
          </select>
        </label>
        <div class="custom-location-wrap hidden">
          <label class="form-label">
            Nome do Estabelecimento / Local / Evento *
            <input name="customLocationName" placeholder="Informe o nome da empresa ou local" class="big-input">
          </label>
        </div>
      </div>

      <!-- 3 -->
      <div class="form-group-block">
        <span class="form-block-title">3. Localização Exata</span>
        <label class="form-label">Encontre seu endereço no mapa</label>
        <div class="address-search-wrap" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <input type="text" class="big-input address-search-input" placeholder="Digite seu endereço, rua, bairro ou cidade..." style="flex:1;min-width:220px;" autocomplete="street-address">
          <button type="button" class="secondary-btn address-search-btn">🔍 Pesquisar</button>
        </div>
        <div class="address-search-results" style="margin-bottom:10px;"></div>
        <p class="map-instruction">
          Você pode pesquisar seu endereço acima, selecionar um resultado e confirmar.
          Também pode clicar diretamente no mapa.
        </p>
        <button type="button" class="geo-btn">Usar minha localização atual</button>
        <div class="map-container" id="map-${formId}"></div>
        <div class="selected-address-box" style="margin-top:12px;padding:12px;border-radius:8px;background:#f5f5f5;display:none;">
          <strong>📍 Endereço selecionado</strong>
          <div class="selected-address-text" style="margin-top:6px;"></div>
          <button type="button" class="primary-btn confirm-address-btn" style="margin-top:10px;">✓ CONFIRMAR ESTE ENDEREÇO</button>
        </div>
        <div class="coords-display">
          <span>Coordenadas Geográficas:</span>
          <strong class="coords-text">Nenhum ponto confirmado</strong>
          <input type="hidden" name="latitude" required>
          <input type="hidden" name="longitude" required>
        </div>
      </div>

      <!-- 4 -->
      <div class="form-group-block">
        <span class="form-block-title">4. Resíduos para Coleta</span>
        <label class="form-label">Selecione os tipos de materiais recicláveis disponíveis *</label>
        <div class="materials-grid">
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Papel"> Papel</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Papelão"> Papelão</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Vidro"> Vidro</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Metal"> Metal / Latas</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Plástico"> Plástico / PET</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Eletrônicos"> Eletrônicos</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Óleo de Cozinha Usado"> Óleo de Cozinha Usado</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" id="otherMaterialCheckbox" value="Outros"> Outros</label>
        </div>
        <div id="otherMaterialWrap" class="hidden" style="margin-top:12px;">
          <label class="form-label">
            Qual resíduo? Especificar: *
            <input name="otherMaterialText" id="otherMaterialText" placeholder="Ex: Baterias, Sucata de Alumínio..." class="big-input">
          </label>
        </div>
      </div>

      <!-- 5 -->
      <div class="form-group-block row-group">
        <label class="form-label flex-1">
          Quantidade Estimada *
          <input name="quantity" type="number" step="0.1" min="1" required placeholder="Ex: 50" class="big-input">
        </label>
        <label class="form-label flex-1">
          Unidade de Medida *
          <select name="unit" required class="big-select">
            <option value="Kg">Kg (Quilogramas)</option>
            <option value="Sacos de 100L">Sacos de 100 Litros</option>
            <option value="Litros">Litros (Para Óleo/Líquidos)</option>
            <option value="BigBags">BigBags</option>
            <option value="Caixas">Caixas</option>
            <option value="Bombonas">Bombonas</option>
          </select>
        </label>
      </div>

      <!-- 6 -->
      <div class="form-group-block">
        <span class="form-block-title">6. Frequência e Agendamento da Coleta</span>
        <label class="form-label">
          Com que frequência a coleta deve acontecer? *
          <select name="frequency" id="frequencySelect" required class="big-select">
            <option value="">Selecione a periodicidade...</option>
            <option value="Única">Coleta Pontual (Uma única vez)</option>
            <option value="Diária">Uma vez por dia (Diária)</option>
            <option value="Semanal">Uma vez por semana</option>
            <option value="Quinzenal">Uma vez a cada 15 dias (Quinzenal)</option>
            <option value="Mensal">Uma vez no mês (Mensal)</option>
          </select>
        </label>

        <div id="singleDateWrap" class="hidden frequency-subwrap">
          <label class="form-label">
            Data Preferencial para Coleta *
            <input type="date" name="preferred_date" id="preferredDateInput" class="big-input">
          </label>
        </div>

        <div id="weeklyDaysWrap" class="hidden frequency-subwrap">
          <label class="form-label">Dia(s) preferencial(is) da semana para coleta *</label>
          <div class="days-grid">
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Segunda-feira"> Seg</label>
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Terça-feira"> Ter</label>
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Quarta-feira"> Quar</label>
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Quinta-feira"> Quin</label>
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Sexta-feira"> Sex</label>
            <label class="day-checkbox"><input type="checkbox" name="preferred_days" value="Sábado"> Sáb</label>
          </div>
        </div>

        <div id="monthlyWrap" class="hidden frequency-subwrap row-group">
          <label class="form-label flex-1">
            Qual semana do mês? *
            <select name="monthly_week" id="monthlyWeekSelect" class="big-select">
              <option value="1ª Semana">1ª Semana do mês</option>
              <option value="2ª Semana">2ª Semana do mês</option>
              <option value="3ª Semana">3ª Semana do mês</option>
              <option value="4ª Semana">4ª Semana do mês</option>
            </select>
          </label>
          <label class="form-label flex-1">
            Em qual dia da semana? *
            <select name="monthly_day" id="monthlyDaySelect" class="big-select">
              <option value="Segunda-feira">Segunda-feira</option>
              <option value="Terça-feira">Terça-feira</option>
              <option value="Quarta-feira">Quarta-feira</option>
              <option value="Quinta-feira">Quinta-feira</option>
              <option value="Sexta-feira">Sexta-feira</option>
              <option value="Sábado">Sábado</option>
            </select>
          </label>
        </div>
      </div>

      <!-- 7 -->
      <div class="form-group-block">
        <span class="form-block-title">7. Observações e Referências</span>
        <label class="form-label">
          Ponto de Referência ou Informações Adicionais (Opcional)
          <textarea name="notes" rows="3" placeholder="Exemplo: Material armazenado ao lado da entrada secundária." class="big-textarea"></textarea>
        </label>
      </div>

      <button class="primary-btn submit-btn" type="submit">SUBMETER SOLICITAÇÃO DE COLETA</button>
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
    phoneInput.addEventListener("input", e => {
      e.target.value = formatPhone(e.target.value);
    });
  }

  const typeSelect = form.querySelector(".type-select");
  const customWrap = form.querySelector(".custom-location-wrap");
  const customInput = customWrap ? customWrap.querySelector("input") : null;

  if (typeSelect && customWrap) {
    typeSelect.addEventListener("change", () => {
      if (typeSelect.value && typeSelect.value !== "Residência") {
        customWrap.classList.remove("hidden");
        if (customInput) customInput.required = true;
      } else {
        customWrap.classList.add("hidden");
        if (customInput) {
          customInput.required = false;
          customInput.value = "";
        }
      }
    });
  }

  const otherCheckbox = form.querySelector("#otherMaterialCheckbox");
  const otherWrap = form.querySelector("#otherMaterialWrap");
  const otherInput = form.querySelector("#otherMaterialText");

  if (otherCheckbox && otherWrap) {
    otherCheckbox.addEventListener("change", () => {
      if (otherCheckbox.checked) {
        otherWrap.classList.remove("hidden");
        if (otherInput) otherInput.required = true;
      } else {
        otherWrap.classList.add("hidden");
        if (otherInput) {
          otherInput.required = false;
          otherInput.value = "";
        }
      }
    });
  }

  const frequencySelect = form.querySelector("#frequencySelect");
  const singleDateWrap = form.querySelector("#singleDateWrap");
  const weeklyDaysWrap = form.querySelector("#weeklyDaysWrap");
  const monthlyWrap = form.querySelector("#monthlyWrap");
  const preferredDateInput = form.querySelector("#preferredDateInput");

  if (frequencySelect) {
    if (preferredDateInput) preferredDateInput.min = dateToISO(new Date());

    frequencySelect.addEventListener("change", () => {
      const val = frequencySelect.value;
      singleDateWrap?.classList.add("hidden");
      weeklyDaysWrap?.classList.add("hidden");
      monthlyWrap?.classList.add("hidden");

      if (preferredDateInput) preferredDateInput.required = false;

      if (val === "Única") {
        singleDateWrap?.classList.remove("hidden");
        if (preferredDateInput) preferredDateInput.required = true;
      } else if (val === "Semanal" || val === "Quinzenal") {
        weeklyDaysWrap?.classList.remove("hidden");
      } else if (val === "Mensal") {
        monthlyWrap?.classList.remove("hidden");
      }
    });
  }

  initMap(formId);

  form.addEventListener("submit", e => {
    e.preventDefault();

    const lat = form.querySelector('input[name="latitude"]').value;
    const lng = form.querySelector('input[name="longitude"]').value;

    if (!lat || !lng) {
      toast("Confirme o ponto exato da coleta no mapa.");
      return;
    }

    let checkedMaterials = [
      ...form.querySelectorAll('input[name="materials_list"]:checked')
    ].map(c => c.value);

    if (checkedMaterials.length === 0) {
      toast("Selecione ao menos um tipo de material para agendar a coleta.");
      return;
    }

    if (otherCheckbox && otherCheckbox.checked && otherInput && otherInput.value.trim() !== "") {
      checkedMaterials = checkedMaterials.map(m =>
        m === "Outros" ? `Outros (${otherInput.value.trim()})` : m
      );
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const freqVal = data.frequency;
    let frequencyText = freqVal;

    if (freqVal === "Única") {
      if (!data.preferred_date) {
        toast("Selecione a data preferencial para a coleta.");
        return;
      }
      const formattedDate = data.preferred_date.split("-").reverse().join("/");
      frequencyText = `Única (${formattedDate})`;
    } else if (freqVal === "Semanal" || freqVal === "Quinzenal") {
      const selectedDays = [
        ...form.querySelectorAll('input[name="preferred_days"]:checked')
      ].map(d => d.value);

      if (selectedDays.length === 0) {
        toast("Selecione ao menos um dia da semana.");
        return;
      }
      frequencyText = `${freqVal} (${selectedDays.join(", ")})`;
    } else if (freqVal === "Mensal") {
      frequencyText = `Mensal (${data.monthly_week} - ${data.monthly_day})`;
    }

    const nowFormatted = getFormattedNow();

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
      frequency: frequencyText,
      notes: data.notes || "",
      status: "NOVA",
      createdAt: new Date().toISOString(),
      createdAtFormatted: nowFormatted
    };

    requests.push(request);
    save();

    if (document.body.classList.contains("public-mode")) {
      form.innerHTML = `
        <div class="success-screen">
          <h2>Solicitação Registrada com Sucesso</h2>
          <p>O seu pedido foi protocolado sob o número: <strong>${escapeHTML(request.id)}</strong></p>
          <p><small>Registrado em: ${escapeHTML(nowFormatted)}</small></p>
          <p>A equipe da <strong>Associação Sol Nascente</strong> em parceria com a <strong>Inciclo</strong> e <strong>Recicle+ Trairi</strong> analisará a solicitação.</p>
          <button class="primary-btn" type="button" onclick="window.location.reload()">Registrar Nova Solicitação</button>
        </div>
      `;
    } else {
      closeModal();
      renderDashboard();
      renderRequests();
      renderCollections();
      toast(`Solicitação ${request.id} registrada com sucesso.`);
    }
  });
}

// ============================================================
// MAPA + PESQUISA DE ENDEREÇOS OTIMIZADA
// ============================================================

function initMap(formId) {
  const mapElement = document.getElementById(`map-${formId}`);
  if (!mapElement) return;

  const defaultLat = DEPOT.lat;
  const defaultLng = DEPOT.lng;

  setTimeout(() => {
    if (typeof L === "undefined") {
      console.error("A biblioteca Leaflet.js não foi carregada.");
      return;
    }

    const map = L.map(mapElement).setView([defaultLat, defaultLng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    map.invalidateSize();

    let marker = null;
    let pendingLocation = null;

    const form = document.getElementById(formId);
    const coordsText = form.querySelector(".coords-text");
    const latInput = form.querySelector('input[name="latitude"]');
    const lngInput = form.querySelector('input[name="longitude"]');
    const addressInput = form.querySelector(".address-search-input");
    const searchButton = form.querySelector(".address-search-btn");
    const resultsContainer = form.querySelector(".address-search-results");
    const selectedAddressBox = form.querySelector(".selected-address-box");
    const selectedAddressText = form.querySelector(".selected-address-text");
    const confirmButton = form.querySelector(".confirm-address-btn");

    function setMarker(lat, lng, addressText = "") {
      if (marker) map.removeLayer(marker);

      marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(addressText || "Ponto de coleta selecionado").openPopup();
      map.setView([lat, lng], 17);

      pendingLocation = { lat: Number(lat), lng: Number(lng), address: addressText || "" };

      if (selectedAddressBox) selectedAddressBox.style.display = "block";
      if (selectedAddressText) {
        selectedAddressText.textContent = addressText || `Lat: ${Number(lat).toFixed(6)} | Lng: ${Number(lng).toFixed(6)}`;
      }
      if (coordsText) coordsText.textContent = "Ponto selecionado — clique em confirmar";

      if (latInput) latInput.value = "";
      if (lngInput) lngInput.value = "";
    }

    function confirmLocation() {
      if (!pendingLocation) {
        toast("Primeiro selecione um ponto no mapa.");
        return;
      }

      latInput.value = Number(pendingLocation.lat).toFixed(6);
      lngInput.value = Number(pendingLocation.lng).toFixed(6);

      coordsText.textContent = `Latitude: ${Number(pendingLocation.lat).toFixed(5)} | Longitude: ${Number(pendingLocation.lng).toFixed(5)}`;

      if (selectedAddressText) {
        selectedAddressText.innerHTML = `
          <strong style="color:green;">✓ Localização confirmada!</strong><br>
          ${escapeHTML(pendingLocation.address || "Ponto selecionado manualmente no mapa.")}
        `;
      }

      toast("Endereço confirmado com sucesso.");
    }

    map.on("click", e => {
      setMarker(e.latlng.lat, e.latlng.lng, "Ponto marcado no mapa");
    });

    const geoBtn = form.querySelector(".geo-btn");
    if (geoBtn) {
      geoBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          toast("A geolocalização não é suportada neste navegador.");
          return;
        }

        geoBtn.textContent = "Obtendo coordenadas...";

        navigator.geolocation.getCurrentPosition(
          pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 17);
            setMarker(lat, lng, "Minha Localização Atual");
            geoBtn.textContent = "Usar minha localização atual";
          },
          () => {
            toast("Não foi possível obter sua localização. Marque manualmente no mapa.");
            geoBtn.textContent = "Usar minha localização atual";
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // PESQUISAR ENDEREÇOS (COM BUSCA ABRANGENTE E SUPORTE LOCAL)
    async function searchAddress() {
      const query = addressInput.value.trim();
      if (!query) {
        toast("Digite um endereço para pesquisar.");
        return;
      }

      searchButton.disabled = true;
      searchButton.textContent = "Pesquisando...";
      resultsContainer.innerHTML = `<div style="padding:10px;color:var(--muted);">🔎 Procurando endereço no mapa...</div>`;

      try {
        let searchQuery = query;
        if (!query.toLowerCase().includes("ceará") && !query.toLowerCase().includes("ce")) {
          searchQuery += ", Trairi, Ceará, Brasil";
        }

        const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url, { headers: { "Accept": "application/json" } });

        if (!response.ok) throw new Error("Erro na requisição.");

        const results = await response.json();

        if (!results.length) {
          // Tenta novamente sem o sufixo restritivo caso não ache nada
          const fallbackUrl = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`;
          const fallbackResp = await fetch(fallbackUrl);
          const fallbackResults = await fallbackResp.json();
          renderSearchResults(fallbackResults);
        } else {
          renderSearchResults(results);
        }

      } catch (error) {
        console.error("Erro na busca de endereço:", error);
        resultsContainer.innerHTML = `
          <div style="padding:10px;border-radius:8px;background:#f8d7da;color:#721c24;">
            Não foi possível pesquisar o endereço agora. Você pode marcar o ponto diretamente no mapa.
          </div>
        `;
      } finally {
        searchButton.disabled = false;
        searchButton.textContent = "🔍 Pesquisar";
      }
    }

    function renderSearchResults(results) {
      if (!results || !results.length) {
        resultsContainer.innerHTML = `
          <div style="padding:10px;border-radius:8px;background:#fff3cd;color:#856404;">
            Nenhum endereço encontrado. Verifique o nome da rua ou marque diretamente no mapa.
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = results.map((result, index) => `
        <button type="button" class="address-result-item" data-index="${index}" style="display:block;width:100%;text-align:left;padding:10px;margin-bottom:6px;border:1px solid #ddd;border-radius:8px;background:white;cursor:pointer;">
          📍 ${escapeHTML(result.display_name)}
        </button>
      `).join("");

      results.forEach((result, index) => {
        const button = resultsContainer.querySelector(`[data-index="${index}"]`);
        button?.addEventListener("click", () => {
          const lat = Number(result.lat);
          const lng = Number(result.lon);
          setMarker(lat, lng, result.display_name);

          resultsContainer.innerHTML = `
            <div style="padding:10px;background:#eef8ee;color:#155724;border-radius:8px;">
              ✓ Endereço localizado! Confira no mapa e confirme abaixo.
            </div>
          `;
        });
      });
    }

    searchButton?.addEventListener("click", searchAddress);
    addressInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchAddress();
      }
    });

    confirmButton?.addEventListener("click", confirmLocation);
  }, 200);
}

// ============================================================
// ABA DE COLETAS - HISTÓRICO E REAGENDAMENTO AUTOMÁTICO
// ============================================================

function renderCollections() {
  const container = document.getElementById("collectionsContainer");
  if (!container) return;

  const coletadas = requests.filter(r => r.status === "COLETADA" || r.status === "FINALIZADA");
  const naoFeitas = requests.filter(r => r.status === "NOVA" || r.status === "EM ANÁLISE" || r.status === "CANCELADA");

  container.innerHTML = `
    <div class="panel" style="margin-bottom:20px;">
      <div class="panel-heading">
        <div>
          <h2>📊 Resumo Operacional das Coletas</h2>
          <p>Acompanhamento de solicitações concluídas e pendentes/não realizadas.</p>
        </div>
      </div>
      <div class="cards" style="margin-bottom:0;">
        <article class="stat-card">
          <span>Coletas Concluídas</span>
          <strong style="color:var(--success);">${coletadas.length}</strong>
          <small>Recolhidas com sucesso</small>
        </article>
        <article class="stat-card">
          <span>Não Realizadas / Pendentes</span>
          <strong style="color:var(--orange-dark);">${naoFeitas.length}</strong>
          <small>Aguardando reagendamento</small>
        </article>
      </div>
    </div>

    <!-- PAINEL DE COLETAS NÃO REALIZADAS -->
    <div class="panel" style="margin-bottom:20px;">
      <div class="panel-heading">
        <h2>⚠️ Coletas Não Realizadas / Pendentes (${naoFeitas.length})</h2>
      </div>
      ${naoFeitas.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Solicitante</th>
                <th>Frequência Atual</th>
                <th>Materiais</th>
                <th>Status</th>
                <th>Ação para Próxima Coleta</th>
              </tr>
            </thead>
            <tbody>
              ${naoFeitas.map(r => `
                <tr>
                  <td><strong>${escapeHTML(r.id)}</strong></td>
                  <td><strong>${escapeHTML(r.name)}</strong><br><small>Tel: ${escapeHTML(r.phone)}</small></td>
                  <td><small>${escapeHTML(r.frequency)}</small></td>
                  <td>${escapeHTML(r.materials)}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td>
                    <button type="button" class="primary-btn" style="font-size:12px; padding:6px 12px;" onclick="rescheduleToNextDate('${r.id}')">
                      🔄 Reagendar para o Próximo Dia
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p style="padding:10px; color:var(--muted);">Todas as coletas estão em dia!</p>`}
    </div>

    <!-- PAINEL DE HISTÓRICO DE COLETAS REALIZADAS -->
    <div class="panel">
      <div class="panel-heading">
        <h2>✅ Histórico de Coletas Concluídas (${coletadas.length})</h2>
      </div>
      ${coletadas.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Solicitante</th>
                <th>Data do Cadastro</th>
                <th>Materiais Coletados</th>
                <th>Carga</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${coletadas.map(r => `
                <tr>
                  <td><strong>${escapeHTML(r.id)}</strong></td>
                  <td><strong>${escapeHTML(r.name)}</strong><br><small>Tel: ${escapeHTML(r.phone)}</small></td>
                  <td><small>🕒 ${escapeHTML(r.createdAtFormatted || "Data não informada")}</small></td>
                  <td>${escapeHTML(r.materials)}</td>
                  <td>${escapeHTML(r.quantity)} ${escapeHTML(r.unit)}</td>
                  <td>${statusBadge(r.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p style="padding:10px; color:var(--muted);">Nenhuma coleta concluída registrada até o momento.</p>`}
    </div>
  `;
}

// LÓGICA DE REAGENDAMENTO AUTOMÁTICO
function rescheduleToNextDate(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;

  req.status = "AGENDADA";
  save();
  renderCollections();
  renderDashboard();
  toast(`Solicitação ${id} reagendada para a próxima rota com sucesso!`);
}

// ============================================================
// MODAIS, LINKS E TOAST
// ============================================================

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

function copyPublicLink() {
  const publicURL = `${window.location.origin}${window.location.pathname}?form=public`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(publicURL)
      .then(() => toast("Link do formulário público copiado."))
      .catch(() => prompt("Copie o link do formulário público:", publicURL));
  } else {
    prompt("Copie o link do formulário público:", publicURL);
  }
}

function copyDriverLink() {
  const driverURL = `${window.location.origin}${window.location.pathname}?mode=driver`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(driverURL)
      .then(() => toast("Link do App do Motorista copiado."))
      .catch(() => prompt("Copie o link do App Motorista:", driverURL));
  } else {
    prompt("Copie o link do App Motorista:", driverURL);
  }
}

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) {
    alert(message);
    return;
  }
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); }, 3500);
}

// ============================================================
// DASHBOARD & TABELA
// ============================================================

function renderDashboard() {
  const count = s => requests.filter(r => r.status === s).length;

  const statNovas = document.getElementById("statNovas");
  const statAgendadas = document.getElementById("statAgendadas");
  const statEmRota = document.getElementById("statEmRota");
  const statFinalizadas = document.getElementById("statFinalizadas");

  if (statNovas) statNovas.textContent = count("NOVA");
  if (statAgendadas) statAgendadas.textContent = count("AGENDADA");
  if (statEmRota) statEmRota.textContent = count("EM ROTA");
  if (statFinalizadas) statFinalizadas.textContent = count("FINALIZADA") + count("COLETADA");

  const recent = [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const recentList = document.getElementById("recentList");
  if (recentList) recentList.innerHTML = tableHTML(recent, false);
}

function tableHTML(data, withActions = true) {
  if (!data.length) {
    return `
      <div class="empty-state">
        <h2>Nenhuma solicitação encontrada</h2>
        <p>Não há registros gravados no sistema.</p>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Solicitante</th>
          <th>Data / Hora Cad.</th>
          <th>Local</th>
          <th>Materiais / Quantidade</th>
          <th>Frequência</th>
          <th>Status</th>
          ${withActions ? "<th>Ação</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td><strong>${escapeHTML(r.id)}</strong></td>
            <td>
              <a href="javascript:void(0)" onclick="openClientDetails('${escapeHTML(r.id)}')" style="color:var(--navy);font-weight:bold;text-decoration:underline;">
                ${escapeHTML(r.name)}
              </a>
              <br><small>Tel: ${escapeHTML(r.phone)}</small>
            </td>
            <td><small>🕒 ${escapeHTML(r.createdAtFormatted || "Data não registrada")}</small></td>
            <td>
              <strong>${escapeHTML(r.type)} ${r.customLocationName ? `(${escapeHTML(r.customLocationName)})` : ""}</strong>
              <br>
              <small>
                ${r.latitude && r.longitude
                  ? `<a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;text-decoration:none;">Visualizar no Mapa</a>`
                  : "Sem coordenadas"}
              </small>
            </td>
            <td>
              ${escapeHTML(r.materials)}
              <br><small><strong>Total:</strong> ${escapeHTML(r.quantity || "-")} ${escapeHTML(r.unit || "")}</small>
            </td>
            <td><small>${escapeHTML(r.frequency || "Não informada")}</small></td>
            <td>${statusBadge(r.status)}</td>
            ${withActions ? `
              <td>
                <div style="display:flex;gap:4px;align-items:center;">
                  <select class="inline-status" data-id="${escapeHTML(r.id)}">
                    ${["NOVA", "EM ANÁLISE", "AGENDADA", "EM ROTA", "COLETADA", "FINALIZADA"]
                      .map(s => `<option ${s === r.status ? "selected" : ""}>${s}</option>`)
                      .join("")}
                  </select>
                  <button class="btn-icon" onclick="openClientDetails('${escapeHTML(r.id)}')" title="Ver Detalhes">🔍</button>
                  <button class="btn-icon delete" onclick="deleteClient('${escapeHTML(r.id)}')" title="Excluir">🗑️</button>
                </div>
              </td>
            ` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRequests() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const status = statusFilter ? statusFilter.value : "";

  const filtered = requests.filter(r => {
    const text = `${r.id} ${r.name} ${r.phone} ${r.type} ${r.customLocationName} ${r.materials} ${r.frequency}`.toLowerCase();
    return (!query || text.includes(query)) && (!status || r.status === status);
  });

  const table = document.getElementById("requestsTable");
  if (table) table.innerHTML = tableHTML(filtered, true);

  document.querySelectorAll(".inline-status").forEach(select => {
    select.addEventListener("change", e => {
      const request = requests.find(r => r.id === e.target.dataset.id);
      if (request) {
        request.status = e.target.value;
        save();
        renderRequests();
        renderDashboard();
        toast("Status atualizado com sucesso.");
      }
    });
  });
}

// ============================================================
// VEÍCULOS, ROTAS E TELA DO MOTORISTA
// ============================================================

function renderVehicles() {
  const container = document.getElementById("vehiclesList");
  if (!container) return;

  if (!vehicles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Nenhum veículo cadastrado</h2>
        <p>Cadastre triciclos ou caminhões para operar as rotas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Identificador</th>
          <th>Nome / Modelo</th>
          <th>Placa</th>
          <th>Capacidade Máx.</th>
          <th>Capacidade Kg</th>
          <th>Volume Mín. de Saída</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map(v => `
          <tr>
            <td><strong>${escapeHTML(v.id)}</strong></td>
            <td>${escapeHTML(v.name)}</td>
            <td>${escapeHTML(v.plate)}</td>
            <td><strong>${escapeHTML(v.capacityLiters)} Litros</strong></td>
            <td>${v.capacityKg ? `${escapeHTML(v.capacityKg)} kg` : "Não informado"}</td>
            <td>${escapeHTML(v.minVolumeLiters || 0)} Litros</td>
            <td>
              <button class="secondary-btn" onclick="deleteVehicle('${escapeHTML(v.id)}')">Excluir</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function deleteVehicle(id) {
  vehicles = vehicles.filter(v => v.id !== id);
  saveVehicles();
  renderVehicles();
  toast("Veículo removido com sucesso.");
}

function convertToLiters(quantityStr, unitStr, materialsStr = "") {
  const qty = parseFloat(quantityStr) || 0;
  if (qty <= 0) return 0;

  const unit = (unitStr || "").toLowerCase();
  const mat = (materialsStr || "").toLowerCase();

  if (unit.includes("saco")) return qty * 100;
  if (unit.includes("bombona")) return qty * 200;
  if (unit.includes("bigbag")) return qty * 1000;
  if (unit.includes("caixa")) return qty * 50;
  if (unit.includes("litro")) return qty;

  if (unit.includes("kg")) {
    let densityKgPerL = 0.15;
    if (mat.includes("plástico") || mat.includes("pet")) densityKgPerL = 0.05;
    else if (mat.includes("papel") || mat.includes("papelão")) densityKgPerL = 0.10;
    else if (mat.includes("metal") || mat.includes("latas")) densityKgPerL = 0.15;
    else if (mat.includes("eletrônicos")) densityKgPerL = 0.25;
    else if (mat.includes("vidro")) densityKgPerL = 0.35;
    else if (mat.includes("óleo")) densityKgPerL = 0.92;

    return qty / densityKgPerL;
  }

  return qty;
}

function estimateWeightKg(quantityStr, unitStr, materialsStr = "") {
  const qty = parseFloat(quantityStr) || 0;
  if (qty <= 0) return 0;

  const unit = (unitStr || "").toLowerCase();
  if (unit.includes("kg")) return qty;

  const liters = convertToLiters(quantityStr, unitStr, materialsStr);
  const mat = (materialsStr || "").toLowerCase();

  let density = 0.15;
  if (mat.includes("plástico") || mat.includes("pet")) density = 0.05;
  else if (mat.includes("papel") || mat.includes("papelão")) density = 0.10;
  else if (mat.includes("metal") || mat.includes("latas")) density = 0.15;
  else if (mat.includes("eletrônicos")) density = 0.25;
  else if (mat.includes("vidro")) density = 0.35;
  else if (mat.includes("óleo")) density = 0.92;

  return liters * density;
}

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function getWeekdayName(date) { return WEEKDAYS[normalizeDate(date).getDay()]; }

function requestOccursOnDate(request, targetDate) {
  if (!request || request.status === "FINALIZADA" || request.status === "COLETADA") return false;

  const date = normalizeDate(targetDate);
  const weekday = getWeekdayName(date);
  const frequency = request.frequency || "";

  if (frequency.includes("Única")) {
    const match = frequency.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!match) return false;
    const [day, month, year] = match[1].split("/");
    return `${year}-${month}-${day}` === dateToISO(date);
  }

  if (frequency.includes("Diária")) return true;
  if (frequency.includes("Semanal")) return frequency.includes(weekday);

  if (frequency.includes("Quinzenal")) {
    if (!frequency.includes(weekday)) return false;
    const created = normalizeDate(request.createdAt ? new Date(request.createdAt) : new Date());
    const diff = Math.floor((date.getTime() - created.getTime()) / 86400000);
    return diff >= 0 && diff % 14 === 0;
  }

  if (frequency.includes("Mensal")) {
    const weekMatch = frequency.match(/([1-4])ª Semana/);
    if (!weekMatch) return false;
    const desiredWeek = Number(weekMatch[1]);
    if (!frequency.includes(weekday)) return false;
    return Math.ceil(date.getDate() / 7) === desiredWeek;
  }

  return false;
}

function getRequestsForDate(date) {
  return requests.filter(r => r.status === "AGENDADA" && requestOccursOnDate(r, date));
}

function nearestNeighborRoute(items) {
  const remaining = [...items];
  const ordered = [];
  let current = { lat: DEPOT.lat, lng: DEPOT.lng };

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    remaining.forEach((item, index) => {
      const d = distanceKm(current.lat, current.lng, Number(item.latitude), Number(item.longitude));
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = index;
      }
    });

    const selected = remaining.splice(nearestIndex, 1)[0];
    ordered.push(selected);
    current = { lat: Number(selected.latitude), lng: Number(selected.longitude) };
  }

  return ordered;
}

function routeDistance(route) {
  if (!route.length) return 0;
  let total = 0;
  let previous = DEPOT;

  route.forEach(point => {
    total += distanceKm(previous.lat, previous.lng, Number(point.latitude), Number(point.longitude));
    previous = { lat: Number(point.latitude), lng: Number(point.longitude) };
  });

  total += distanceKm(previous.lat, previous.lng, DEPOT.lat, DEPOT.lng);
  return total;
}

function twoOpt(route) {
  if (!route || route.length < 4) return route;

  let best = [...route];
  let improved = true;

  while (improved) {
    improved = false;
    let bestDistance = routeDistance(best);

    for (let i = 0; i < best.length - 2; i++) {
      for (let k = i + 1; k < best.length - 1; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1)
        ];

        const candidateDistance = routeDistance(candidate);
        if (candidateDistance < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return best;
}

function generateRoutesForDate(targetDate) {
  const points = getRequestsForDate(targetDate).map(r => ({
    ...r,
    totalLiters: convertToLiters(r.quantity, r.unit, r.materials),
    estimatedKg: estimateWeightKg(r.quantity, r.unit, r.materials)
  }));

  if (!points.length) return { routes: [], unassigned: [] };

  const sortedVehicles = [...vehicles].sort((a, b) => Number(b.capacityLiters || 0) - Number(a.capacityLiters || 0));
  const unassigned = [...points];
  const routes = [];

  while (unassigned.length && sortedVehicles.length) {
    let selectedVehicle = null;
    let selectedItems = [];

    for (const vehicle of sortedVehicles) {
      const capacityLiters = Number(vehicle.capacityLiters) || 0;
      const capacityKg = Number(vehicle.capacityKg) || Infinity;
      const minVolume = Number(vehicle.minVolumeLiters) || 0;

      if (capacityLiters <= 0) continue;

      const candidateItems = [];
      let usedLiters = 0;
      let usedKg = 0;

      const nearbyOrdered = nearestNeighborRoute(unassigned);

      for (const item of nearbyOrdered) {
        if (candidateItems.some(x => x.id === item.id)) continue;

        const itemLiters = Number(item.totalLiters) || 0;
        const itemKg = Number(item.estimatedKg) || 0;

        if (itemLiters > capacityLiters || usedLiters + itemLiters > capacityLiters || usedKg + itemKg > capacityKg) {
          continue;
        }

        candidateItems.push(item);
        usedLiters += itemLiters;
        usedKg += itemKg;
      }

      if (candidateItems.length && (usedLiters >= minVolume || minVolume === 0)) {
        selectedVehicle = vehicle;
        selectedItems = candidateItems;
        break;
      }
    }

    if (!selectedVehicle) break;

    const ordered = twoOpt(selectedItems);
    const distance = routeDistance(ordered);
    const usedLiters = ordered.reduce((sum, item) => sum + Number(item.totalLiters), 0);
    const usedKg = ordered.reduce((sum, item) => sum + Number(item.estimatedKg), 0);
    const capacityLiters = Number(selectedVehicle.capacityLiters) || 0;
    const capacityKg = Number(selectedVehicle.capacityKg) || 0;

    const estimatedTimeMinutes = Math.max(20, Math.round((distance / 30) * 60 + ordered.length * 10));

    const route = {
      id: nextRouteId(),
      date: dateToISO(targetDate),
      vehicleId: selectedVehicle.id,
      vehicleName: selectedVehicle.name,
      vehiclePlate: selectedVehicle.plate,
      stops: ordered.map((item, index) => ({
        order: index + 1,
        requestId: item.id,
        name: item.name,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        liters: Math.round(item.totalLiters),
        estimatedKg: Math.round(item.estimatedKg)
      })),
      totalLiters: Math.round(usedLiters),
      totalKg: Math.round(usedKg),
      capacityLiters,
      capacityKg,
      occupancyPercent: capacityLiters ? Math.min(100, Math.round((usedLiters / capacityLiters) * 100)) : 0,
      weightOccupancyPercent: capacityKg ? Math.min(100, Math.round((usedKg / capacityKg) * 100)) : 0,
      distanceKm: Number(distance.toFixed(2)),
      estimatedMinutes: estimatedTimeMinutes,
      status: "PLANEJADA",
      createdAt: new Date().toISOString()
    };

    routes.push(route);
    selectedItems.forEach(item => {
      const index = unassigned.findIndex(r => r.id === item.id);
      if (index >= 0) unassigned.splice(index, 1);
    });
  }

  return { routes, unassigned };
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function buildRoutePlanningControls() {
  return `
    <div class="panel" style="margin-bottom:20px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <strong>📅 Planejamento:</strong>
        <button type="button" class="secondary-btn route-period-btn" data-period="today">Hoje</button>
        <button type="button" class="secondary-btn route-period-btn" data-period="tomorrow">Amanhã</button>
        <button type="button" class="secondary-btn route-period-btn" data-period="7">Próximos 7 dias</button>
        <button type="button" class="secondary-btn route-period-btn" data-period="30">Próximos 30 dias</button>
        <input type="date" id="routeSpecificDate" class="big-input" style="max-width:180px;">
        <button type="button" class="secondary-btn" id="routeSpecificDateBtn">Ver data</button>
      </div>
      <div id="routePlanningSummary" style="margin-top:15px;"></div>
    </div>
  `;
}

function renderRoutes() {
  const container = document.getElementById("routesByVehicleContainer");
  if (!container) return;

  container.innerHTML = buildRoutePlanningControls();
  const content = document.createElement("div");
  content.id = "routesPlanningContent";
  container.appendChild(content);

  setupRoutePlanningEvents();
  renderRoutePeriod("today");
}

function setupRoutePlanningEvents() {
  document.querySelectorAll(".route-period-btn").forEach(button => {
    button.addEventListener("click", () => renderRoutePeriod(button.dataset.period));
  });

  const specificDateBtn = document.getElementById("routeSpecificDateBtn");
  const specificDateInput = document.getElementById("routeSpecificDate");

  specificDateBtn?.addEventListener("click", () => {
    if (!specificDateInput.value) {
      toast("Selecione uma data.");
      return;
    }
    renderRoutePeriod(specificDateInput.value);
  });
}

function getDatesFromPeriod(period) {
  const today = normalizeDate(new Date());

  if (period === "today") return [today];
  if (period === "tomorrow") return [addDays(today, 1)];
  if (period === "7") return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  if (period === "30") return Array.from({ length: 30 }, (_, i) => addDays(today, i));

  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const [year, month, day] = period.split("-").map(Number);
    return [new Date(year, month - 1, day)];
  }

  return [today];
}

function renderRoutePeriod(period) {
  const content = document.getElementById("routesPlanningContent");
  if (!content) return;

  const dates = getDatesFromPeriod(period);
  let totalRequests = 0;
  let totalRoutes = 0;
  let totalLiters = 0;
  let totalKm = 0;
  let html = "";

  dates.forEach(date => {
    const result = generateRoutesForDate(date);
    if (!result) return;

    const routes = result.routes || [];
    const unassigned = result.unassigned || [];
    const points = getRequestsForDate(date);

    totalRequests += points.length;
    totalRoutes += routes.length;
    totalLiters += routes.reduce((sum, route) => sum + route.totalLiters, 0);
    totalKm += routes.reduce((sum, route) => sum + route.distanceKm, 0);

    html += `
      <div class="panel" style="margin-bottom:20px;">
        <div class="panel-heading">
          <div>
            <h2>📅 ${formatDateBR(date)}</h2>
            <p>${points.length} coleta(s) programada(s) • ${routes.length} rota(s)</p>
          </div>
        </div>

        ${routes.length
          ? routes.map(route => routeCardHTML(route)).join("")
          : `<div class="empty-state">
               <h3>Nenhuma rota necessária</h3>
               <p>Não há solicitações agendadas para esta data.</p>
             </div>`
        }

        ${unassigned.length ? `
          <div style="margin-top:15px;padding:15px;border:2px solid var(--orange);border-radius:8px;">
            <h3 style="color:var(--orange);">⚠️ Coletas sem veículo</h3>
            <p>Estas solicitações não puderam ser alocadas automaticamente.</p>
            <ul>
              ${unassigned.map(item => `
                <li><strong>${escapeHTML(item.name)}</strong> — ≈ ${Math.round(item.totalLiters)} L / ${Math.round(item.estimatedKg)} kg</li>
              `).join("")}
            </ul>
          </div>
        ` : ""}
      </div>
    `;
  });

  if (!html) {
    html = `
      <div class="empty-state">
        <h2>Nenhuma coleta encontrada</h2>
        <p>Não existem solicitações programadas para o período selecionado.</p>
      </div>
    `;
  }

  content.innerHTML = html;

  const summary = document.getElementById("routePlanningSummary");
  if (summary) {
    summary.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div><strong>${totalRequests}</strong> coletas</div>
        <div><strong>${totalRoutes}</strong> rotas</div>
        <div><strong>${Math.round(totalLiters).toLocaleString("pt-BR")}</strong> L</div>
        <div><strong>${totalKm.toFixed(1)}</strong> km estimados</div>
      </div>
    `;
  }
}

function routeCardHTML(route) {
  const mapsUrl = buildGoogleMapsRouteURL(route);

  return `
    <div class="panel" style="margin-top:12px;border-left:5px solid var(--orange);">
      <div style="display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;">
        <div>
          <h3>🚚 ${escapeHTML(route.vehicleName)} — ${escapeHTML(route.vehiclePlate)}</h3>
          <p><strong>${route.id}</strong> • ${route.stops.length} paradas</p>
        </div>
        <div>${statusBadge(route.status)}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:15px 0;">
        <div><strong>${route.totalLiters.toLocaleString("pt-BR")} L</strong><small><br>Volume</small></div>
        <div><strong>${route.totalKg.toLocaleString("pt-BR")} kg</strong><small><br>Peso estimado</small></div>
        <div><strong>${route.occupancyPercent}%</strong><small><br>Ocupação volumétrica</small></div>
        <div><strong>${route.distanceKm.toFixed(1)} km</strong><small><br>Distância</small></div>
        <div><strong>${formatDuration(route.estimatedMinutes)}</strong><small><br>Tempo estimado</small></div>
      </div>

      <div style="margin:12px 0;padding:10px;background:#f5f5f5;border-radius:8px;">
        <strong>📍 Sequência da rota</strong>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;">
          <span>🏠 Base</span>
          ${route.stops.map(stop => `
            <span>→ ${stop.order}. ${escapeHTML(stop.name)}</span>
          `).join("")}
          <span>→ 🏠 Base</span>
        </div>
      </div>

      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Solicitação</th>
              <th>Local</th>
              <th>Volume</th>
              <th>Peso</th>
              <th>Mapa</th>
            </tr>
          </thead>
          <tbody>
            ${route.stops.map(stop => `
              <tr>
                <td><strong>${stop.order}</strong></td>
                <td><strong>${escapeHTML(stop.requestId)}</strong><br>${escapeHTML(stop.name)}</td>
                <td>${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}</td>
                <td>≈ ${stop.liters} L</td>
                <td>≈ ${stop.estimatedKg} kg</td>
                <td>
                  <a href="https://maps.google.com/?q=${stop.latitude},${stop.longitude}" target="_blank" class="secondary-btn" style="text-decoration:none;">📍 Abrir</a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;">
        <a href="${mapsUrl}" target="_blank" class="secondary-btn" style="text-decoration:none;">🗺️ ABRIR ROTA NO GOOGLE MAPS</a>
        <button type="button" class="primary-btn" onclick="dispatchRoute('${route.id}')">🚀 DESPACHAR ROTA</button>
        <button type="button" class="secondary-btn" onclick="reoptimizeRoute('${route.id}')">🔄 REOTIMIZAR</button>
      </div>
    </div>
  `;
}

function buildGoogleMapsRouteURL(route) {
  const origin = `${DEPOT.lat},${DEPOT.lng}`;
  const destination = origin;
  const waypoints = route.stops.map(stop => `${stop.latitude},${stop.longitude}`).join("|");
  return `https://www.google.com/maps/dir/${origin}/${waypoints}/${destination}`;
}

function dispatchRoute(routeId) {
  const route = findRoute(routeId);
  if (!route) {
    toast("Rota não encontrada.");
    return;
  }

  if (route.status === "EM ROTA") {
    toast("Esta rota já está em execução.");
    return;
  }

  route.status = "EM ROTA";
  route.dispatchedAt = new Date().toISOString();

  route.stops.forEach(stop => {
    const request = requests.find(r => r.id === stop.requestId);
    if (request) request.status = "EM ROTA";
  });

  save();
  saveRoutes();
  renderDashboard();
  renderRoutes();
  toast(`Rota ${route.id} despachada com sucesso.`);
}

function findRoute(routeId) { return generatedRoutes.find(r => r.id === routeId); }

function reoptimizeRoute(routeId) {
  const route = findRoute(routeId);
  if (!route) return;

  const requestsInRoute = route.stops
    .map(stop => requests.find(r => r.id === stop.requestId))
    .filter(Boolean)
    .map(r => ({
      ...r,
      totalLiters: convertToLiters(r.quantity, r.unit, r.materials),
      estimatedKg: estimateWeightKg(r.quantity, r.unit, r.materials)
    }));

  const optimized = twoOpt(requestsInRoute);

  route.stops = optimized.map((item, index) => ({
    order: index + 1,
    requestId: item.id,
    name: item.name,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    liters: Math.round(item.totalLiters),
    estimatedKg: Math.round(item.estimatedKg)
  }));

  route.distanceKm = Number(routeDistance(optimized).toFixed(2));
  route.estimatedMinutes = Math.max(20, Math.round((route.distanceKm / 30) * 60 + route.stops.length * 10));

  saveRoutes();
  renderRoutes();
  toast("Rota reotimizada com sucesso.");
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
    save();
    renderDriverView();
    toast("Coleta confirmada!");
  }
}

// ============================================================
// CLIENTES
// ============================================================

function renderClients() {
  const uniqueMap = new Map();

  requests.forEach(r => {
    const key = `${r.name.toLowerCase().trim()}|${r.phone.trim()}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, r);
  });

  const uniqueClients = Array.from(uniqueMap.values());
  const container = document.getElementById("clientsList");

  if (!container) return;

  container.innerHTML = uniqueClients.length ? uniqueClients.map(r => `
    <article class="client-card" onclick="openClientDetails('${escapeHTML(r.id)}')">
      <div class="client-card-header">
        <h3>${escapeHTML(r.name)}</h3>
        <div class="client-card-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="editClient('${escapeHTML(r.id)}')" title="Editar Cadastro">✏️</button>
          <button class="btn-icon delete" onclick="deleteClient('${escapeHTML(r.id)}')" title="Excluir">🗑️</button>
        </div>
      </div>
      <p><strong>Telefone:</strong> ${escapeHTML(r.phone)}</p>
      <p><strong>Local:</strong> ${escapeHTML(r.type)} ${r.customLocationName ? `(${escapeHTML(r.customLocationName)})` : ""}</p>
      <p><strong>Frequência:</strong> ${escapeHTML(r.frequency || "Não informada")}</p>
      <p><strong>Cadastrado em:</strong> ${escapeHTML(r.createdAtFormatted || "-")}</p>
      <p><strong>Último Protocolo:</strong> ${escapeHTML(r.id)}</p>
    </article>
  `).join("") : `
    <div class="empty-state">
      <h2>Nenhum cliente cadastrado</h2>
    </div>
  `;
}

function openClientDetails(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;

  const modal = document.getElementById("clientModal");
  const title = document.getElementById("clientModalTitle");
  const content = document.getElementById("clientModalContent");

  if (!modal || !title || !content) return;

  title.textContent = `Ficha Cadastral — ${req.name}`;

  const estLiters = Math.round(convertToLiters(req.quantity, req.unit, req.materials));
  const estKg = Math.round(estimateWeightKg(req.quantity, req.unit, req.materials));

  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span>Código do Protocolo</span>
        <strong>${escapeHTML(req.id)}</strong>
      </div>
      <div class="detail-item">
        <span>Status Atual</span>
        <strong>${statusBadge(req.status)}</strong>
      </div>
      <div class="detail-item">
        <span>Nome Completo</span>
        <strong>${escapeHTML(req.name)}</strong>
      </div>
      <div class="detail-item">
        <span>Telefone WhatsApp</span>
        <strong>${escapeHTML(req.phone)}</strong>
      </div>
      <div class="detail-item">
        <span>Data e Hora do Cadastro</span>
        <strong>🕒 ${escapeHTML(req.createdAtFormatted || "Data não registrada")}</strong>
      </div>
      <div class="detail-item">
        <span>Tipo de Localidade</span>
        <strong>${escapeHTML(req.type)} ${req.customLocationName ? `— ${escapeHTML(req.customLocationName)}` : ""}</strong>
      </div>
      <div class="detail-item">
        <span>Frequência Agendada</span>
        <strong>${escapeHTML(req.frequency || "Não informada")}</strong>
      </div>
      <div class="detail-item">
        <span>Materiais Recicláveis</span>
        <strong>${escapeHTML(req.materials)}</strong>
      </div>
      <div class="detail-item">
        <span>Carga Estimada</span>
        <strong>${escapeHTML(req.quantity)} ${escapeHTML(req.unit)}<br>≈ ${estLiters} Litros<br>≈ ${estKg} kg</strong>
      </div>
      <div class="detail-item" style="grid-column:span 2;">
        <span>Localização Geográfica</span>
        <strong>
          ${req.latitude && req.longitude ? `
            <a href="https://maps.google.com/?q=${req.latitude},${req.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;">
              Lat: ${req.latitude} | Lng: ${req.longitude} (Abrir Google Maps 🔗)
            </a>
          ` : "Coordenadas não registradas"}
        </strong>
      </div>
      <div class="detail-item" style="grid-column:span 2;">
        <span>Observações e Referências</span>
        <strong>${escapeHTML(req.notes || "Nenhuma observação informada.")}</strong>
      </div>
    </div>

    <div style="margin-top:24px;display:flex;gap:12px;justify-content:flex-end;">
      <button class="secondary-btn" onclick="editClient('${escapeHTML(req.id)}')">✏️ Editar Cadastro</button>
      <button class="secondary-btn" style="color:#c92a2a;border-color:#f8b4b4;" onclick="deleteClient('${escapeHTML(req.id)}')">🗑️ Excluir Registro</button>
    </div>
  `;

  modal.classList.remove("hidden");
}

function editClient(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;

  document.getElementById("clientModal")?.classList.add("hidden");

  const container = document.getElementById("modalFormContainer");
  container.innerHTML = buildFormHTML("editModalForm");
  initFormEvents("editModalForm");

  const form = document.getElementById("editModalForm");
  form.querySelector('input[name="name"]').value = req.name;
  form.querySelector('input[name="phone"]').value = req.phone;
  form.querySelector(".type-select").value = req.type;

  if (req.type !== "Residência") {
    const customWrap = form.querySelector(".custom-location-wrap");
    customWrap.classList.remove("hidden");
    form.querySelector('input[name="customLocationName"]').value = req.customLocationName || "";
  }

  form.querySelector('input[name="quantity"]').value = req.quantity;
  form.querySelector('select[name="unit"]').value = req.unit;
  form.querySelector("textarea[name='notes']").value = req.notes || "";
  form.querySelector('input[name="latitude"]').value = req.latitude || "";
  form.querySelector('input[name="longitude"]').value = req.longitude || "";

  form.onsubmit = e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    let checkedMaterials = [
      ...form.querySelectorAll('input[name="materials_list"]:checked')
    ].map(c => c.value);

    if (checkedMaterials.length === 0) checkedMaterials = [req.materials];

    req.name = data.name;
    req.phone = data.phone;
    req.type = data.type;
    req.customLocationName = data.type !== "Residência" ? data.customLocationName : "";
    req.quantity = data.quantity;
    req.unit = data.unit;
    req.notes = data.notes;
    req.materials = checkedMaterials.join(", ");

    save();
    closeModal();
    renderRequests();
    renderClients();
    renderDashboard();
    toast("Cadastro do cliente atualizado com sucesso!");
  };

  document.getElementById("requestModal").classList.remove("hidden");
}

function deleteClient(id) {
  if (confirm(`Tem certeza que deseja excluir o cadastro/solicitação ${id}?`)) {
    requests = requests.filter(r => r.id !== id);
    generatedRoutes = generatedRoutes.filter(route => !route.stops.some(stop => stop.requestId === id));

    save();
    saveRoutes();

    document.getElementById("clientModal")?.classList.add("hidden");
    renderRequests();
    renderClients();
    renderDashboard();
    toast("Registro excluído com sucesso.");
  }
}

// ============================================================
// INICIALIZAÇÃO SEGURA
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  document.querySelectorAll("[data-section-link]").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.sectionLink));
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("novaSolicitacaoBtn")?.addEventListener("click", openModal);
  document.getElementById("novaSolicitacaoBtn2")?.addEventListener("click", openModal);
  document.getElementById("shareFormBtn")?.addEventListener("click", copyPublicLink);
  document.getElementById("shareDriverAppBtn")?.addEventListener("click", copyDriverLink);
  document.getElementById("closeModal")?.addEventListener("click", closeModal);

  document.getElementById("closeClientModal")?.addEventListener("click", () => {
    document.getElementById("clientModal")?.classList.add("hidden");
  });

  document.getElementById("requestModal")?.addEventListener("click", e => {
    if (e.target.id === "requestModal") closeModal();
  });

  document.getElementById("clientModal")?.addEventListener("click", e => {
    if (e.target.id === "clientModal") {
      document.getElementById("clientModal").classList.add("hidden");
    }
  });

  document.getElementById("searchInput")?.addEventListener("input", renderRequests);
  document.getElementById("statusFilter")?.addEventListener("change", renderRequests);

  document.getElementById("exportBackupBtn")?.addEventListener("click", exportData);
  document.getElementById("importBackupInput")?.addEventListener("change", (e) => {
    if (e.target.files.length) importData(e.target.files[0]);
  });

  document.getElementById("novoVeiculoBtn")?.addEventListener("click", () => {
    document.getElementById("vehicleModal")?.classList.remove("hidden");
  });

  document.getElementById("closeVehicleModal")?.addEventListener("click", () => {
    document.getElementById("vehicleModal")?.classList.add("hidden");
  });

  document.getElementById("vehicleForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const newVehicle = {
      id: `VEH-${vehicles.length + 1}`,
      name: data.name,
      plate: data.plate,
      capacityLiters: parseFloat(data.capacityLiters),
      capacityKg: parseFloat(data.capacityKg) || 0,
      minVolumeLiters: parseFloat(data.minVolumeLiters) || 0
    };

    vehicles.push(newVehicle);
    saveVehicles();
    renderVehicles();

    e.target.reset();
    document.getElementById("vehicleModal")?.classList.add("hidden");
    toast("Veículo cadastrado com sucesso.");
  });

  if (!checkSpecialURL()) {
    renderDashboard();
  }
});
