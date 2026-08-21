const STORAGE_KEY = "sol_nascente_solicitacoes_v1";

let requests = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || [];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

// Verifica se o usuário acessou a URL pública do formulário
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
  }
  return false;
}

// Constrói o HTML simplificado do formulário
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
        <p class="map-instruction">👇 Toque/Clique no mapa para marcar o ponto de coleta. Ou use o botão verde!</p>
        
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

      <!-- 7. OBSERVAÇÕES -->
      <div class="form-group-block">
        <label class="form-label">Observações ou Ponto de Referência (Opcional)
          <textarea name="notes" rows="3" placeholder="Ex: Lixo está ao lado do portão verde..." class="big-textarea"></textarea>
        </label>
      </div>

      <button class="primary-btn submit-btn" type="submit">✅ ENVIAR SOLICITAÇÃO DE COLETA</button>
    </form>
  `;
}

// Inicializa eventos do formulário e Mapa Leaflet
function initFormEvents(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  // Alterna exibição do campo de nome do estabelecimento
  const typeSelect = form.querySelector('.type-select');
  const customWrap = form.querySelector('.custom-location-wrap');
  typeSelect.addEventListener('change', () => {
    if (typeSelect.value && typeSelect.value !== 'Residência') {
      customWrap.classList.remove('hidden');
    } else {
      customWrap.classList.add('hidden');
    }
  });

  // Mapa Leaflet
  setTimeout(() => {
    const map = L.map(`map-${formId}`).setView([-3.3752, -39.2689], 14); // Trairi-CE
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let marker = null;
    map.on('click', e => {
      if (marker) map.removeLayer(marker);
      marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
      form.querySelector('input[name="latitude"]').value = e.latlng.lat.toFixed(6);
      form.querySelector('input[name="longitude"]').value = e.latlng.lng.toFixed(6);
      form.querySelector('.coords-text').textContent = `Lat: ${e.latlng.lat.toFixed(5)}, Long: ${e.latlng.lng.toFixed(5)}`;
    });
  }, 100);
}

// Copiar Link Público
function copyPublicLink() {
  const publicURL = `${window.location.origin}${window.location.pathname}?form=public`;
  navigator.clipboard.writeText(publicURL).then(() => {
    toast("📋 Link do formulário público copiado para a área de transferência!");
  });
}
