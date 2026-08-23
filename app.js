const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";

// DADOS PADRÃO DE EXEMPLO
const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de Solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    customLocationName: "",
    latitude: "-3.3752",
    longitude: "-39.2689",
    materials: "Papel, Papelão",
    quantity: "5",
    unit: "Sacos de 100L",
    frequency: "Semanal (Sexta-feira)",
    notes: "Coleta no galpão lateral",
    status: "AGENDADA",
    createdAt: new Date().toISOString()
  }
];

const defaultVehicles = [
  { id: "VEH-1", name: "Triciclo / Reboque", plate: "TRI-01", capacityLiters: 1000, minVolumeLiters: 0 },
  { id: "VEH-2", name: "Caminhão Baú", plate: "CAM-01", capacityLiters: 10000, minVolumeLiters: 2000 }
];

let requests = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || defaultRequests;
let vehicles = JSON.parse(localStorage.getItem(VEHICLES_STORAGE_KEY) || "null") || defaultVehicles;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function saveVehicles() {
  localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
}

function nextId() {
  const year = new Date().getFullYear();
  const numbers = requests
    .map(r => Number((r.id || "").split("-").pop()))
    .filter(Number.isFinite);
  const next = (Math.max(0, ...numbers) + 1).toString().padStart(6, "0");
  return `SOL-${year}-${next}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function statusClass(status) {
  return status.replaceAll(" ", "-").replaceAll("Á", "Á");
}

function checkPublicURL() {
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
  } else {
    document.body.classList.remove("public-mode");
    return false;
  }
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
  if (sectionId === "veiculos") renderVehicles();
  if (sectionId === "rotas") renderRoutes();
  if (sectionId === "clientes") renderClients();
}

function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">
      <!-- 1. DADOS DE IDENTIFICAÇÃO -->
      <div class="form-group-block">
        <span class="form-block-title">1. Dados do Solicitante</span>
        <label class="form-label">Nome Completo *
          <input name="name" required maxlength="100" placeholder="Digite seu nome completo" class="big-input">
        </label>
        
        <label class="form-label">Telefone de Contato (WhatsApp) *
          <input name="phone" required inputmode="numeric" maxlength="15" placeholder="(88) 99999-9999" class="big-input phone-mask">
        </label>
      </div>

      <!-- 2. TIPO DE LOCALIDADE -->
      <div class="form-group-block">
        <span class="form-block-title">2. Tipo de Localidade</span>
        <label class="form-label">Selecione o tipo de local para a coleta *
          <select name="type" required class="big-select type-select">
            <option value="Residência">Residência</option>
            <option value="Estabelecimento">Estabelecimento Comercial / Empresa</option>
            <option value="Evento">Evento Público ou Privado</option>
            <option value="Condomínio">Condomínio Residencial / Comercial</option>
            <option value="Outro">Outro</option>
          </select>
        </label>

        <div class="custom-location-wrap hidden">
          <label class="form-label">Nome do Estabelecimento / Local / Evento *
            <input name="customLocationName" placeholder="Informe o nome da empresa ou local" class="big-input">
          </label>
        </div>
      </div>

      <!-- 3. LOCALIZAÇÃO NO MAPA -->
      <div class="form-group-block">
        <span class="form-block-title">3. Localização Exata</span>
        <label class="form-label">Selecione o ponto exato no mapa abaixo *</label>
        <p class="map-instruction">Clique ou toque no mapa para definir a posição onde os resíduos estarão disponíveis.</p>
        
        <button type="button" class="geo-btn">Usar minha localização atual</button>

        <div class="map-container" id="map-${formId}"></div>

        <div class="coords-display">
          <span>Coordenadas Geográficas:</span>
          <strong class="coords-text">Nenhum ponto marcado no mapa</strong>
          <input type="hidden" name="latitude" required>
          <input type="hidden" name="longitude" required>
        </div>
      </div>

      <!-- 4. RESÍDUOS / MATERIAIS -->
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
          <label class="material-checkbox"><input type="checkbox" name="materials_list" id="otherMaterialCheckbox" value="Outros"> Outros</label>
        </div>

        <div id="otherMaterialWrap" class="hidden" style="margin-top: 12px;">
          <label class="form-label">Qual resíduo? Especificar: *
            <input name="otherMaterialText" id="otherMaterialText" placeholder="Ex: Óleo de cozinha usado, Baterias..." class="big-input">
          </label>
        </div>
      </div>

      <!-- 5. QUANTIDADE ESTIMADA -->
      <div class="form-group-block row-group">
        <label class="form-label flex-1">Quantidade Estimada *
          <input name="quantity" type="number" step="0.1" min="1" required placeholder="Ex: 50" class="big-input">
        </label>

        <label class="form-label flex-1">Unidade de Medida *
          <select name="unit" required class="big-select">
            <option value="Kg">Kg (Quilogramas)</option>
            <option value="Sacos de 100L">Sacos de 100 Litros</option>
            <option value="BigBags">BigBags</option>
            <option value="Caixas">Caixas</option>
            <option value="Bombonas">Bombonas</option>
          </select>
        </label>
      </div>

      <!-- 6. FREQUÊNCIA E AGENDAMENTO -->
      <div class="form-group-block">
        <span class="form-block-title">6. Frequência e Agendamento da Coleta</span>
        <label class="form-label">Com que frequência a coleta deve acontecer? *
          <select name="frequency" id="frequencySelect" required class="big-select">
            <option value="">Selecione a periodicidade...</option>
            <option value="Única">Coleta Pontual (Uma única vez)</option>
            <option value="Diária">Uma vez por dia (Diária)</option>
            <option value="Semanal">Uma vez por semana</option>
            <option value="Quinzenal">Uma vez a cada 15 dias (Quinzenal)</option>
            <option value="Mensal">Uma vez no mês (Mensal)</option>
          </select>
        </label>

        <!-- Coleta Única (Calendário) -->
        <div id="singleDateWrap" class="hidden frequency-subwrap">
          <label class="form-label">Data Preferencial para Coleta *
            <input type="date" name="preferred_date" id="preferredDateInput" class="big-input">
          </label>
        </div>

        <!-- Coleta Semanal / Quinzenal (Dias da Semana) -->
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

        <!-- Coleta Mensal (Semana do Mês + Dia) -->
        <div id="monthlyWrap" class="hidden frequency-subwrap row-group">
          <label class="form-label flex-1">Qual semana do mês? *
            <select name="monthly_week" id="monthlyWeekSelect" class="big-select">
              <option value="1ª Semana">1ª Semana do mês</option>
              <option value="2ª Semana">2ª Semana do mês</option>
              <option value="3ª Semana">3ª Semana do mês</option>
              <option value="4ª Semana">4ª Semana do mês</option>
            </select>
          </label>

          <label class="form-label flex-1">Em qual dia da semana? *
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

      <!-- 7. OBSERVAÇÕES ADICIONAIS -->
      <div class="form-group-block">
        <span class="form-block-title">7. Observações e Referências</span>
        <label class="form-label">Ponto de Referência ou Informações Adicionais (Opcional)
          <textarea name="notes" rows="3" placeholder="Exemplo: Material armazenado ao lado da entrada secundária." class="big-textarea"></textarea>
        </label>
      </div>

      <button class="primary-btn submit-btn" type="submit">SUBMETER SOLICITAÇÃO DE COLETA</button>
    </form>
  `;
}

