const STORAGE_KEY = "sol_nascente_solicitacoes_v1";

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
    quantity: "50",
    unit: "Kg",
    source: "Redes Sociais (Instagram / Facebook)",
    notes: "Coleta no galpão lateral",
    status: "NOVA",
    createdAt: new Date().toISOString()
  }
];

let requests = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || defaultRequests;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
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
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Outros"> Outros</label>
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
            <option value="Litros">Litros</option>
            <option value="Sacos de 100L">Sacos de 100 Litros</option>
            <option value="BigBags">BigBags</option>
            <option value="Caixas">Caixas</option>
            <option value="Unidades">Unidades</option>
          </select>
        </label>
      </div>

      <!-- 6. CANAL DE CONHECIMENTO -->
      <div class="form-group-block">
        <span class="form-block-title">6. Origem da Informação</span>
        <label class="form-label">Como tomou conhecimento da Associação Sol Nascente? *
          <select name="source" required class="big-select">
            <option value="">Selecione uma opção...</option>
            <option value="Redes Sociais (Instagram / Facebook)">Redes Sociais (Instagram / Facebook)</option>
            <option value="WhatsApp / Mensagem">WhatsApp / Mensagem Instantânea</option>
            <option value="Indicação de Amigo / Vizinho">Indicação de Amigo / Vizinho</option>
            <option value="Panfletos / Cartaz">Divulgação Impressa / Cartaz</option>
            <option value="Evento Local">Evento Institucional / Cidade</option>
            <option value="Outro">Outro</option>
          </select>
        </label>
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

  // Mask Phone
  const phoneInput = form.querySelector('.phone-mask');
  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      e.target.value = formatPhone(e.target.value);
    });
  }

  // Custom location field display toggle
  const typeSelect = form.querySelector('.type-select');
  const customWrap = form.querySelector('.custom-location-wrap');
  const customInput = customWrap ? customWrap.querySelector('input') : null;

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

  // Init Leaflet Map
  initMap(formId);

  // Form Submit
  form.addEventListener('submit', e => {
    e.preventDefault();

    const lat = form.querySelector('input[name="latitude"]').value;
    const lng = form.querySelector('input[name="longitude"]').value;

    if (!lat || !lng) {
      toast("Por favor, selecione o ponto de localização exato no mapa.");
      return;
    }

    const checkedMaterials = [...form.querySelectorAll('input[name="materials_list"]:checked')].map(c => c.value);
    if (checkedMaterials.length === 0) {
      toast("Selecione ao menos um tipo de material para agendar a coleta.");
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

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
      source: data.source,
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
      <th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais / Quantidade</th><th>Origem</th><th>Status</th>${withActions ? "<th>Ação</th>" : ""}
    </tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td><strong>${escapeHTML(r.id)}</strong></td>
        <td>${escapeHTML(r.name)}<br><small>Tel: ${escapeHTML(r.phone)}</small></td>
        <td>
          <strong>${escapeHTML(r.type)}${r.customLocationName ? ` (${escapeHTML(r.customLocationName)})` : ''}</strong><br>
          <small>${r.latitude && r.longitude ? `<a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;text-decoration:none;">Visualizar no Mapa</a>` : 'Sem coordenadas'}</small>
        </td>
        <td>${escapeHTML(r.materials)}<br><small><strong>Total:</strong> ${escapeHTML(r.quantity || '-')} ${escapeHTML(r.unit || '')}</small></td>
        <td><small>${escapeHTML(r.source || 'Não informada')}</small></td>
        <td>${statusBadge(r.status)}</td>
        ${withActions ? `<td><select class="inline-status" data-id="${escapeHTML(r.id)}">
          ${["NOVA","EM ANÁLISE","AGENDADA","EM ROTA","COLETADA","FINALIZADA"].map(s => `<option ${s===r.status ? "selected":""}>${s}</option>`).join("")}
        </select></td>` : ""}
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderRequests() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const filtered = requests.filter(r => {
    const text = `${r.id} ${r.name} ${r.phone} ${r.type} ${r.customLocationName} ${r.materials} ${r.source}`.toLowerCase();
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

function renderRoutes() {
  const scheduled = requests.filter(r => r.status === "AGENDADA");
  const container = document.getElementById("routePoints");
  if (!scheduled.length) {
    container.innerHTML = `<div class="empty-state"><h2>Nenhum ponto disponível</h2><p>Altere o status de uma solicitação para "AGENDADA" para incluí-la na rota.</p></div>`;
    document.getElementById("routeSummary").textContent = "Nenhum ponto selecionado.";
    document.getElementById("routeOrder").innerHTML = "";
    return;
  }
  container.innerHTML = scheduled.map(r => `<label class="route-point">
    <input type="checkbox" class="route-checkbox" value="${escapeHTML(r.id)}">
    <span><strong>${escapeHTML(r.id)} — ${escapeHTML(r.name)}</strong>
    <small>${escapeHTML(r.type)}${r.customLocationName ? ` (${escapeHTML(r.customLocationName)})` : ''} — Qtd: ${escapeHTML(r.quantity || '')} ${escapeHTML(r.unit || '')}</small></span>
  </label>`).join("");

  document.querySelectorAll(".route-checkbox").forEach(c => c.addEventListener("change", updateRoutePreview));
  updateRoutePreview();
}

function updateRoutePreview() {
  const ids = [...document.querySelectorAll(".route-checkbox:checked")].map(c => c.value);
  const selected = ids.map(id => requests.find(r => r.id === id)).filter(Boolean);
  document.getElementById("routeSummary").textContent = selected.length
    ? `${selected.length} ponto(s) selecionado(s) para compor a rota.`
    : "Nenhum ponto selecionado.";
  document.getElementById("routeOrder").innerHTML = selected.map((r, i) =>
    `<li>${i + 1}. ${escapeHTML(r.name)} (${escapeHTML(r.type)}) — ${escapeHTML(r.materials)}</li>`).join("");
}

function renderClients() {
  const unique = [];
  const seen = new Set();
  requests.forEach(r => {
    const key = `${r.name}|${r.phone}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  });
  document.getElementById("clientsList").innerHTML = unique.length
    ? unique.map(r => `<article class="client-card">
        <h3>${escapeHTML(r.name)}</h3>
        <p>Telefone: ${escapeHTML(r.phone)}</p>
        <p>Tipo: ${escapeHTML(r.type)}${r.customLocationName ? ` - ${escapeHTML(r.customLocationName)}` : ''}</p>
        <p>Origem: ${escapeHTML(r.source || 'Não informada')}</p>
      </article>`)
    : `<div class="empty-state"><h2>Nenhum cliente cadastrado</h2></div>`;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

// Global Event Listeners
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

  document.getElementById("requestModal")?.addEventListener("click", e => {
    if (e.target.id === "requestModal") closeModal();
  });

  document.getElementById("searchInput")?.addEventListener("input", renderRequests);
  document.getElementById("statusFilter")?.addEventListener("change", renderRequests);

  document.getElementById("createRouteBtn")?.addEventListener("click", () => {
    const ids = [...document.querySelectorAll(".route-checkbox:checked")].map(c => c.value);
    if (!ids.length) {
      toast("Selecione ao menos um ponto para gerar a rota.");
      return;
    }
    ids.forEach(id => {
      const r = requests.find(x => x.id === id);
      if (r) r.status = "EM ROTA";
    });
    save();
    renderRoutes();
    renderDashboard();
    toast("Rota gerada e pontos atualizados para 'EM ROTA'.");
  });

  if (!checkPublicURL()) {
    renderDashboard();
  }
});
