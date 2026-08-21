const STORAGE_KEY = "sol_nascente_solicitacoes_v1";

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    customLocationName: "",
    latitude: "-3.3752",
    longitude: "-39.2689",
    materials: "Papel, Papelão",
    quantity: "50",
    unit: "Kg",
    source: "Instagram / Facebook",
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
      <!-- 1. IDENTIFICAÇÃO -->
      <div class="form-group-block">
        <label class="form-label">Seu Nome Completo *
          <input name="name" required maxlength="100" placeholder="Digite seu nome..." class="big-input">
        </label>
        
        <label class="form-label">Seu Telefone (WhatsApp) *
          <input name="phone" required inputmode="numeric" maxlength="15" placeholder="(88) 99999-9999" class="big-input phone-mask">
        </label>
      </div>

      <!-- 2. TIPO DE LOCAL -->
      <div class="form-group-block">
        <label class="form-label">Onde será realizada a coleta? *
          <select name="type" required class="big-select type-select">
            <option value="Residência">🏠 Residência (Minha Casa)</option>
            <option value="Estabelecimento">🏢 Estabelecimento Comercial / Empresa</option>
            <option value="Evento">🎉 Evento</option>
            <option value="Condomínio">🏢 Condomínio</option>
            <option value="Outro">📍 Outro</option>
          </select>
        </label>

        <div class="custom-location-wrap hidden">
          <label class="form-label">Nome do Estabelecimento / Local / Evento *
            <input name="customLocationName" placeholder="Ex: Mercadinho Sol, Festival de Verão..." class="big-input">
          </label>
        </div>
      </div>

      <!-- 3. MAPA / LOCALIZAÇÃO -->
      <div class="form-group-block">
        <label class="form-label">Clique no mapa exatamente onde o lixo está localizado: *</label>
        <p class="map-instruction">👇 Toque ou clique no mapa para marcar a localização exata para a coleta!</p>
        
        <button type="button" class="geo-btn">📍 Usar minha localização atual</button>

        <div class="map-container" id="map-${formId}"></div>

        <div class="coords-display">
          <span>📍 Coordenadas selecionadas:</span>
          <strong class="coords-text">Nenhum ponto marcado no mapa ainda</strong>
          <input type="hidden" name="latitude" required>
          <input type="hidden" name="longitude" required>
        </div>
      </div>

      <!-- 4. MATERIAIS PARA COLETA -->
      <div class="form-group-block">
        <label class="form-label">Quais tipos de resíduos você irá disponibilizar? *</label>
        <div class="materials-grid">
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Papel"> 📄 Papel</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Papelão"> 📦 Papelão</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Vidro"> 🍾 Vidro</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Metal"> 🥫 Metal / Latas</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Plástico"> 🥤 Plástico / Garrafas PET</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Eletrônicos"> 📺 Eletrônicos</label>
          <label class="material-checkbox"><input type="checkbox" name="materials_list" value="Outros"> 🌀 Outros</label>
        </div>
      </div>

      <!-- 5. QUANTIDADE ESTIMADA -->
      <div class="form-group-block row-group">
        <label class="form-label flex-1">Quantidade Estimada *
          <input name="quantity" type="number" step="0.1" min="1" required placeholder="Ex: 10, 50, 100" class="big-input">
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

      <!-- 6. COMO CONHECEU A ASSOCIAÇÃO -->
      <div class="form-group-block">
        <label class="form-label">Como você conheceu a Associação Sol Nascente? *
          <select name="source" required class="big-select">
            <option value="">Selecione uma opção...</option>
            <option value="Redes Sociais (Instagram / Facebook)">📱 Redes Sociais (Instagram / Facebook)</option>
            <option value="WhatsApp / Mensagem">💬 WhatsApp / Grupo de Mensagens</option>
            <option value="Indicação de Amigo / Vizinho">👥 Indicação de Amigo ou Vizinho</option>
            <option value="Panfletos / Cartaz">📄 Panfletos / Cartaz</option>
            <option value="Evento Local">🎉 Evento na Cidade</option>
            <option value="Outro">⭐ Outro</option>
          </select>
        </label>
      </div>

      <!-- 7. OBSERVAÇÕES ADICIONAIS -->
      <div class="form-group-block">
        <label class="form-label">Observações ou Ponto de Referência (Opcional)
          <textarea name="notes" rows="3" placeholder="Ex: Lixo está na calçada ao lado do portão verde..." class="big-textarea"></textarea>
        </label>
      </div>

      <button class="primary-btn submit-btn" type="submit">✅ ENVIAR SOLICITAÇÃO DE COLETA</button>
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
      toast("⚠️ Por favor, marque a sua localização no mapa clicando no ponto correto!");
      return;
    }

    const checkedMaterials = [...form.querySelectorAll('input[name="materials_list"]:checked')].map(c => c.value);
    if (checkedMaterials.length === 0) {
      toast("⚠️ Selecione pelo menos um tipo de resíduo para a coleta!");
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
          <div class="success-icon">🎉</div>
          <h2>Solicitação Enviada com Sucesso!</h2>
          <p>Sua solicitação foi registrada sob o código: <strong>${request.id}</strong></p>
          <p>A equipe da <strong>Associação Sol Nascente</strong> entrará em contato em breve para confirmar a coleta.</p>
          <button class="primary-btn" type="button" onclick="window.location.reload()">Fazer Outra Solicitação</button>
        </div>
      `;
    } else {
      closeModal();
      renderDashboard();
      toast(`✅ Solicitação ${request.id} criada com sucesso!`);
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
      console.error("Leaflet.js não foi carregado corretamente!");
      return;
    }

    const map = L.map(mapElement).setView([defaultLat, defaultLng], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Garante que o mapa recalcule tamanho e aceite cliques
    map.invalidateSize();

    let marker = null;

    const form = document.getElementById(formId);
    const coordsText = form.querySelector('.coords-text');
    const latInput = form.querySelector('input[name="latitude"]');
    const lngInput = form.querySelector('input[name="longitude"]');

    function setLocation(lat, lng) {
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup("📍 Ponto de Coleta Selecionado").openPopup();
      
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      coordsText.textContent = `Lat: ${lat.toFixed(5)}, Long: ${lng.toFixed(5)}`;
    }

    map.on('click', e => {
      setLocation(e.latlng.lat, e.latlng.lng);
    });

    const geoBtn = form.querySelector('.geo-btn');
    if (geoBtn) {
      geoBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          toast("Navegador não suporta geolocalização.");
          return;
        }
        geoBtn.textContent = "⌛ Obtendo localização...";
        navigator.geolocation.getCurrentPosition(
          pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 17);
            setLocation(lat, lng);
            geoBtn.textContent = "📍 Localização Atualizada!";
            setTimeout(() => { geoBtn.textContent = "📍 Usar minha localização atual"; }, 3000);
          },
          err => {
            toast("Não foi possível obter sua localização automaticamente. Por favor, toque no mapa.");
            geoBtn.textContent = "📍 Usar minha localização atual";
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
      toast("📋 Link do formulário público copiado para a área de transferência!");
    }).catch(() => {
      prompt("Copie o link público do formulário abaixo:", publicURL);
    });
  } else {
    prompt("Copie o link público do formulário abaixo:", publicURL);
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
  if (!data.length) return `<div class="empty-state"><h2>Nenhuma solicitação encontrada</h2><p>Cadastre uma nova solicitação para começar.</p></div>`;
  return `<table>
    <thead><tr>
      <th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais / Qtd</th><th>Origem</th><th>Status</th>${withActions ? "<th>Ação</th>" : ""}
    </tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td><strong>${escapeHTML(r.id)}</strong></td>
        <td>${escapeHTML(r.name)}<br><small>📱 ${escapeHTML(r.phone)}</small></td>
        <td>
          <strong>${escapeHTML(r.type)}${r.customLocationName ? ` (${escapeHTML(r.customLocationName)})` : ''}</strong><br>
          <small>📍 ${r.latitude && r.longitude ? `<a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--orange);font-weight:bold;text-decoration:underline;">Ver no Google Maps</a>` : 'Sem mapa'}</small>
        </td>
        <td>${escapeHTML(r.materials)}<br><small><strong>Qtd:</strong> ${escapeHTML(r.quantity || '-')} ${escapeHTML(r.unit || '')}</small></td>
        <td><small>${escapeHTML(r.source || 'Não inf.')}</small></td>
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
    container.innerHTML = `<div class="empty-state"><h2>Nenhum ponto disponível</h2><p>Altere uma solicitação para "AGENDADA" para incluí-la na rota.</p></div>`;
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
    ? `${selected.length} ponto(s) selecionado(s) para a rota.`
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
        <p>📱 ${escapeHTML(r.phone)}</p>
        <p>🏠 ${escapeHTML(r.type)}${r.customLocationName ? ` - ${escapeHTML(r.customLocationName)}` : ''}</p>
        <p>⭐ Conheceu por: ${escapeHTML(r.source || 'Não informado')}</p>
      </article>`).join("")
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
      toast("Selecione pelo menos um ponto para criar a rota.");
      return;
    }
    ids.forEach(id => {
      const r = requests.find(x => x.id === id);
      if (r) r.status = "EM ROTA";
    });
    save();
    renderRoutes();
    renderDashboard();
    toast("Rota criada e pontos marcados como 'EM ROTA'.");
  });

  if (!checkPublicURL()) {
    renderDashboard();
  }
});