function initFormEvents(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const phoneInput = form.querySelector('.phone-mask');
  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      e.target.value = formatPhone(e.target.value);
    });
  }

  const typeSelect = form.querySelector('.type-select');
  const customWrap = form.querySelector('.custom-location-wrap');
  const customInput = customWrap ? customWrap.querySelector('input') : null;

  if (typeSelect && customWrap) {
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value && typeSelect.value !== 'Residência') {
        customWrap.classList.remove('hidden');
        if (customInput) customInput.required = true;
      } else {
        customWrap.classList.add('hidden');
        if (customInput) {
          customInput.required = false;
          customInput.value = '';
        }
      }
    });
  }

  const otherCheckbox = form.querySelector('#otherMaterialCheckbox');
  const otherWrap = form.querySelector('#otherMaterialWrap');
  const otherInput = form.querySelector('#otherMaterialText');

  if (otherCheckbox && otherWrap) {
    otherCheckbox.addEventListener('change', () => {
      if (otherCheckbox.checked) {
        otherWrap.classList.remove('hidden');
        if (otherInput) otherInput.required = true;
      } else {
        otherWrap.classList.add('hidden');
        if (otherInput) {
          otherInput.required = false;
          otherInput.value = '';
        }
      }
    });
  }

  const frequencySelect = form.querySelector('#frequencySelect');
  const singleDateWrap = form.querySelector('#singleDateWrap');
  const weeklyDaysWrap = form.querySelector('#weeklyDaysWrap');
  const monthlyWrap = form.querySelector('#monthlyWrap');
  const preferredDateInput = form.querySelector('#preferredDateInput');

  if (frequencySelect) {
    if (preferredDateInput) {
      preferredDateInput.min = new Date().toISOString().split('T')[0];
    }

    frequencySelect.addEventListener('change', () => {
      const val = frequencySelect.value;

      singleDateWrap.classList.add('hidden');
      weeklyDaysWrap.classList.add('hidden');
      monthlyWrap.classList.add('hidden');

      if (preferredDateInput) preferredDateInput.required = false;

      if (val === 'Única') {
        singleDateWrap.classList.remove('hidden');
        if (preferredDateInput) preferredDateInput.required = true;
      } else if (val === 'Semanal' || val === 'Quinzenal') {
        weeklyDaysWrap.classList.remove('hidden');
      } else if (val === 'Mensal') {
        monthlyWrap.classList.remove('hidden');
      }
    });
  }

  initMap(formId);

  form.addEventListener('submit', e => {
    e.preventDefault();

    const lat = form.querySelector('input[name="latitude"]').value;
    const lng = form.querySelector('input[name="longitude"]').value;

    if (!lat || !lng) {
      toast("Por favor, selecione o ponto de localização exato no mapa.");
      return;
    }

    let checkedMaterials = [...form.querySelectorAll('input[name="materials_list"]:checked')].map(c => c.value);
    if (checkedMaterials.length === 0) {
      toast("Selecione ao menos um tipo de material para agendar a coleta.");
      return;
    }

    if (otherCheckbox && otherCheckbox.checked && otherInput && otherInput.value.trim() !== '') {
      checkedMaterials = checkedMaterials.map(m => m === 'Outros' ? `Outros (${otherInput.value.trim()})` : m);
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const freqVal = data.frequency;
    let frequencyText = freqVal;

    if (freqVal === 'Única') {
      if (!data.preferred_date) {
        toast("Por favor, selecione a data preferencial para a coleta única.");
        return;
      }
      const formattedDate = data.preferred_date.split('-').reverse().join('/');
      frequencyText = `Única (${formattedDate})`;
    } else if (freqVal === 'Semanal' || freqVal === 'Quinzenal') {
      const selectedDays = [...form.querySelectorAll('input[name="preferred_days"]:checked')].map(d => d.value);
      if (selectedDays.length === 0) {
        toast("Selecione ao menos um dia da semana para a coleta.");
        return;
      }
      frequencyText = `${freqVal} (${selectedDays.join(', ')})`;
    } else if (freqVal === 'Mensal') {
      frequencyText = `Mensal (${data.monthly_week} - ${data.monthly_day})`;
    }

    const request = {
      id: nextId(),
      name: data.name,
      phone: data.phone,
      type: data.type,
      customLocationName: data.type !== 'Residência' ? data.customLocationName : '',
      latitude: data.latitude,
      longitude: data.longitude,
      materials: checkedMaterials.join(', '),
      quantity: data.quantity,
      unit: data.unit,
      frequency: frequencyText,
      notes: data.notes || '',
      status: "NOVA",
      createdAt: new Date().toISOString()
    };

    requests.push(request);
    save();

    if (document.body.classList.contains('public-mode')) {
      form.innerHTML = `
        <div class="success-screen">
          <h2>Solicitação Registrada com Sucesso</h2>
          <p>O seu pedido foi protocolado sob o número de identificação: <strong>${request.id}</strong></p>
          <p>A equipe da <strong>Associação Sol Nascente</strong> em parceria com a <strong>Inciclo</strong> e <strong>Recicle+ Trairi</strong> analisará a solicitação e entrará em contato para confirmação.</p>
          <button class="primary-btn" type="button" onclick="window.location.reload()">Registrar Nova Solicitação</button>
        </div>
      `;
    } else {
      closeModal();
      renderDashboard();
      toast(`Solicitação ${request.id} registrada com sucesso.`);
    }
  });
}

function initMap(formId) {
  const mapElement = document.getElementById(`map-${formId}`);
  if (!mapElement) return;

  const defaultLat = -3.3752;
  const defaultLng = -39.2689;

  setTimeout(() => {
    if (typeof L === 'undefined') {
      console.error("A biblioteca Leaflet.js não foi carregada.");
      return;
    }

    const map = L.map(mapElement).setView([defaultLat, defaultLng], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    map.invalidateSize();

    let marker = null;

    const form = document.getElementById(formId);
    const coordsText = form.querySelector('.coords-text');
    const latInput = form.querySelector('input[name="latitude"]');
    const lngInput = form.querySelector('input[name="longitude"]');

    function setLocation(lat, lng) {
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup("Ponto de Coleta Selecionado").openPopup();
      
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      coordsText.textContent = `Latitude: ${lat.toFixed(5)} | Longitude: ${lng.toFixed(5)}`;
    }

    map.on('click', e => {
      setLocation(e.latlng.lat, e.latlng.lng);
    });

    const geoBtn = form.querySelector('.geo-btn');
    if (geoBtn) {
      geoBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          toast("A geolocalização não é suportada por este navegador.");
          return;
        }
        geoBtn.textContent = "Obtendo coordenadas...";
        navigator.geolocation.getCurrentPosition(
          pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 17);
            setLocation(lat, lng);
            geoBtn.textContent = "Localização Atualizada";
            setTimeout(() => { geoBtn.textContent = "Usar minha localização atual"; }, 3000);
          },
          err => {
            toast("Não foi possível obter a localização exata automaticamente. Por favor, marque manualmente no mapa.");
            geoBtn.textContent = "Usar minha localização atual";
          },
          { enableHighAccuracy: true }
        );
      });
    }
  }, 200);
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

function copyPublicLink() {
  const publicURL = `${window.location.origin}${window.location.pathname}?form=public`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(publicURL).then(() => {
      toast("Link do formulário público copiado.");
    }).catch(() => {
      prompt("Copie o link do formulário público:", publicURL);
    });
  } else {
    prompt("Copie o link do formulário público:", publicURL);
  }
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3500);
}

function statusBadge(status) {
  return `<span class="status status-${statusClass(escapeHTML(status))}">${escapeHTML(status)}</span>`;
}

function renderDashboard() {
  const count = s => requests.filter(r => r.status === s).length;
  document.getElementById("statNovas").textContent = count("NOVA");
  document.getElementById("statAgendadas").textContent = count("AGENDADA");
  document.getElementById("statEmRota").textContent = count("EM ROTA");
  document.getElementById("statFinalizadas").textContent = count("FINALIZADA") + count("COLETADA");

  const recent = [...requests].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  document.getElementById("recentList").innerHTML = tableHTML(recent, false);
}

function tableHTML(data, withActions = true) {
  if (!data.length) return `<div class="empty-state"><h2>Nenhuma solicitação encontrada</h2><p>Não há registros gravados no sistema.</p></div>`;
  return `<table>
    <thead><tr>
      <th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais / Quantidade</th><th>Frequência</th><th>Status</th>${withActions ? "<th>Ação</th>" : ""}
    </tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td><strong>${escapeHTML(r.id)}</strong></td>
        <td>
          <a href="javascript:void(0)" onclick="openClientDetails('${escapeHTML(r.id)}')" style="color:var(--navy);font-weight:bold;text-decoration:underline;">
            ${escapeHTML(r.name)}
          </a><br>
          <small>Tel: ${escapeHTML(r.phone)}</small>
        </td>
        <td>
          <strong>${escapeHTML(r.type)}${r.customLocationName ? ` (${escapeHTML(r.customLocationName)})` : ''}</strong><br>
          <small>${r.latitude && r.longitude ? `<a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;text-decoration:none;">Visualizar no Mapa</a>` : 'Sem coordenadas'}</small>
        </td>
        <td>${escapeHTML(r.materials)}<br><small><strong>Total:</strong> ${escapeHTML(r.quantity || '-')} ${escapeHTML(r.unit || '')}</small></td>
        <td><small>${escapeHTML(r.frequency || 'Não informada')}</small></td>
        <td>${statusBadge(r.status)}</td>
        ${withActions ? `<td>
          <div style="display:flex;gap:4px;align-items:center;">
            <select class="inline-status" data-id="${escapeHTML(r.id)}">
              ${["NOVA","EM ANÁLISE","AGENDADA","EM ROTA","COLETADA","FINALIZADA"].map(s => `<option ${s===r.status ? "selected":""}>${s}</option>`).join("")}
            </select>
            <button class="btn-icon" onclick="openClientDetails('${escapeHTML(r.id)}')" title="Ver Detalhes">🔍</button>
            <button class="btn-icon delete" onclick="deleteClient('${escapeHTML(r.id)}')" title="Excluir">🗑️</button>
          </div>
        </td>` : ""}
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderRequests() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const filtered = requests.filter(r => {
    const text = `${r.id} ${r.name} ${r.phone} ${r.type} ${r.customLocationName} ${r.materials} ${r.frequency}`.toLowerCase();
    return (!query || text.includes(query)) && (!status || r.status === status);
  });
  document.getElementById("requestsTable").innerHTML = tableHTML(filtered, true);

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

// CADASTRO E GESTÃO DE VEÍCULOS
function renderVehicles() {
  const container = document.getElementById("vehiclesList");
  if (!container) return;

  if (!vehicles.length) {
    container.innerHTML = `<div class="empty-state"><h2>Nenhum veículo cadastrado</h2><p>Cadastre triciclos ou caminhões para operar as rotas.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Identificador</th><th>Nome / Modelo</th><th>Placa</th><th>Capacidade Máx.</th><th>Volume Mín. de Saída</th><th>Ação</th></tr>
      </thead>
      <tbody>
        ${vehicles.map(v => `
          <tr>
            <td><strong>${escapeHTML(v.id)}</strong></td>
            <td>${escapeHTML(v.name)}</td>
            <td>${escapeHTML(v.plate)}</td>
            <td><strong>${escapeHTML(v.capacityLiters)} Litros</strong></td>
            <td>${escapeHTML(v.minVolumeLiters)} Litros</td>
            <td><button class="secondary-btn" onclick="deleteVehicle('${v.id}')">Excluir</button></td>
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

// CONVERSÃO INTELIGENTE PARA LITROS
function convertToLiters(quantityStr, unitStr, materialsStr = "") {
  const qty = parseFloat(quantityStr) || 0;
  if (qty <= 0) return 0;

  const unit = (unitStr || "").toLowerCase();
  const mat = (materialsStr || "").toLowerCase();

  if (unit.includes("saco")) return qty * 100;
  if (unit.includes("bombona")) return qty * 200;
  if (unit.includes("bigbag")) return qty * 1000;
  if (unit.includes("caixa")) return qty * 50;

  if (unit.includes("kg")) {
    let densityKgPerL = 0.15;
    if (mat.includes("plástico") || mat.includes("pet")) densityKgPerL = 0.05;
    else if (mat.includes("papel") || mat.includes("papelão")) densityKgPerL = 0.10;
    else if (mat.includes("metal") || mat.includes("latas")) densityKgPerL = 0.15;
    else if (mat.includes("eletrônicos")) densityKgPerL = 0.25;
    else if (mat.includes("vidro")) densityKgPerL = 0.35;

    return qty / densityKgPerL;
  }

  return qty;
}

// ROTEIRIZAÇÃO INTELIGENTE POR VEÍCULO COM REGRA DE FALLBACK E DIVISÃO DE CARGA
function renderRoutes() {
  const container = document.getElementById("routesByVehicleContainer");
  if (!container) return;

  const today = new Date();
  const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const currentDayName = weekdays[today.getDay()];
  const formattedTodayDate = today.toLocaleDateString('pt-BR');

  const todayPoints = requests.filter(r => {
    if (r.status !== "AGENDADA") return false;
    if (!r.frequency) return false;
    if (r.frequency.includes("Única") && r.frequency.includes(formattedTodayDate)) return true;
    if (r.frequency.includes("Diária")) return true;
    if (r.frequency.includes(currentDayName)) return true;
    return false;
  });

  if (!todayPoints.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Nenhuma Coleta Programada para Hoje (${currentDayName})</h2>
        <p>Não há coletas ativas registradas para o dia de hoje.</p>
      </div>`;
    return;
  }

  const sortedVehicles = [...vehicles].sort((a, b) => b.capacityLiters - a.capacityLiters);

  let pendingItems = todayPoints.map(p => ({
    ...p,
    totalLiters: convertToLiters(p.quantity, p.unit, p.materials),
    remainingLiters: convertToLiters(p.quantity, p.unit, p.materials)
  }));

  let vehicleAllocations = {};
  sortedVehicles.forEach(v => {
    vehicleAllocations[v.id] = { vehicle: v, trips: [] };
  });

  sortedVehicles.forEach(vehicle => {
    const minVol = parseFloat(vehicle.minVolumeLiters) || 0;
    const maxCap = parseFloat(vehicle.capacityLiters) || 0;

    let pointsToEvaluate = pendingItems.filter(item => item.remainingLiters > 0);
    const totalPendingLiters = pointsToEvaluate.reduce((acc, i) => acc + i.remainingLiters, 0);

    if (minVol > 0 && totalPendingLiters < minVol) {
      return;
    }

    let currentTrip = { tripNumber: 1, items: [], usedLiters: 0 };

    pointsToEvaluate.forEach(item => {
      while (item.remainingLiters > 0) {
        const spaceLeft = maxCap - currentTrip.usedLiters;

        if (spaceLeft <= 0) {
          vehicleAllocations[vehicle.id].trips.push(currentTrip);
          currentTrip = { tripNumber: vehicleAllocations[vehicle.id].trips.length + 1, items: [], usedLiters: 0 };
        }

        const currentSpace = maxCap - currentTrip.usedLiters;
        if (currentSpace <= 0) break;

        const allocatedLiters = Math.min(item.remainingLiters, currentSpace);
        
        currentTrip.items.push({
          ...item,
          allocatedLiters: Math.round(allocatedLiters),
          isPartial: allocatedLiters < item.totalLiters
        });

        currentTrip.usedLiters += allocatedLiters;
        item.remainingLiters -= allocatedLiters;

        if (currentTrip.usedLiters >= maxCap) {
          vehicleAllocations[vehicle.id].trips.push(currentTrip);
          currentTrip = { tripNumber: vehicleAllocations[vehicle.id].trips.length + 1, items: [], usedLiters: 0 };
        }
      }
    });

    if (currentTrip.items.length > 0) {
      vehicleAllocations[vehicle.id].trips.push(currentTrip);
    }
  });

  let routeOutputHTML = "";

  sortedVehicles.forEach(vehicle => {
    const alloc = vehicleAllocations[vehicle.id];
    const totalVehicleLiters = alloc.trips.reduce((acc, t) => acc + t.usedLiters, 0);

    routeOutputHTML += `
      <div class="panel" style="margin-bottom: 20px;">
        <div class="panel-heading">
          <div>
            <h2>🚚 ${escapeHTML(vehicle.name)} (${escapeHTML(vehicle.plate)})</h2>
            <p>Capacidade Máx por Viagem: <strong>${vehicle.capacityLiters} L</strong> | Volume Total Alocado: <strong>${Math.round(totalVehicleLiters)} Litros</strong></p>
          </div>
        </div>
        ${alloc.trips.length ? alloc.trips.map(trip => `
          <div class="trip-block" style="margin-top: 12px; padding: 12px; background: var(--background); border-radius: 8px;">
            <strong style="color: var(--navy); display:block; margin-bottom: 8px;">
              📍 Viagem ${trip.tripNumber} ${trip.tripNumber > 1 ? '(Viagem de Apoio / Complementar)' : ''} — Total: ${Math.round(trip.usedLiters)} L
            </strong>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Solicitante</th><th>Local</th><th>Carga Declarada</th><th>Volume Carregado</th></tr></thead>
                <tbody>
                  ${trip.items.map(p => `
                    <tr>
                      <td><strong>${escapeHTML(p.id)}</strong></td>
                      <td>${escapeHTML(p.name)}</td>
                      <td>${escapeHTML(p.type)} ${p.customLocationName ? `(${escapeHTML(p.customLocationName)})` : ''}</td>
                      <td>${escapeHTML(p.quantity)} ${escapeHTML(p.unit)} (${escapeHTML(p.materials)})</td>
                      <td>
                        <strong>≈ ${p.allocatedLiters} L</strong>
                        ${p.isPartial ? `<br><small style="color:var(--orange);font-weight:bold;">(Carga Fracionada)</small>` : ''}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `).join("") : `<p style="color:var(--muted);">Nenhum ponto atende aos critérios deste veículo hoje.</p>`}
      </div>
    `;
  });

  const remainingUnassigned = pendingItems.filter(i => i.remainingLiters > 0);
  if (remainingUnassigned.length) {
    routeOutputHTML += `
      <div class="panel" style="border-color: var(--orange);">
        <h2 style="color: var(--orange);">⚠️ Coletas Pendentes / Excedentes</h2>
        <p>Volumes excedentes que requerem viagens adicionais:</p>
        <ul style="margin-top:10px;">
          ${remainingUnassigned.map(p => `
            <li><strong>${p.name}</strong> - Restante: ≈ ${Math.round(p.remainingLiters)} Litros</li>
          `).join("")}
        </ul>
      </div>
    `;
  }

  container.innerHTML = routeOutputHTML;
}

// CLIENTES E DETALHAMENTO DE FORMULÁRIO COMPLETO
function renderClients() {
  const uniqueMap = new Map();
  requests.forEach(r => {
    const key = `${r.name.toLowerCase().trim()}|${r.phone.trim()}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, r);
    }
  });

  const uniqueClients = Array.from(uniqueMap.values());
  const container = document.getElementById("clientsList");
  if (!container) return;

  container.innerHTML = uniqueClients.length
    ? uniqueClients.map(r => `
        <article class="client-card" onclick="openClientDetails('${escapeHTML(r.id)}')">
          <div class="client-card-header">
            <h3>${escapeHTML(r.name)}</h3>
            <div class="client-card-actions" onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="editClient('${escapeHTML(r.id)}')" title="Editar Cadastro">✏️ Edit</button>
              <button class="btn-icon delete" onclick="deleteClient('${escapeHTML(r.id)}')" title="Excluir">🗑️ Excluir</button>
            </div>
          </div>
          <p><strong>Telefone:</strong> ${escapeHTML(r.phone)}</p>
          <p><strong>Local:</strong> ${escapeHTML(r.type)} ${r.customLocationName ? `(${escapeHTML(r.customLocationName)})` : ''}</p>
          <p><strong>Frequência:</strong> ${escapeHTML(r.frequency || 'Não informada')}</p>
          <p><strong>Última Solicitação:</strong> ${escapeHTML(r.id)}</p>
        </article>
      `).join("")
    : `<div class="empty-state"><h2>Nenhum cliente cadastrado</h2></div>`;
}

// ABRIR DETALHES DO CLIENTE NO MODAL
function openClientDetails(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;

  const modal = document.getElementById("clientModal");
  const title = document.getElementById("clientModalTitle");
  const content = document.getElementById("clientModalContent");

  title.textContent = `Ficha Cadastral — ${req.name}`;

  const estLiters = Math.round(convertToLiters(req.quantity, req.unit, req.materials));

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
        <span>Tipo de Localidade</span>
        <strong>${escapeHTML(req.type)} ${req.customLocationName ? `— ${escapeHTML(req.customLocationName)}` : ''}</strong>
      </div>
      <div class="detail-item">
        <span>Frequência Agendada</span>
        <strong>${escapeHTML(req.frequency || 'Não informada')}</strong>
      </div>
      <div class="detail-item">
        <span>Materiais Recicláveis</span>
        <strong>${escapeHTML(req.materials)}</strong>
      </div>
      <div class="detail-item">
        <span>Carga Estimada Declarada</span>
        <strong>${escapeHTML(req.quantity)} ${escapeHTML(req.unit)} (≈ ${estLiters} Litros)</strong>
      </div>
      <div class="detail-item" style="grid-column: span 2;">
        <span>Localização Geográfica</span>
        <strong>
          ${req.latitude && req.longitude 
            ? `<a href="https://maps.google.com/?q=${req.latitude},${req.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;">Lat: ${req.latitude} | Lng: ${req.longitude} (Abrir Google Maps 🔗)</a>` 
            : 'Coordenadas não registradas'}
        </strong>
      </div>
      <div class="detail-item" style="grid-column: span 2;">
        <span>Observações e Referências</span>
        <strong>${escapeHTML(req.notes || 'Nenhuma observação informada.')}</strong>
      </div>
    </div>
    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
      <button class="secondary-btn" onclick="editClient('${escapeHTML(req.id)}')">✏️ Editar Cadastro</button>
      <button class="secondary-btn" style="color: #c92a2a; border-color: #f8b4b4;" onclick="deleteClient('${escapeHTML(req.id)}')">🗑️ Excluir Registro</button>
    </div>
  `;

  modal.classList.remove("hidden");
}

// FUNÇÃO DE EDIÇÃO DE CADASTRO DE CLIENTE
function editClient(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;

  document.getElementById("clientModal")?.classList.add("hidden");

  const container = document.getElementById("modalFormContainer");
  container.innerHTML = buildFormHTML("editModalForm");
  initFormEvents("editModalForm");

  const form = document.getElementById("editModalForm");
  
  // Preenche os campos existentes com os dados salvos
  form.querySelector('input[name="name"]').value = req.name;
  form.querySelector('input[name="phone"]').value = req.phone;
  form.querySelector('.type-select').value = req.type;

  if (req.type !== "Residência") {
    const customWrap = form.querySelector('.custom-location-wrap');
    customWrap.classList.remove('hidden');
    form.querySelector('input[name="customLocationName"]').value = req.customLocationName || '';
  }

  form.querySelector('input[name="quantity"]').value = req.quantity;
  form.querySelector('select[name="unit"]').value = req.unit;
  form.querySelector('textarea[name="notes"]').value = req.notes || '';

  form.querySelector('input[name="latitude"]').value = req.latitude || '';
  form.querySelector('input[name="longitude"]').value = req.longitude || '';

  // Substitui a ação padrão de envio para atualizar em vez de criar novo registro
  form.onsubmit = e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    let checkedMaterials = [...form.querySelectorAll('input[name="materials_list"]:checked')].map(c => c.value);
    if (checkedMaterials.length === 0) checkedMaterials = [req.materials];

    req.name = data.name;
    req.phone = data.phone;
    req.type = data.type;
    req.customLocationName = data.type !== 'Residência' ? data.customLocationName : '';
    req.quantity = data.quantity;
    req.unit = data.unit;
    req.notes = data.notes;
    req.materials = checkedMaterials.join(', ');

    save();
    closeModal();
    renderRequests();
    renderClients();
    renderDashboard();
    toast("Cadastro do cliente atualizado com sucesso!");
  };

  document.getElementById("requestModal").classList.remove("hidden");
}

// EXCLUIR CADASTRO
function deleteClient(id) {
  if (confirm(`Tem certeza que deseja excluir o cadastro/solicitação ${id}?`)) {
    requests = requests.filter(r => r.id !== id);
    save();
    document.getElementById("clientModal")?.classList.add("hidden");
    renderRequests();
    renderClients();
    renderDashboard();
    toast("Registro excluído com sucesso.");
  }
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

// INICIALIZAÇÃO DE EVENTOS DO SISTEMA
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

  // Eventos do Modal de Veículos
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
      minVolumeLiters: parseFloat(data.minVolumeLiters)
    };

    vehicles.push(newVehicle);
    saveVehicles();
    renderVehicles();
    
    e.target.reset();
    document.getElementById("vehicleModal")?.classList.add("hidden");
    toast("Veículo cadastrado com sucesso.");
  });

  if (!checkPublicURL()) {
    renderDashboard();
  }
});
});
