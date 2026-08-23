/* ============================================================
   SISTEMA DE GESTÃO DE COLETAS — ASSOCIAÇÃO SOL NASCENTE
   MOTOR V2 DE ROTEIRIZAÇÃO
   ============================================================ */

const STORAGE_KEY = "sol_nascente_solicitacoes_v1";
const VEHICLES_STORAGE_KEY = "sol_nascente_veiculos_v1";
const ROUTES_STORAGE_KEY = "sol_nascente_rotas_v2";

/* ============================================================
   CONFIGURAÇÕES GERAIS
   ============================================================ */

const ROUTING_CONFIG = {
  depot: {
    lat: -3.3752,
    lng: -39.2689,
    name: "Base / Galpão da Associação"
  },

  // Raio aproximado usado para agrupamento geográfico.
  // O agrupamento final também considera a capacidade dos veículos.
  clusterRadiusKm: 8,

  // Velocidade média usada quando o serviço de roteamento
  // não conseguir retornar uma estimativa.
  averageSpeedKmH: 30,

  // Tempo operacional médio por parada.
  serviceMinutesPerStop: 10,

  // Serviço utilizado para calcular distância pelas ruas.
  osrmUrl: "https://router.project-osrm.org/route/v1/driving/"
};

/* ============================================================
   DADOS PADRÃO
   ============================================================ */

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
  {
    id: "VEH-1",
    name: "Triciclo / Reboque",
    plate: "TRI-01",
    capacityLiters: 1000,
    capacityKg: 300,
    minVolumeLiters: 0
  },
  {
    id: "VEH-2",
    name: "Caminhão Baú",
    plate: "CAM-01",
    capacityLiters: 10000,
    capacityKg: 2000,
    minVolumeLiters: 2000
  }
];

/* ============================================================
   CARREGAMENTO DOS DADOS
   ============================================================ */

let requests =
  JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") ||
  defaultRequests;

let vehicles =
  JSON.parse(localStorage.getItem(VEHICLES_STORAGE_KEY) || "null") ||
  defaultVehicles;

let routes =
  JSON.parse(localStorage.getItem(ROUTES_STORAGE_KEY) || "null") ||
  [];

/* ============================================================
   MIGRAÇÃO DE VEÍCULOS ANTIGOS
   ============================================================ */

function migrateVehicles() {
  let changed = false;

  vehicles = vehicles.map(vehicle => {
    const v = { ...vehicle };

    if (typeof v.capacityKg === "undefined") {
      /*
       * Compatibilidade com veículos cadastrados na V1.
       *
       * Se o usuário ainda não cadastrou capacidade em kg,
       * o sistema não bloqueará a carga por peso.
       */
      v.capacityKg = null;
      changed = true;
    }

    if (typeof v.minVolumeLiters === "undefined") {
      v.minVolumeLiters = 0;
      changed = true;
    }

    return v;
  });

  if (changed) saveVehicles();
}

migrateVehicles();

/* ============================================================
   PERSISTÊNCIA
   ============================================================ */

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function saveVehicles() {
  localStorage.setItem(
    VEHICLES_STORAGE_KEY,
    JSON.stringify(vehicles)
  );
}

function saveRoutes() {
  localStorage.setItem(
    ROUTES_STORAGE_KEY,
    JSON.stringify(routes)
  );
}

/* ============================================================
   IDs
   ============================================================ */

function nextId() {
  const year = new Date().getFullYear();

  const numbers = requests
    .map(r => Number((r.id || "").split("-").pop()))
    .filter(Number.isFinite);

  const next =
    (Math.max(0, ...numbers) + 1)
      .toString()
      .padStart(6, "0");

  return `SOL-${year}-${next}`;
}

function nextRouteId() {
  const year = new Date().getFullYear();

  const numbers = routes
    .map(r => Number((r.id || "").split("-").pop()))
    .filter(Number.isFinite);

  const next =
    (Math.max(0, ...numbers) + 1)
      .toString()
      .padStart(6, "0");

  return `ROT-${year}-${next}`;
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

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
  return String(status)
    .replaceAll(" ", "-")
    .replaceAll("Á", "A")
    .replaceAll("Ã", "A")
    .replaceAll("É", "E")
    .replaceAll("Ê", "E")
    .replaceAll("Í", "I")
    .replaceAll("Ó", "O")
    .replaceAll("Ô", "O")
    .replaceAll("Ú", "U");
}

function statusBadge(status) {
  return `
    <span class="status status-${statusClass(
      escapeHTML(status)
    )}">
      ${escapeHTML(status)}
    </span>
  `;
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return "—";

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  return `${km.toFixed(1).replace(".", ",")} km`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "—";

  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours <= 0) {
    return `${mins} min`;
  }

  return `${hours}h${String(mins).padStart(2, "0")}`;
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */

function checkPublicURL() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("form") === "public") {
    document.body.classList.add("public-mode");

    const container =
      document.getElementById("publicFormContainer");

    if (container) {
      container.innerHTML =
        buildFormHTML("publicForm");

      initFormEvents("publicForm");
    }

    showSection("public-form-section");
    return true;
  }

  document.body.classList.remove("public-mode");
  return false;
}

function showSection(sectionId) {
  document
    .querySelectorAll(".section")
    .forEach(s =>
      s.classList.remove("active-section")
    );

  document
    .querySelectorAll(".nav-item")
    .forEach(b =>
      b.classList.remove("active")
    );

  const targetSection =
    document.getElementById(sectionId);

  if (targetSection) {
    targetSection.classList.add("active-section");
  }

  const navBtn =
    document.querySelector(
      `.nav-item[data-section="${sectionId}"]`
    );

  if (navBtn) {
    navBtn.classList.add("active");
  }

  document
    .getElementById("sidebar")
    ?.classList.remove("open");

  if (sectionId === "dashboard") {
    renderDashboard();
  }

  if (sectionId === "solicitacoes") {
    renderRequests();
  }

  if (sectionId === "veiculos") {
    renderVehicles();
  }

  if (sectionId === "rotas") {
    renderRoutes();
  }

  if (sectionId === "clientes") {
    renderClients();
  }
}

/* ============================================================
   FORMULÁRIO
   ============================================================ */

function buildFormHTML(formId) {
  return `
    <form id="${formId}" class="simplified-form">

      <div class="form-group-block">
        <span class="form-block-title">
          1. Dados do Solicitante
        </span>

        <label class="form-label">
          Nome Completo *
          <input
            name="name"
            required
            maxlength="100"
            placeholder="Digite seu nome completo"
            class="big-input"
          >
        </label>

        <label class="form-label">
          Telefone de Contato (WhatsApp) *
          <input
            name="phone"
            required
            inputmode="numeric"
            maxlength="15"
            placeholder="(88) 99999-9999"
            class="big-input phone-mask"
          >
        </label>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">
          2. Tipo de Localidade
        </span>

        <label class="form-label">
          Selecione o tipo de local para a coleta *
          <select
            name="type"
            required
            class="big-select type-select"
          >
            <option value="Residência">
              Residência
            </option>

            <option value="Estabelecimento">
              Estabelecimento Comercial / Empresa
            </option>

            <option value="Evento">
              Evento Público ou Privado
            </option>

            <option value="Condomínio">
              Condomínio Residencial / Comercial
            </option>

            <option value="Outro">
              Outro
            </option>
          </select>
        </label>

        <div class="custom-location-wrap hidden">
          <label class="form-label">
            Nome do Estabelecimento / Local / Evento *
            <input
              name="customLocationName"
              placeholder="Informe o nome da empresa ou local"
              class="big-input"
            >
          </label>
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">
          3. Localização Exata
        </span>

        <label class="form-label">
          Selecione o ponto exato no mapa abaixo *
        </label>

        <p class="map-instruction">
          Clique ou toque no mapa para definir a posição
          onde os resíduos estarão disponíveis.
        </p>

        <button
          type="button"
          class="geo-btn"
        >
          Usar minha localização atual
        </button>

        <div
          class="map-container"
          id="map-${formId}"
        ></div>

        <div class="coords-display">
          <span>Coordenadas Geográficas:</span>

          <strong class="coords-text">
            Nenhum ponto marcado no mapa
          </strong>

          <input
            type="hidden"
            name="latitude"
            required
          >

          <input
            type="hidden"
            name="longitude"
            required
          >
        </div>
      </div>

      <div class="form-group-block">
        <span class="form-block-title">
          4. Resíduos para Coleta
        </span>

        <label class="form-label">
          Selecione os tipos de materiais recicláveis disponíveis *
        </label>

        <div class="materials-grid">
          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Papel"
            >
            Papel
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Papelão"
            >
            Papelão
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Vidro"
            >
            Vidro
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Metal"
            >
            Metal / Latas
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Plástico"
            >
            Plástico / PET
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              value="Eletrônicos"
            >
            Eletrônicos
          </label>

          <label class="material-checkbox">
            <input
              type="checkbox"
              name="materials_list"
              id="otherMaterialCheckbox"
              value="Outros"
            >
            Outros
          </label>
        </div>

        <div
          id="otherMaterialWrap"
          class="hidden"
          style="margin-top:12px;"
        >
          <label class="form-label">
            Qual resíduo? Especificar: *
            <input
              name="otherMaterialText"
              id="otherMaterialText"
              placeholder="Ex: Óleo de cozinha usado, Baterias..."
              class="big-input"
            >
          </label>
        </div>
      </div>

      <div class="form-group-block row-group">

        <label class="form-label flex-1">
          Quantidade Estimada *
          <input
            name="quantity"
            type="number"
            step="0.1"
            min="1"
            required
            placeholder="Ex: 50"
            class="big-input"
          >
        </label>

        <label class="form-label flex-1">
          Unidade de Medida *
          <select
            name="unit"
            required
            class="big-select"
          >
            <option value="Kg">
              Kg (Quilogramas)
            </option>

            <option value="Sacos de 100L">
              Sacos de 100 Litros
            </option>

            <option value="BigBags">
              BigBags
            </option>

            <option value="Caixas">
              Caixas
            </option>

            <option value="Bombonas">
              Bombonas
            </option>
          </select>
        </label>

      </div>

      <div class="form-group-block">

        <span class="form-block-title">
          6. Frequência e Agendamento da Coleta
        </span>

        <label class="form-label">
          Com que frequência a coleta deve acontecer? *

          <select
            name="frequency"
            id="frequencySelect"
            required
            class="big-select"
          >
            <option value="">
              Selecione a periodicidade...
            </option>

            <option value="Única">
              Coleta Pontual (Uma única vez)
            </option>

            <option value="Diária">
              Uma vez por dia (Diária)
            </option>

            <option value="Semanal">
              Uma vez por semana
            </option>

            <option value="Quinzenal">
              Uma vez a cada 15 dias (Quinzenal)
            </option>

            <option value="Mensal">
              Uma vez no mês (Mensal)
            </option>
          </select>
        </label>

        <div
          id="singleDateWrap"
          class="hidden frequency-subwrap"
        >
          <label class="form-label">
            Data Preferencial para Coleta *
            <input
              type="date"
              name="preferred_date"
              id="preferredDateInput"
              class="big-input"
            >
          </label>
        </div>

        <div
          id="weeklyDaysWrap"
          class="hidden frequency-subwrap"
        >
          <label class="form-label">
            Dia(s) preferencial(is) da semana para coleta *
          </label>

          <div class="days-grid">
            ${[
              ["Segunda-feira", "Seg"],
              ["Terça-feira", "Ter"],
              ["Quarta-feira", "Quar"],
              ["Quinta-feira", "Quin"],
              ["Sexta-feira", "Sex"],
              ["Sábado", "Sáb"]
            ].map(([value, label]) => `
              <label class="day-checkbox">
                <input
                  type="checkbox"
                  name="preferred_days"
                  value="${value}"
                >
                ${label}
              </label>
            `).join("")}
          </div>
        </div>

        <div
          id="monthlyWrap"
          class="hidden frequency-subwrap row-group"
        >

          <label class="form-label flex-1">
            Qual semana do mês? *

            <select
              name="monthly_week"
              id="monthlyWeekSelect"
              class="big-select"
            >
              <option value="1ª Semana">
                1ª Semana do mês
              </option>

              <option value="2ª Semana">
                2ª Semana do mês
              </option>

              <option value="3ª Semana">
                3ª Semana do mês
              </option>

              <option value="4ª Semana">
                4ª Semana do mês
              </option>
            </select>
          </label>

          <label class="form-label flex-1">
            Em qual dia da semana? *

            <select
              name="monthly_day"
              id="monthlyDaySelect"
              class="big-select"
            >
              <option value="Segunda-feira">
                Segunda-feira
              </option>

              <option value="Terça-feira">
                Terça-feira
              </option>

              <option value="Quarta-feira">
                Quarta-feira
              </option>

              <option value="Quinta-feira">
                Quinta-feira
              </option>

              <option value="Sexta-feira">
                Sexta-feira
              </option>

              <option value="Sábado">
                Sábado
              </option>
            </select>
          </label>

        </div>
      </div>

      <div class="form-group-block">

        <span class="form-block-title">
          7. Observações e Referências
        </span>

        <label class="form-label">
          Ponto de Referência ou Informações Adicionais (Opcional)

          <textarea
            name="notes"
            rows="3"
            placeholder="Exemplo: Material armazenado ao lado da entrada secundária."
            class="big-textarea"
          ></textarea>
        </label>

      </div>

      <button
        class="primary-btn submit-btn"
        type="submit"
      >
        SUBMETER SOLICITAÇÃO DE COLETA
      </button>

    </form>
  `;
}

/* ============================================================
   EVENTOS DO FORMULÁRIO
   ============================================================ */

function initFormEvents(formId) {
  const form = document.getElementById(formId);

  if (!form) return;

  const phoneInput =
    form.querySelector(".phone-mask");

  if (phoneInput) {
    phoneInput.addEventListener("input", e => {
      e.target.value =
        formatPhone(e.target.value);
    });
  }

  const typeSelect =
    form.querySelector(".type-select");

  const customWrap =
    form.querySelector(".custom-location-wrap");

  const customInput =
    customWrap?.querySelector("input");

  if (typeSelect && customWrap) {
    typeSelect.addEventListener("change", () => {

      if (
        typeSelect.value &&
        typeSelect.value !== "Residência"
      ) {
        customWrap.classList.remove("hidden");

        if (customInput) {
          customInput.required = true;
        }

      } else {

        customWrap.classList.add("hidden");

        if (customInput) {
          customInput.required = false;
          customInput.value = "";
        }
      }
    });
  }

  const otherCheckbox =
    form.querySelector("#otherMaterialCheckbox");

  const otherWrap =
    form.querySelector("#otherMaterialWrap");

  const otherInput =
    form.querySelector("#otherMaterialText");

  if (otherCheckbox && otherWrap) {

    otherCheckbox.addEventListener("change", () => {

      if (otherCheckbox.checked) {

        otherWrap.classList.remove("hidden");

        if (otherInput) {
          otherInput.required = true;
        }

      } else {

        otherWrap.classList.add("hidden");

        if (otherInput) {
          otherInput.required = false;
          otherInput.value = "";
        }
      }
    });
  }

  const frequencySelect =
    form.querySelector("#frequencySelect");

  const singleDateWrap =
    form.querySelector("#singleDateWrap");

  const weeklyDaysWrap =
    form.querySelector("#weeklyDaysWrap");

  const monthlyWrap =
    form.querySelector("#monthlyWrap");

  const preferredDateInput =
    form.querySelector("#preferredDateInput");

  if (frequencySelect) {

    if (preferredDateInput) {
      preferredDateInput.min =
        new Date()
          .toISOString()
          .split("T")[0];
    }

    frequencySelect.addEventListener(
      "change",
      () => {

        const val =
          frequencySelect.value;

        singleDateWrap?.classList.add("hidden");
        weeklyDaysWrap?.classList.add("hidden");
        monthlyWrap?.classList.add("hidden");

        if (preferredDateInput) {
          preferredDateInput.required = false;
        }

        if (val === "Única") {

          singleDateWrap?.classList.remove("hidden");

          if (preferredDateInput) {
            preferredDateInput.required = true;
          }

        } else if (
          val === "Semanal" ||
          val === "Quinzenal"
        ) {

          weeklyDaysWrap?.classList.remove("hidden");

        } else if (val === "Mensal") {

          monthlyWrap?.classList.remove("hidden");
        }
      }
    );
  }

  initMap(formId);

  form.addEventListener("submit", e => {

    e.preventDefault();

    const lat =
      form.querySelector(
        'input[name="latitude"]'
      )?.value;

    const lng =
      form.querySelector(
        'input[name="longitude"]'
      )?.value;

    if (!lat || !lng) {
      toast(
        "Por favor, selecione o ponto de localização exato no mapa."
      );
      return;
    }

    let checkedMaterials =
      [
        ...form.querySelectorAll(
          'input[name="materials_list"]:checked'
        )
      ].map(c => c.value);

    if (!checkedMaterials.length) {
      toast(
        "Selecione ao menos um tipo de material para agendar a coleta."
      );
      return;
    }

    if (
      otherCheckbox?.checked &&
      otherInput?.value.trim()
    ) {

      checkedMaterials =
        checkedMaterials.map(m =>
          m === "Outros"
            ? `Outros (${otherInput.value.trim()})`
            : m
        );
    }

    const formData =
      new FormData(form);

    const data =
      Object.fromEntries(formData.entries());

    const freqVal =
      data.frequency;

    let frequencyText =
      freqVal;

    if (freqVal === "Única") {

      if (!data.preferred_date) {
        toast(
          "Por favor, selecione a data preferencial para a coleta única."
        );
        return;
      }

      const formattedDate =
        data.preferred_date
          .split("-")
          .reverse()
          .join("/");

      frequencyText =
        `Única (${formattedDate})`;

    } else if (
      freqVal === "Semanal" ||
      freqVal === "Quinzenal"
    ) {

      const selectedDays =
        [
          ...form.querySelectorAll(
            'input[name="preferred_days"]:checked'
          )
        ].map(d => d.value);

      if (!selectedDays.length) {
        toast(
          "Selecione ao menos um dia da semana para a coleta."
        );
        return;
      }

      frequencyText =
        `${freqVal} (${selectedDays.join(", ")})`;

    } else if (freqVal === "Mensal") {

      frequencyText =
        `Mensal (${data.monthly_week} - ${data.monthly_day})`;
    }

    const request = {
      id: nextId(),
      name: data.name,
      phone: data.phone,
      type: data.type,

      customLocationName:
        data.type !== "Residência"
          ? data.customLocationName
          : "",

      latitude: data.latitude,
      longitude: data.longitude,

      materials:
        checkedMaterials.join(", "),

      quantity: data.quantity,
      unit: data.unit,
      frequency: frequencyText,

      notes:
        data.notes || "",

      status: "NOVA",

      createdAt:
        new Date().toISOString()
    };

    requests.push(request);
    save();

    if (
      document.body.classList.contains(
        "public-mode"
      )
    ) {

      form.innerHTML = `
        <div class="success-screen">

          <h2>
            Solicitação Registrada com Sucesso
          </h2>

          <p>
            O seu pedido foi protocolado sob o número:
            <strong>${escapeHTML(request.id)}</strong>
          </p>

          <p>
            A equipe da
            <strong>Associação Sol Nascente</strong>
            em parceria com a
            <strong>Inciclo</strong>
            e
            <strong>Recicle+ Trairi</strong>
            analisará a solicitação e entrará em contato
            para confirmação.
          </p>

          <button
            class="primary-btn"
            type="button"
            onclick="window.location.reload()"
          >
            Registrar Nova Solicitação
          </button>

        </div>
      `;

    } else {

      closeModal();
      renderDashboard();

      toast(
        `Solicitação ${request.id} registrada com sucesso.`
      );
    }
  });
}

/* ============================================================
   MAPA
   ============================================================ */

function initMap(formId) {

  const mapElement =
    document.getElementById(
      `map-${formId}`
    );

  if (!mapElement) return;

  const defaultLat =
    ROUTING_CONFIG.depot.lat;

  const defaultLng =
    ROUTING_CONFIG.depot.lng;

  setTimeout(() => {

    if (typeof L === "undefined") {
      console.error(
        "A biblioteca Leaflet.js não foi carregada."
      );
      return;
    }

    const map =
      L.map(mapElement).setView(
        [defaultLat, defaultLng],
        14
      );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          "© OpenStreetMap"
      }
    ).addTo(map);

    map.invalidateSize();

    let marker = null;

    const form =
      document.getElementById(formId);

    const coordsText =
      form.querySelector(".coords-text");

    const latInput =
      form.querySelector(
        'input[name="latitude"]'
      );

    const lngInput =
      form.querySelector(
        'input[name="longitude"]'
      );

    function setLocation(lat, lng) {

      if (marker) {
        map.removeLayer(marker);
      }

      marker =
        L.marker([lat, lng])
          .addTo(map);

      marker
        .bindPopup(
          "Ponto de Coleta Selecionado"
        )
        .openPopup();

      latInput.value =
        lat.toFixed(6);

      lngInput.value =
        lng.toFixed(6);

      coordsText.textContent =
        `Latitude: ${lat.toFixed(5)} | Longitude: ${lng.toFixed(5)}`;
    }

    map.on("click", e => {
      setLocation(
        e.latlng.lat,
        e.latlng.lng
      );
    });

    const geoBtn =
      form.querySelector(".geo-btn");

    if (geoBtn) {

      geoBtn.addEventListener(
        "click",
        () => {

          if (!navigator.geolocation) {
            toast(
              "A geolocalização não é suportada por este navegador."
            );
            return;
          }

          geoBtn.textContent =
            "Obtendo coordenadas...";

          navigator.geolocation.getCurrentPosition(

            pos => {

              const lat =
                pos.coords.latitude;

              const lng =
                pos.coords.longitude;

              map.setView(
                [lat, lng],
                17
              );

              setLocation(
                lat,
                lng
              );

              geoBtn.textContent =
                "Localização Atualizada";

              setTimeout(() => {
                geoBtn.textContent =
                  "Usar minha localização atual";
              }, 3000);
            },

            () => {

              toast(
                "Não foi possível obter a localização exata automaticamente. Por favor, marque manualmente no mapa."
              );

              geoBtn.textContent =
                "Usar minha localização atual";
            },

            {
              enableHighAccuracy: true
            }
          );
        }
      );
    }

  }, 200);
}

/* ============================================================
   MODAIS
   ============================================================ */

function openModal() {

  const container =
    document.getElementById(
      "modalFormContainer"
    );

  if (!container) return;

  container.innerHTML =
    buildFormHTML("modalForm");

  initFormEvents("modalForm");

  document
    .getElementById("requestModal")
    ?.classList.remove("hidden");
}

function closeModal() {

  document
    .getElementById("requestModal")
    ?.classList.add("hidden");

  const container =
    document.getElementById(
      "modalFormContainer"
    );

  if (container) {
    container.innerHTML = "";
  }
}

/* ============================================================
   LINK PÚBLICO
   ============================================================ */

function copyPublicLink() {

  const publicURL =
    `${window.location.origin}${window.location.pathname}?form=public`;

  if (
    navigator.clipboard &&
    navigator.clipboard.writeText
  ) {

    navigator.clipboard
      .writeText(publicURL)
      .then(() => {
        toast(
          "Link do formulário público copiado."
        );
      })
      .catch(() => {
        prompt(
          "Copie o link do formulário público:",
          publicURL
        );
      });

  } else {

    prompt(
      "Copie o link do formulário público:",
      publicURL
    );
  }
}

/* ============================================================
   TOAST
   ============================================================ */

function toast(message) {

  const el =
    document.getElementById("toast");

  if (!el) return;

  el.textContent =
    message;

  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 3500);
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {

  const count =
    s =>
      requests.filter(
        r => r.status === s
      ).length;

  const statNovas =
    document.getElementById(
      "statNovas"
    );

  const statAgendadas =
    document.getElementById(
      "statAgendadas"
    );

  const statEmRota =
    document.getElementById(
      "statEmRota"
    );

  const statFinalizadas =
    document.getElementById(
      "statFinalizadas"
    );

  if (statNovas)
    statNovas.textContent =
      count("NOVA");

  if (statAgendadas)
    statAgendadas.textContent =
      count("AGENDADA");

  if (statEmRota)
    statEmRota.textContent =
      count("EM ROTA");

  if (statFinalizadas)
    statFinalizadas.textContent =
      count("FINALIZADA") +
      count("COLETADA");

  const recent =
    [...requests]
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .slice(0, 6);

  const recentList =
    document.getElementById(
      "recentList"
    );

  if (recentList) {
    recentList.innerHTML =
      tableHTML(
        recent,
        false
      );
  }
}

/* ============================================================
   TABELA DE SOLICITAÇÕES
   ============================================================ */

function tableHTML(
  data,
  withActions = true
) {

  if (!data.length) {
    return `
      <div class="empty-state">
        <h2>
          Nenhuma solicitação encontrada
        </h2>

        <p>
          Não há registros gravados no sistema.
        </p>
      </div>
    `;
  }

  return `
    <table>

      <thead>
        <tr>
          <th>Código</th>
          <th>Solicitante</th>
          <th>Local</th>
          <th>Materiais / Quantidade</th>
          <th>Frequência</th>
          <th>Status</th>

          ${
            withActions
              ? "<th>Ação</th>"
              : ""
          }

        </tr>
      </thead>

      <tbody>

        ${data.map(r => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(r.id)}
              </strong>
            </td>

            <td>

              <a
                href="javascript:void(0)"
                onclick="openClientDetails('${escapeHTML(r.id)}')"
                style="color:var(--navy);font-weight:bold;text-decoration:underline;"
              >
                ${escapeHTML(r.name)}
              </a>

              <br>

              <small>
                Tel:
                ${escapeHTML(r.phone)}
              </small>

            </td>

            <td>

              <strong>
                ${escapeHTML(r.type)}

                ${
                  r.customLocationName
                    ? ` (${escapeHTML(
                        r.customLocationName
                      )})`
                    : ""
                }

              </strong>

              <br>

              <small>

                ${
                  r.latitude &&
                  r.longitude

                    ? `
                      <a
                        href="https://maps.google.com/?q=${r.latitude},${r.longitude}"
                        target="_blank"
                        style="color:var(--orange);font-weight:bold;text-decoration:none;"
                      >
                        Visualizar no Mapa
                      </a>
                    `

                    : "Sem coordenadas"
                }

              </small>

            </td>

            <td>

              ${escapeHTML(r.materials)}

              <br>

              <small>
                <strong>Total:</strong>
                ${escapeHTML(r.quantity || "-")}
                ${escapeHTML(r.unit || "")}
              </small>

            </td>

            <td>
              <small>
                ${escapeHTML(
                  r.frequency ||
                  "Não informada"
                )}
              </small>
            </td>

            <td>
              ${statusBadge(r.status)}
            </td>

            ${
              withActions

                ? `
                  <td>

                    <div
                      style="
                        display:flex;
                        gap:4px;
                        align-items:center;
                      "
                    >

                      <select
                        class="inline-status"
                        data-id="${escapeHTML(r.id)}"
                      >

                        ${
                          [
                            "NOVA",
                            "EM ANÁLISE",
                            "AGENDADA",
                            "EM ROTA",
                            "COLETADA",
                            "FINALIZADA"
                          ]
                            .map(
                              s => `
                                <option
                                  ${
                                    s === r.status
                                      ? "selected"
                                      : ""
                                  }
                                >
                                  ${s}
                                </option>
                              `
                            )
                            .join("")
                        }

                      </select>

                      <button
                        class="btn-icon"
                        onclick="openClientDetails('${escapeHTML(r.id)}')"
                        title="Ver Detalhes"
                      >
                        🔍
                      </button>

                      <button
                        class="btn-icon delete"
                        onclick="deleteClient('${escapeHTML(r.id)}')"
                        title="Excluir"
                      >
                        🗑️
                      </button>

                    </div>

                  </td>
                `
                : ""
            }

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

/* ============================================================
   SOLICITAÇÕES
   ============================================================ */

function renderRequests() {

  const searchInput =
    document.getElementById(
      "searchInput"
    );

  const statusFilter =
    document.getElementById(
      "statusFilter"
    );

  const query =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";

  const status =
    statusFilter
      ? statusFilter.value
      : "";

  const filtered =
    requests.filter(r => {

      const text =
        `${r.id} ${r.name} ${r.phone} ${r.type} ${r.customLocationName} ${r.materials} ${r.frequency}`
          .toLowerCase();

      return (
        (!query ||
          text.includes(query)) &&
        (!status ||
          r.status === status)
      );
    });

  const table =
    document.getElementById(
      "requestsTable"
    );

  if (table) {
    table.innerHTML =
      tableHTML(
        filtered,
        true
      );
  }

  document
    .querySelectorAll(".inline-status")
    .forEach(select => {

      select.addEventListener(
        "change",
        e => {

          const request =
            requests.find(
              r =>
                r.id ===
                e.target.dataset.id
            );

          if (!request) return;

          request.status =
            e.target.value;

          save();

          renderRequests();
          renderDashboard();

          toast(
            "Status atualizado com sucesso."
          );
        }
      );
    });
}

/* ============================================================
   VEÍCULOS
   ============================================================ */

function renderVehicles() {

  const container =
    document.getElementById(
      "vehiclesList"
    );

  if (!container) return;

  if (!vehicles.length) {

    container.innerHTML = `
      <div class="empty-state">

        <h2>
          Nenhum veículo cadastrado
        </h2>

        <p>
          Cadastre triciclos ou caminhões
          para operar as rotas.
        </p>

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
          <th>Capacidade Volumétrica</th>
          <th>Capacidade de Peso</th>
          <th>Volume Mín. de Saída</th>
          <th>Ação</th>
        </tr>

      </thead>

      <tbody>

        ${vehicles.map(v => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(v.id)}
              </strong>
            </td>

            <td>
              ${escapeHTML(v.name)}
            </td>

            <td>
              ${escapeHTML(v.plate)}
            </td>

            <td>
              <strong>
                ${formatNumber(v.capacityLiters)}
                L
              </strong>
            </td>

            <td>

              ${
                v.capacityKg !== null &&
                v.capacityKg !== undefined &&
                v.capacityKg !== ""
                  ? `
                    <strong>
                      ${formatNumber(v.capacityKg)}
                      kg
                    </strong>
                  `
                  : `
                    <span style="color:var(--muted);">
                      Não informado
                    </span>
                  `
              }

            </td>

            <td>
              ${formatNumber(v.minVolumeLiters)}
              L
            </td>

            <td>

              <button
                class="secondary-btn"
                onclick="deleteVehicle('${escapeHTML(v.id)}')"
              >
                Excluir
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}

function deleteVehicle(id) {

  vehicles =
    vehicles.filter(
      v => v.id !== id
    );

  saveVehicles();

  renderVehicles();

  toast(
    "Veículo removido com sucesso."
  );
}

/* ============================================================
   CONVERSÃO DE VOLUME
   ============================================================ */

function getMaterialDensity(
  materialsStr = ""
) {

  const mat =
    materialsStr.toLowerCase();

  if (
    mat.includes("plástico") ||
    mat.includes("plastico") ||
    mat.includes("pet")
  ) {
    return 0.05;
  }

  if (
    mat.includes("papelão") ||
    mat.includes("papelao") ||
    mat.includes("papel")
  ) {
    return 0.10;
  }

  if (
    mat.includes("metal") ||
    mat.includes("latas")
  ) {
    return 0.15;
  }

  if (
    mat.includes("eletrônico") ||
    mat.includes("eletronico")
  ) {
    return 0.25;
  }

  if (
    mat.includes("vidro")
  ) {
    return 0.35;
  }

  // Estimativa genérica
  return 0.15;
}

function convertToLiters(
  quantityStr,
  unitStr,
  materialsStr = ""
) {

  const qty =
    parseFloat(quantityStr) || 0;

  if (qty <= 0) return 0;

  const unit =
    (unitStr || "").toLowerCase();

  if (
    unit.includes("saco")
  ) {
    return qty * 100;
  }

  if (
    unit.includes("bombona")
  ) {
    return qty * 200;
  }

  if (
    unit.includes("bigbag")
  ) {
    return qty * 1000;
  }

  if (
    unit.includes("caixa")
  ) {
    return qty * 50;
  }

  if (
    unit.includes("kg")
  ) {

    const density =
      getMaterialDensity(
        materialsStr
      );

    return qty / density;
  }

  return qty;
}

/* ============================================================
   ESTIMATIVA DE PESO
   ============================================================ */

function estimateWeightKg(
  quantityStr,
  unitStr,
  materialsStr = ""
) {

  const qty =
    parseFloat(quantityStr) || 0;

  if (qty <= 0) return 0;

  const unit =
    (unitStr || "").toLowerCase();

  /*
   * Quando o solicitante informou diretamente em kg,
   * não precisamos estimar.
   */

  if (unit.includes("kg")) {
    return qty;
  }

  const liters =
    convertToLiters(
      qty,
      unitStr,
      materialsStr
    );

  const density =
    getMaterialDensity(
      materialsStr
    );

  return liters * density;
}

/* ============================================================
   DISTÂNCIA HAVERSINE
   ============================================================ */

function haversineKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/* ============================================================
   NORMALIZAÇÃO DE COORDENADAS
   ============================================================ */

function getCoordinates(item) {

  const lat =
    parseFloat(item.latitude);

  const lng =
    parseFloat(item.longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return {
    lat,
    lng
  };
}

/* ============================================================
   DISTÂNCIA ENTRE DOIS PONTOS
   ============================================================ */

function pointDistanceKm(a, b) {

  const ca =
    getCoordinates(a);

  const cb =
    getCoordinates(b);

  if (!ca || !cb) {
    return Infinity;
  }

  return haversineKm(
    ca.lat,
    ca.lng,
    cb.lat,
    cb.lng
  );
}

/* ============================================================
   AGRUPAMENTO GEOGRÁFICO
   ============================================================ */

function groupRequestsByProximity(
  items
) {

  const remaining =
    [...items];

  const groups = [];

  while (remaining.length) {

    const seed =
      remaining.shift();

    const group = [seed];

    let changed = true;

    while (
      changed &&
      remaining.length
    ) {

      changed = false;

      for (
        let i = remaining.length - 1;
        i >= 0;
        i--
      ) {

        const candidate =
          remaining[i];

        const closeToGroup =
          group.some(
            point =>
              pointDistanceKm(
                candidate,
                point
              ) <=
              ROUTING_CONFIG.clusterRadiusKm
          );

        if (closeToGroup) {

          group.push(
            candidate
          );

          remaining.splice(i, 1);

          changed = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/* ============================================================
   SELEÇÃO DE VEÍCULO
   ============================================================ */

function selectVehicleForLoad(
  volume,
  weight,
  availableVehicles
) {

  return (
    [...availableVehicles]
      .filter(vehicle => {

        const capacityL =
          Number(
            vehicle.capacityLiters
          ) || 0;

        const capacityKg =
          Number(
            vehicle.capacityKg
          );

        const volumeFits =
          volume <= capacityL;

        const weightFits =
          !Number.isFinite(
            capacityKg
          ) ||
          capacityKg <= 0 ||
          weight <= capacityKg;

        return (
          volumeFits &&
          weightFits
        );
      })
      .sort(
        (a, b) =>
          a.capacityLiters -
          b.capacityLiters
      )[0] || null
  );
}

/* ============================================================
   VIZINHO MAIS PRÓXIMO
   ============================================================ */

function nearestNeighbor(
  items
) {

  if (!items.length) {
    return [];
  }

  const remaining =
    [...items];

  const ordered = [];

  let current = {
    latitude:
      ROUTING_CONFIG.depot.lat,
    longitude:
      ROUTING_CONFIG.depot.lng
  };

  while (remaining.length) {

    let bestIndex = 0;
    let bestDistance =
      Infinity;

    remaining.forEach(
      (item, index) => {

        const distance =
          pointDistanceKm(
            current,
            item
          );

        if (
          distance <
          bestDistance
        ) {
          bestDistance =
            distance;

          bestIndex =
            index;
        }
      }
    );

    const selected =
      remaining.splice(
        bestIndex,
        1
      )[0];

    ordered.push(
      selected
    );

    current = selected;
  }

  return ordered;
}

/* ============================================================
   2-OPT
   ============================================================ */

function routeDistanceStraightLine(
  route
) {

  if (!route.length) {
    return 0;
  }

  let total = 0;

  let previous = {
    latitude:
      ROUTING_CONFIG.depot.lat,
    longitude:
      ROUTING_CONFIG.depot.lng
  };

  route.forEach(point => {

    total +=
      pointDistanceKm(
        previous,
        point
      );

    previous = point;
  });

  total +=
    pointDistanceKm(
      previous,
      {
        latitude:
          ROUTING_CONFIG.depot.lat,
        longitude:
          ROUTING_CONFIG.depot.lng
      }
    );

  return total;
}

function twoOpt(route) {

  if (route.length < 4) {
    return route;
  }

  let best =
    [...route];

  let bestDistance =
    routeDistanceStraightLine(
      best
    );

  let improved = true;

  while (improved) {

    improved = false;

    for (
      let i = 0;
      i < best.length - 1;
      i++
    ) {

      for (
        let j = i + 1;
        j < best.length;
        j++
      ) {

        const candidate = [
          ...best.slice(0, i),
          ...best
            .slice(i, j + 1)
            .reverse(),
          ...best.slice(j + 1)
        ];

        const candidateDistance =
          routeDistanceStraightLine(
            candidate
          );

        if (
          candidateDistance <
          bestDistance - 0.001
        ) {

          best =
            candidate;

          bestDistance =
            candidateDistance;

          improved = true;
        }
      }
    }
  }

  return best;
}

/* ============================================================
   CÁLCULO DE ROTA VIA OSRM
   ============================================================ */

async function calculateOSRMRoute(
  orderedItems
) {

  const coordinates = [
    {
      lat:
        ROUTING_CONFIG.depot.lat,
      lng:
        ROUTING_CONFIG.depot.lng
    },

    ...orderedItems
      .map(item =>
        getCoordinates(item)
      )
      .filter(Boolean),

    {
      lat:
        ROUTING_CONFIG.depot.lat,
      lng:
        ROUTING_CONFIG.depot.lng
    }
  ];

  if (
    coordinates.length < 2
  ) {
    return null;
  }

  const coordinateString =
    coordinates
      .map(
        c =>
          `${c.lng},${c.lat}`
      )
      .join(";");

  const url =
    `${ROUTING_CONFIG.osrmUrl}${coordinateString}?overview=false&steps=false`;

  try {

    const response =
      await fetch(url);

    if (!response.ok) {
      throw new Error(
        `OSRM HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      data.code !== "Ok" ||
      !data.routes?.length
    ) {
      throw new Error(
        "OSRM não retornou rota."
      );
    }

    const route =
      data.routes[0];

    return {
      distanceKm:
        route.distance / 1000,

      durationMinutes:
        route.duration / 60,

      source:
        "OSRM"
    };

  } catch (error) {

    console.warn(
      "OSRM indisponível. Utilizando fallback.",
      error
    );

    return null;
  }
}

/* ============================================================
   FALLBACK DE ROTA
   ============================================================ */

function calculateFallbackRoute(
  orderedItems
) {

  const distanceKm =
    routeDistanceStraightLine(
      orderedItems
    ) * 1.25;

  const drivingMinutes =
    distanceKm /
    ROUTING_CONFIG.averageSpeedKmH *
    60;

  const serviceMinutes =
    orderedItems.length *
    ROUTING_CONFIG.serviceMinutesPerStop;

  return {
    distanceKm,
    durationMinutes:
      drivingMinutes +
      serviceMinutes,
    source:
      "Estimativa"
  };
}

/* ============================================================
   DISTRIBUIÇÃO DAS CARGAS
   ============================================================ */

function prepareRouteItems(
  items
) {

  return items.map(item => {

    const totalLiters =
      convertToLiters(
        item.quantity,
        item.unit,
        item.materials
      );

    const totalWeightKg =
      estimateWeightKg(
        item.quantity,
        item.unit,
        item.materials
      );

    return {
      ...item,

      totalLiters,
      totalWeightKg,

      remainingLiters:
        totalLiters,

      remainingWeightKg:
        totalWeightKg
    };
  });
}

/* ============================================================
   CRIAÇÃO DOS GRUPOS DE CARGA
   ============================================================ */

function createVehicleTrips(
  items,
  vehicle
) {

  const trips = [];

  let currentTrip = {
    tripNumber: 1,
    items: [],
    usedLiters: 0,
    usedKg: 0
  };

  const capacityLiters =
    Number(
      vehicle.capacityLiters
    ) || 0;

  const capacityKg =
    Number(
      vehicle.capacityKg
    );

  items.forEach(item => {

    while (
      item.remainingLiters > 0.001
    ) {

      const spaceLiters =
        capacityLiters -
        currentTrip.usedLiters;

      let spaceKg =
        Infinity;

      if (
        Number.isFinite(capacityKg) &&
        capacityKg > 0
      ) {

        spaceKg =
          capacityKg -
          currentTrip.usedKg;
      }

      if (
        spaceLiters <= 0.001 ||
        spaceKg <= 0.001
      ) {

        if (
          currentTrip.items.length
        ) {
          trips.push(
            currentTrip
          );
        }

        currentTrip = {
          tripNumber:
            trips.length + 1,

          items: [],

          usedLiters: 0,

          usedKg: 0
        };

        continue;
      }

      /*
       * Calcula quanto pode ser carregado
       * considerando simultaneamente volume e peso.
       */

      let allocatedLiters =
        Math.min(
          item.remainingLiters,
          spaceLiters
        );

      let allocatedKg =
        item.totalLiters > 0
          ? item.totalWeightKg *
            (
              allocatedLiters /
              item.totalLiters
            )
          : 0;

      if (
        Number.isFinite(spaceKg) &&
        allocatedKg > spaceKg &&
        item.totalWeightKg > 0
      ) {

        allocatedKg =
          spaceKg;

        allocatedLiters =
          item.totalWeightKg > 0
            ? allocatedKg /
              (
                item.totalWeightKg /
                item.totalLiters
              )
            : 0;
      }

      if (
        allocatedLiters <= 0.001
      ) {
        break;
      }

      const allocation = {
        ...item,

        allocatedLiters,

        allocatedWeightKg:
          allocatedKg,

        isPartial:
          allocatedLiters <
          item.totalLiters - 0.001
      };

      currentTrip.items.push(
        allocation
      );

      currentTrip.usedLiters +=
        allocatedLiters;

      currentTrip.usedKg +=
        allocatedKg;

      item.remainingLiters -=
        allocatedLiters;

      item.remainingWeightKg -=
        allocatedKg;

      if (
        currentTrip.usedLiters >=
          capacityLiters - 0.001 ||
        (
          Number.isFinite(capacityKg) &&
          capacityKg > 0 &&
          currentTrip.usedKg >=
            capacityKg - 0.001
        )
      ) {

        trips.push(
          currentTrip
        );

        currentTrip = {
          tripNumber:
            trips.length + 1,

          items: [],

          usedLiters: 0,

          usedKg: 0
        };
      }
    }
  });

  if (
    currentTrip.items.length
  ) {
    trips.push(
      currentTrip
    );
  }

  return trips;
}

/* ============================================================
   GERAÇÃO DE UMA ROTA
   ============================================================ */

async function buildTripRoute(
  trip
) {

  const uniqueItems = [];

  const seen = new Set();

  trip.items.forEach(item => {

    /*
     * Caso uma solicitação tenha sido
     * fracionada, cada parada continua
     * sendo identificada pelo ID.
     */

    const key =
      `${item.id}-${Math.round(item.allocatedLiters)}`;

    if (!seen.has(key)) {

      seen.add(key);

      uniqueItems.push(
        item
      );
    }
  });

  const nearest =
    nearestNeighbor(
      uniqueItems
    );

  const optimized =
    twoOpt(nearest);

  let routeInfo =
    await calculateOSRMRoute(
      optimized
    );

  if (!routeInfo) {

    routeInfo =
      calculateFallbackRoute(
        optimized
      );
  }

  return {
    ...trip,

    orderedItems:
      optimized,

    distanceKm:
      routeInfo.distanceKm,

    durationMinutes:
      routeInfo.durationMinutes,

    routingSource:
      routeInfo.source
  };
}

/* ============================================================
   GERAÇÃO COMPLETA DO PLANO
   ============================================================ */

async function generateRoutes() {

  const today =
    new Date();

  const todayPoints =
    requests.filter(
      request =>
        request.status ===
          "AGENDADA" &&
        requestIsScheduledToday(
          request,
          today
        )
    );

  if (!todayPoints.length) {
    return {
      routes: [],
      unassigned: []
    };
  }

  const prepared =
    prepareRouteItems(
      todayPoints
    );

  /*
   * Primeiro identifica solicitações
   * que não cabem em nenhum veículo.
   */

  const unassigned = [];

  const assignable = [];

  prepared.forEach(item => {

    const vehicle =
      selectVehicleForLoad(
        item.totalLiters,
        item.totalWeightKg,
        vehicles
      );

    if (!vehicle) {

      unassigned.push(
        item
      );

    } else {

      assignable.push(
        item
      );
    }
  });

  /*
   * Agrupamento geográfico.
   */

  const geographicGroups =
    groupRequestsByProximity(
      assignable
    );

  const generatedRoutes = [];

  /*
   * Dentro de cada grupo geográfico,
   * organiza as solicitações por proximidade.
   */

  for (
    const group of geographicGroups
  ) {

    const orderedGroup =
      nearestNeighbor(
        group
      );

    /*
     * Tenta usar o menor veículo capaz
     * de atender cada carga.
     */

    let remaining =
      [...orderedGroup];

    while (remaining.length) {

      let vehicle =
        null;

      let selectedItems = [];

      /*
       * Prioriza o menor veículo
       * capaz de levar pelo menos uma
       * solicitação.
       */

      const candidateVehicles =
        [...vehicles].sort(
          (a, b) =>
            a.capacityLiters -
            b.capacityLiters
        );

      for (
        const candidate of
        candidateVehicles
      ) {

        const capacityL =
          Number(
            candidate.capacityLiters
          ) || 0;

        const capacityKg =
          Number(
            candidate.capacityKg
          );

        let usedL = 0;
        let usedKg = 0;

        const candidateItems = [];

        for (
          const item of remaining
        ) {

          if (
            usedL +
              item.totalLiters >
            capacityL
          ) {
            continue;
          }

          if (
            Number.isFinite(
              capacityKg
            ) &&
            capacityKg > 0 &&
            usedKg +
              item.totalWeightKg >
            capacityKg
          ) {
            continue;
          }

          candidateItems.push(
            item
          );

          usedL +=
            item.totalLiters;

          usedKg +=
            item.totalWeightKg;
        }

        if (
          candidateItems.length
        ) {

          vehicle =
            candidate;

          selectedItems =
            candidateItems;

          break;
        }
      }

      /*
       * Se nenhuma combinação completa couber,
       * utiliza o maior veículo disponível
       * para fracionamento.
       */

      if (!vehicle) {

        vehicle =
          [...vehicles].sort(
            (a, b) =>
              b.capacityLiters -
              a.capacityLiters
          )[0];

        if (!vehicle) {
          unassigned.push(
            ...remaining
          );
          break;
        }

        selectedItems =
          [remaining[0]];
      }

      const workingItems =
        prepareRouteItems(
          selectedItems
        );

      const trips =
        createVehicleTrips(
          workingItems,
          vehicle
        );

      for (
        const trip of trips
      ) {

        const route =
          await buildTripRoute(
            trip
          );

        generatedRoutes.push({
          id:
            nextRouteId(),

          createdAt:
            new Date().toISOString(),

          date:
            today.toISOString()
              .split("T")[0],

          status:
            "PLANEJADA",

          vehicleId:
            vehicle.id,

          vehicleName:
            vehicle.name,

          vehiclePlate:
            vehicle.plate,

          capacityLiters:
            Number(
              vehicle.capacityLiters
            ) || 0,

          capacityKg:
            Number(
              vehicle.capacityKg
            ) || null,

          ...route
        });
      }

      const selectedIds =
        new Set(
          selectedItems.map(
            item => item.id
          )
        );

      remaining =
        remaining.filter(
          item =>
            !selectedIds.has(
              item.id
            )
        );
    }
  }

  return {
    routes:
      generatedRoutes,

    unassigned
  };
}

/* ============================================================
   VERIFICAÇÃO DE AGENDAMENTO
   ============================================================ */

function requestIsScheduledToday(
  request,
  date = new Date()
) {

  if (!request.frequency) {
    return false;
  }

  const frequency =
    request.frequency;

  const dayNames = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado"
  ];

  const currentDay =
    dayNames[
      date.getDay()
    ];

  const dateBR =
    date.toLocaleDateString(
      "pt-BR"
    );

  /*
   * Única
   */

  if (
    frequency.includes("Única")
  ) {

    return frequency.includes(
      dateBR
    );
  }

  /*
   * Diária
   */

  if (
    frequency.includes("Diária")
  ) {
    return true;
  }

  /*
   * Semanal
   */

  if (
    frequency.includes("Semanal")
  ) {

    return frequency.includes(
      currentDay
    );
  }

  /*
   * Quinzenal
   *
   * Como o cadastro atual guarda
   * apenas os dias da semana, fazemos
   * uma verificação aproximada de 14 dias.
   */

  if (
    frequency.includes("Quinzenal")
  ) {

    const match =
      frequency.match(
        /\((.*?)\)/
      );

    if (!match) {
      return false;
    }

    const days =
      match[1]
        .split(",")
        .map(
          d => d.trim()
        );

    if (
      !days.includes(
        currentDay
      )
    ) {
      return false;
    }

    const dayOfYear =
      getDayOfYear(date);

    return (
      Math.floor(
        dayOfYear / 7
      ) % 2 === 0
    );
  }

  /*
   * Mensal
   */

  if (
    frequency.includes("Mensal")
  ) {

    const match =
      frequency.match(
        /\((.*?)\s*-\s*(.*?)\)/
      );

    if (!match) {
      return false;
    }

    const weekText =
      match[1].trim();

    const dayText =
      match[2].trim();

    if (
      dayText !==
      currentDay
    ) {
      return false;
    }

    const week =
      Math.ceil(
        date.getDate() / 7
      );

    const weekMap = {
      "1ª Semana": 1,
      "2ª Semana": 2,
      "3ª Semana": 3,
      "4ª Semana": 4
    };

    return (
      weekMap[weekText] ===
      week
    );
  }

  return false;
}

function getDayOfYear(date) {

  const start =
    new Date(
      date.getFullYear(),
      0,
      0
    );

  const diff =
    date -
    start;

  return Math.floor(
    diff /
      86400000
  );
}

/* ============================================================
   RENDERIZAÇÃO DAS ROTAS
   ============================================================ */

async function renderRoutes() {

  const container =
    document.getElementById(
      "routesByVehicleContainer"
    );

  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">

      <h2>
        🚚 Calculando rotas...
      </h2>

      <p>
        O sistema está agrupando as solicitações,
        analisando os veículos e otimizando a sequência.
      </p>

    </div>
  `;

  try {

    const result =
      await generateRoutes();

    if (
      !result.routes.length &&
      !result.unassigned.length
    ) {

      const today =
        new Date();

      const weekdays = [
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"
      ];

      const currentDayName =
        weekdays[
          today.getDay()
        ];

      container.innerHTML = `
        <div class="empty-state">

          <h2>
            Nenhuma Coleta Programada para Hoje
          </h2>

          <p>
            Hoje é ${currentDayName}.
            Não há coletas AGENDADAS
            para esta data.
          </p>

        </div>
      `;

      return;
    }

    /*
     * Guarda o plano atual em memória.
     * Não salva automaticamente como rota definitiva,
     * porque o gestor ainda precisa despachar.
     */

    window.currentGeneratedRoutes =
      result.routes;

    let html = "";

    /*
     * RESUMO
     */

    const totalStops =
      result.routes.reduce(
        (sum, route) =>
          sum +
          (route.orderedItems?.length || 0),
        0
      );

    const totalDistance =
      result.routes.reduce(
        (sum, route) =>
          sum +
          (route.distanceKm || 0),
        0
      );

    const totalVolume =
      result.routes.reduce(
        (sum, route) =>
          sum +
          (route.usedLiters || 0),
        0
      );

    html += `

      <div
        class="panel"
        style="margin-bottom:20px;"
      >

        <div class="panel-heading">

          <div>

            <h2>
              📊 Planejamento de Coletas
            </h2>

            <p>
              ${formatNumber(totalStops)}
              paradas •
              ${formatNumber(
                result.routes.length
              )}
              rotas •
              ${formatDistance(
                totalDistance
              )}
            </p>

          </div>

          <button
            class="primary-btn"
            onclick="dispatchGeneratedRoutes()"
          >
            🚀 DESPACHAR ROTAS
          </button>

        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(150px,1fr));
            gap:12px;
            margin-top:15px;
          "
        >

          <div class="detail-item">
            <span>Solicitações</span>
            <strong>
              ${formatNumber(totalStops)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Rotas</span>
            <strong>
              ${formatNumber(
                result.routes.length
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Distância Total</span>
            <strong>
              ${formatDistance(
                totalDistance
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Volume Total</span>
            <strong>
              ${formatNumber(
                totalVolume
              )}
              L
            </strong>
          </div>

        </div>

      </div>
    `;

    /*
     * ROTAS
     */

    result.routes.forEach(
      route => {

        const capacityL =
          Number(
            route.capacityLiters
          ) || 0;

        const usedL =
          Number(
            route.usedLiters
          ) || 0;

        const occupancy =
          capacityL > 0
            ? (
                usedL /
                capacityL
              ) * 100
            : 0;

        const mapUrl =
          buildGoogleMapsUrl(
            route.orderedItems
          );

        html += `

          <div
            class="panel"
            style="
              margin-bottom:20px;
            "
          >

            <div class="panel-heading">

              <div>

                <h2>
                  🚚
                  ${escapeHTML(
                    route.vehicleName
                  )}

                  ${
                    route.vehiclePlate
                      ? `(${escapeHTML(
                          route.vehiclePlate
                        )})`
                      : ""
                  }
                </h2>

                <p>
                  Rota:
                  <strong>
                    ${escapeHTML(
                      route.id
                    )}
                  </strong>
                </p>

              </div>

              <div
                style="
                  display:flex;
                  gap:8px;
                  flex-wrap:wrap;
                "
              >

                <button
                  class="secondary-btn"
                  onclick="window.open('${mapUrl}','_blank')"
                >
                  🗺️ MAPA
                </button>

                <button
                  class="secondary-btn"
                  onclick="reoptimizeRoute('${route.id}')"
                >
                  🔄 REOTIMIZAR
                </button>

              </div>

            </div>

            <div
              style="
                margin:15px 0;
                display:grid;
                grid-template-columns:
                  repeat(auto-fit,minmax(150px,1fr));
                gap:10px;
              "
            >

              <div class="detail-item">
                <span>Volume</span>
                <strong>
                  ${formatNumber(
                    usedL
                  )}
                  /
                  ${formatNumber(
                    capacityL
                  )}
                  L
                </strong>
              </div>

              <div class="detail-item">
                <span>Ocupação</span>
                <strong>
                  ${occupancy.toFixed(1)}%
                </strong>
              </div>

              <div class="detail-item">
                <span>Peso</span>
                <strong>
                  ${formatNumber(
                    route.usedKg || 0
                  )}
                  kg
                </strong>
              </div>

              <div class="detail-item">
                <span>Distância</span>
                <strong>
                  ${formatDistance(
                    route.distanceKm
                  )}
                </strong>
              </div>

              <div class="detail-item">
                <span>Tempo estimado</span>
                <strong>
                  ${formatDuration(
                    route.durationMinutes
                  )}
                </strong>
              </div>

              <div class="detail-item">
                <span>Cálculo</span>
                <strong>
                  ${escapeHTML(
                    route.routingSource
                  )}
                </strong>
              </div>

            </div>

            <div
              style="
                overflow-x:auto;
              "
            >

              <table>

                <thead>

                  <tr>
                    <th>Seq.</th>
                    <th>Código</th>
                    <th>Solicitante</th>
                    <th>Local</th>
                    <th>Materiais</th>
                    <th>Volume</th>
                    <th>Peso</th>
                  </tr>

                </thead>

                <tbody>

                  ${
                    route.orderedItems
                      .map(
                        (item, index) => `
                          <tr>

                            <td>
                              <strong>
                                ${index + 1}
                              </strong>
                            </td>

                            <td>
                              <strong>
                                ${escapeHTML(
                                  item.id
                                )}
                              </strong>
                            </td>

                            <td>
                              ${escapeHTML(
                                item.name
                              )}
                            </td>

                            <td>
                              ${escapeHTML(
                                item.type
                              )}

                              ${
                                item.customLocationName
                                  ? `<br><small>
                                      ${escapeHTML(
                                        item.customLocationName
                                      )}
                                    </small>`
                                  : ""
                              }
                            </td>

                            <td>
                              ${escapeHTML(
                                item.materials
                              )}
                            </td>

                            <td>

                              <strong>
                                ${formatNumber(
                                  item.allocatedLiters
                                )}
                                L
                              </strong>

                              ${
                                item.isPartial
                                  ? `
                                    <br>
                                    <small
                                      style="
                                        color:var(--orange);
                                        font-weight:bold;
                                      "
                                    >
                                      Carga fracionada
                                    </small>
                                  `
                                  : ""
                              }

                            </td>

                            <td>
                              ${formatNumber(
                                item.allocatedWeightKg,
                                1
                              )}
                              kg
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  }

                </tbody>

              </table>

            </div>

          </div>

        `;
      }
    );

    /*
     * NÃO ATRIBUÍDOS
     */

    if (
      result.unassigned.length
    ) {

      html += `

        <div
          class="panel"
          style="
            border-color:var(--orange);
            margin-bottom:20px;
          "
        >

          <h2
            style="
              color:var(--orange);
            "
          >
            ⚠️ Solicitações que não cabem nos veículos
          </h2>

          <p>
            O sistema identificou solicitações cuja
            carga estimada excede simultaneamente
            a capacidade volumétrica e/ou de peso
            dos veículos cadastrados.
          </p>

          <div
            style="
              margin-top:12px;
              overflow-x:auto;
            "
          >

            <table>

              <thead>

                <tr>
                  <th>Código</th>
                  <th>Solicitante</th>
                  <th>Volume estimado</th>
                  <th>Peso estimado</th>
                </tr>

              </thead>

              <tbody>

                ${result.unassigned
                  .map(
                    item => `
                      <tr>

                        <td>
                          <strong>
                            ${escapeHTML(
                              item.id
                            )}
                          </strong>
                        </td>

                        <td>
                          ${escapeHTML(
                            item.name
                          )}
                        </td>

                        <td>
                          ${formatNumber(
                            item.totalLiters
                          )}
                          L
                        </td>

                        <td>
                          ${formatNumber(
                            item.totalWeightKg,
                            1
                          )}
                          kg
                        </td>

                      </tr>
                    `
                  )
                  .join("")}

              </tbody>

            </table>

          </div>

        </div>
      `;
    }

    container.innerHTML =
      html;

  } catch (error) {

    console.error(
      "Erro ao gerar rotas:",
      error
    );

    container.innerHTML = `

      <div
        class="empty-state"
        style="
          border:1px solid var(--orange);
        "
      >

        <h2>
          ⚠️ Erro ao calcular as rotas
        </h2>

        <p>
          ${escapeHTML(
            error.message ||
            "Erro desconhecido."
          )}
        </p>

        <button
          class="primary-btn"
          onclick="renderRoutes()"
        >
          Tentar novamente
        </button>

      </div>
    `;
  }
}

/* ============================================================
   GOOGLE MAPS
   ============================================================ */

function buildGoogleMapsUrl(
  orderedItems
) {

  const points = [
    {
      lat:
        ROUTING_CONFIG.depot.lat,
      lng:
        ROUTING_CONFIG.depot.lng
    },

    ...orderedItems
      .map(item =>
        getCoordinates(item)
      )
      .filter(Boolean),

    {
      lat:
        ROUTING_CONFIG.depot.lat,
      lng:
        ROUTING_CONFIG.depot.lng
    }
  ];

  if (points.length < 2) {
    return "https://www.google.com/maps";
  }

  const origin =
    `${points[0].lat},${points[0].lng}`;

  const destination =
    `${points[
      points.length - 1
    ].lat},${points[
      points.length - 1
    ].lng}`;

  const waypoints =
    points
      .slice(1, -1)
      .map(
        p =>
          `${p.lat},${p.lng}`
      )
      .join("|");

  let url =
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;

  if (waypoints) {
    url +=
      `&waypoints=${encodeURIComponent(
        waypoints
      )}`;
  }

  return url;
}

/* ============================================================
   DESPACHO
   ============================================================ */

function dispatchGeneratedRoutes() {

  const generated =
    window.currentGeneratedRoutes;

  if (
    !generated ||
    !generated.length
  ) {
    toast(
      "Não existem rotas calculadas para despachar."
    );
    return;
  }

  const confirmDispatch =
    confirm(
      `Deseja despachar ${generated.length} rota(s)?\n\nAs solicitações serão alteradas para EM ROTA.`
    );

  if (!confirmDispatch) {
    return;
  }

  generated.forEach(route => {

    const storedRoute = {
      ...route,

      status:
        "EM ROTA",

      dispatchedAt:
        new Date().toISOString()
    };

    routes.push(
      storedRoute
    );

    route.orderedItems.forEach(
      item => {

        const request =
          requests.find(
            r =>
              r.id === item.id
          );

        if (request) {
          request.status =
            "EM ROTA";
        }
      }
    );
  });

  saveRoutes();
  save();

  window.currentGeneratedRoutes =
    null;

  renderRoutes();
  renderDashboard();

  toast(
    "Rotas despachadas com sucesso."
  );
}

/* ============================================================
   REOTIMIZAÇÃO
   ============================================================ */

async function reoptimizeRoute(
  routeId
) {

  const route =
    routes.find(
      r => r.id === routeId
    );

  if (!route) {

    /*
     * Pode ser uma rota ainda não despachada.
     */

    const generated =
      window.currentGeneratedRoutes
        ?.find(
          r => r.id === routeId
        );

    if (!generated) {
      toast(
        "Rota não encontrada."
      );
      return;
    }

    const optimized =
      twoOpt(
        generated.orderedItems
      );

    const osrm =
      await calculateOSRMRoute(
        optimized
      );

    const info =
      osrm ||
      calculateFallbackRoute(
        optimized
      );

    generated.orderedItems =
      optimized;

    generated.distanceKm =
      info.distanceKm;

    generated.durationMinutes =
      info.durationMinutes;

    generated.routingSource =
      info.source;

    renderRoutes();

    toast(
      "Rota reotimizada."
    );

    return;
  }

  const optimized =
    twoOpt(
      route.orderedItems
    );

  const osrm =
    await calculateOSRMRoute(
      optimized
    );

  const info =
    osrm ||
    calculateFallbackRoute(
      optimized
    );

  route.orderedItems =
    optimized;

  route.distanceKm =
    info.distanceKm;

  route.durationMinutes =
    info.durationMinutes;

  route.routingSource =
    info.source;

  saveRoutes();

  renderRoutes();

  toast(
    "Rota reotimizada com sucesso."
  );
}

/* ============================================================
   FINALIZAÇÃO DE COLETA
   ============================================================ */

function registerRouteCollection(
  routeId
) {

  const route =
    routes.find(
      r => r.id === routeId
    );

  if (!route) {
    toast(
      "Rota não encontrada."
    );
    return;
  }

  const confirmCollection =
    confirm(
      `Deseja registrar a finalização da rota ${route.id}?`
    );

  if (!confirmCollection) {
    return;
  }

  route.status =
    "FINALIZADA";

  route.finishedAt =
    new Date().toISOString();

  route.orderedItems.forEach(
    item => {

      const request =
        requests.find(
          r =>
            r.id === item.id
        );

      if (request) {

        request.status =
          "COLETADA";

        request.collectedAt =
          new Date().toISOString();
      }
    }
  );

  saveRoutes();
  save();

  renderRoutes();
  renderDashboard();

  toast(
    "Rota finalizada com sucesso."
  );
}

/* ============================================================
   CLIENTES
   ============================================================ */

function renderClients() {

  const uniqueMap =
    new Map();

  requests.forEach(r => {

    const key =
      `${(r.name || "")
        .toLowerCase()
        .trim()}|${(r.phone || "")
        .trim()}`;

    if (
      !uniqueMap.has(key)
    ) {
      uniqueMap.set(
        key,
        r
      );
    }
  });

  const uniqueClients =
    Array.from(
      uniqueMap.values()
    );

  const container =
    document.getElementById(
      "clientsList"
    );

  if (!container) return;

  container.innerHTML =
    uniqueClients.length

      ? uniqueClients
          .map(
            r => `
              <article
                class="client-card"
                onclick="openClientDetails('${escapeHTML(r.id)}')"
              >

                <div
                  class="client-card-header"
                >

                  <h3>
                    ${escapeHTML(
                      r.name
                    )}
                  </h3>

                  <div
                    class="client-card-actions"
                    onclick="event.stopPropagation()"
                  >

                    <button
                      class="btn-icon"
                      onclick="editClient('${escapeHTML(r.id)}')"
                      title="Editar Cadastro"
                    >
                      ✏️
                    </button>

                    <button
                      class="btn-icon delete"
                      onclick="deleteClient('${escapeHTML(r.id)}')"
                      title="Excluir"
                    >
                      🗑️
                    </button>

                  </div>

                </div>

                <p>
                  <strong>Telefone:</strong>
                  ${escapeHTML(
                    r.phone
                  )}
                </p>

                <p>
                  <strong>Local:</strong>
                  ${escapeHTML(
                    r.type
                  )}

                  ${
                    r.customLocationName
                      ? `(${escapeHTML(
                          r.customLocationName
                        )})`
                      : ""
                  }
                </p>

                <p>
                  <strong>Frequência:</strong>
                  ${escapeHTML(
                    r.frequency ||
                    "Não informada"
                  )}
                </p>

                <p>
                  <strong>
                    Último Protocolo:
                  </strong>
                  ${escapeHTML(
                    r.id
                  )}
                </p>

              </article>
            `
          )
          .join("")

      : `
          <div class="empty-state">
            <h2>
              Nenhum cliente cadastrado
            </h2>
          </div>
        `;
}

/* ============================================================
   DETALHES DO CLIENTE
   ============================================================ */

function openClientDetails(id) {

  const req =
    requests.find(
      r => r.id === id
    );

  if (!req) return;

  const modal =
    document.getElementById(
      "clientModal"
    );

  const title =
    document.getElementById(
      "clientModalTitle"
    );

  const content =
    document.getElementById(
      "clientModalContent"
    );

  if (
    !modal ||
    !title ||
    !content
  ) {
    return;
  }

  title.textContent =
    `Ficha Cadastral — ${req.name}`;

  const estLiters =
    Math.round(
      convertToLiters(
        req.quantity,
        req.unit,
        req.materials
      )
    );

  const estWeight =
    estimateWeightKg(
      req.quantity,
      req.unit,
      req.materials
    );

  content.innerHTML = `

    <div class="detail-grid">

      <div class="detail-item">
        <span>
          Código do Protocolo
        </span>

        <strong>
          ${escapeHTML(
            req.id
          )}
        </strong>
      </div>

      <div class="detail-item">

        <span>
          Status Atual
        </span>

        <strong>
          ${statusBadge(
            req.status
          )}
        </strong>

      </div>

      <div class="detail-item">

        <span>
          Nome Completo
        </span>

        <strong>
          ${escapeHTML(
            req.name
          )}
        </strong>

      </div>

      <div class="detail-item">

        <span>
          Telefone WhatsApp
        </span>

        <strong>
          ${escapeHTML(
            req.phone
          )}
        </strong>

      </div>

      <div class="detail-item">

        <span>
          Tipo de Localidade
        </span>

        <strong>

          ${escapeHTML(
            req.type
          )}

          ${
            req.customLocationName
              ? ` — ${escapeHTML(
                  req.customLocationName
                )}`
              : ""
          }

        </strong>

      </div>

      <div class="detail-item">

        <span>
          Frequência Agendada
        </span>

        <strong>
          ${escapeHTML(
            req.frequency ||
            "Não informada"
          )}
        </strong>

      </div>

      <div class="detail-item">

        <span>
          Materiais Recicláveis
        </span>

        <strong>
          ${escapeHTML(
            req.materials
          )}
        </strong>

      </div>

      <div class="detail-item">

        <span>
          Carga Estimada Declarada
        </span>

        <strong>

          ${escapeHTML(
            req.quantity
          )}
          ${escapeHTML(
            req.unit
          )}

          <br>

          ≈
          ${formatNumber(
            estLiters
          )}
          L

          <br>

          ≈
          ${formatNumber(
            estWeight,
            1
          )}
          kg

        </strong>

      </div>

      <div
        class="detail-item"
        style="grid-column:span 2;"
      >

        <span>
          Localização Geográfica
        </span>

        <strong>

          ${
            req.latitude &&
            req.longitude

              ? `
                <a
                  href="https://maps.google.com/?q=${req.latitude},${req.longitude}"
                  target="_blank"
                  style="
                    color:var(--orange);
                    font-weight:bold;
                  "
                >
                  Lat:
                  ${req.latitude}

                  |

                  Lng:
                  ${req.longitude}

                  (Abrir Google Maps 🔗)
                </a>
              `

              : `
                Coordenadas não registradas
              `
          }

        </strong>

      </div>

      <div
        class="detail-item"
        style="grid-column:span 2;"
      >

        <span>
          Observações e Referências
        </span>

        <strong>
          ${escapeHTML(
            req.notes ||
            "Nenhuma observação informada."
          )}
        </strong>

      </div>

    </div>

    <div
      style="
        margin-top:24px;
        display:flex;
        gap:12px;
        justify-content:flex-end;
        flex-wrap:wrap;
      "
    >

      <button
        class="secondary-btn"
        onclick="editClient('${escapeHTML(req.id)}')"
      >
        ✏️ Editar Cadastro
      </button>

      <button
        class="secondary-btn"
        style="
          color:#c92a2a;
          border-color:#f8b4b4;
        "
        onclick="deleteClient('${escapeHTML(req.id)}')"
      >
        🗑️ Excluir Registro
      </button>

    </div>
  `;

  modal.classList.remove(
    "hidden"
  );
}

/* ============================================================
   EDIÇÃO
   ============================================================ */

function editClient(id) {

  const req =
    requests.find(
      r => r.id === id
    );

  if (!req) return;

  document
    .getElementById(
      "clientModal"
    )
    ?.classList.add("hidden");

  const container =
    document.getElementById(
      "modalFormContainer"
    );

  if (!container) return;

  container.innerHTML =
    buildFormHTML(
      "editModalForm"
    );

  initFormEvents(
    "editModalForm"
  );

  const form =
    document.getElementById(
      "editModalForm"
    );

  form.querySelector(
    'input[name="name"]'
  ).value =
    req.name || "";

  form.querySelector(
    'input[name="phone"]'
  ).value =
    req.phone || "";

  form.querySelector(
    ".type-select"
  ).value =
    req.type || "Residência";

  if (
    req.type !==
    "Residência"
  ) {

    const customWrap =
      form.querySelector(
        ".custom-location-wrap"
      );

    customWrap?.classList.remove(
      "hidden"
    );

    form.querySelector(
      'input[name="customLocationName"]'
    ).value =
      req.customLocationName ||
      "";
  }

  form.querySelector(
    'input[name="quantity"]'
  ).value =
    req.quantity || "";

  form.querySelector(
    'select[name="unit"]'
  ).value =
    req.unit || "";

  form.querySelector(
    "textarea[name='notes']"
  ).value =
    req.notes || "";

  form.querySelector(
    'input[name="latitude"]'
  ).value =
    req.latitude || "";

  form.querySelector(
    'input[name="longitude"]'
  ).value =
    req.longitude || "";

  /*
   * Recarrega materiais.
   */

  const materials =
    (req.materials || "")
      .split(",")
      .map(
        m =>
          m
            .trim()
            .toLowerCase()
      );

  form
    .querySelectorAll(
      'input[name="materials_list"]'
    )
    .forEach(
      checkbox => {

        const normalized =
          checkbox.value
            .toLowerCase();

        if (
          materials.includes(
            normalized
          )
        ) {
          checkbox.checked =
            true;
        }
      }
    );

  form.onsubmit = e => {

    e.preventDefault();

    const formData =
      new FormData(form);

    const data =
      Object.fromEntries(
        formData.entries()
      );

    let checkedMaterials =
      [
        ...form.querySelectorAll(
          'input[name="materials_list"]:checked'
        )
      ].map(
        c => c.value
      );

    if (!checkedMaterials.length) {
      checkedMaterials =
        [req.materials];
    }

    req.name =
      data.name;

    req.phone =
      data.phone;

    req.type =
      data.type;

    req.customLocationName =
      data.type !==
        "Residência"
        ? data.customLocationName
        : "";

    req.quantity =
      data.quantity;

    req.unit =
      data.unit;

    req.notes =
      data.notes;

    req.materials =
      checkedMaterials.join(
        ", "
      );

    save();

    closeModal();

    renderRequests();
    renderClients();
    renderDashboard();

    toast(
      "Cadastro do cliente atualizado com sucesso!"
    );
  };

  document
    .getElementById(
      "requestModal"
    )
    ?.classList.remove(
      "hidden"
    );
}

/* ============================================================
   EXCLUSÃO
   ============================================================ */

function deleteClient(id) {

  if (
    !confirm(
      `Tem certeza que deseja excluir o cadastro/solicitação ${id}?`
    )
  ) {
    return;
  }

  requests =
    requests.filter(
      r => r.id !== id
    );

  save();

  document
    .getElementById(
      "clientModal"
    )
    ?.classList.add(
      "hidden"
    );

  renderRequests();
  renderClients();
  renderDashboard();

  toast(
    "Registro excluído com sucesso."
  );
}

/* ============================================================
   TELEFONE
   ============================================================ */

function formatPhone(value) {

  const digits =
    value
      .replace(/\D/g, "")
      .slice(0, 11);

  if (
    digits.length <= 2
  ) {
    return digits
      ? `(${digits}`
      : "";
  }

  if (
    digits.length <= 7
  ) {
    return `(${digits.slice(
      0,
      2
    )}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(
    0,
    2
  )}) ${digits.slice(
    2,
    7
  )}-${digits.slice(7)}`;
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(btn => {

        btn.addEventListener(
          "click",
          () =>
            showSection(
              btn.dataset.section
            )
        );
      });

    document
      .querySelectorAll(
        "[data-section-link]"
      )
      .forEach(btn => {

        btn.addEventListener(
          "click",
          () =>
            showSection(
              btn.dataset.sectionLink
            )
        );
      });

    document
      .getElementById(
        "menuToggle"
      )
      ?.addEventListener(
        "click",
        () => {

          document
            .getElementById(
              "sidebar"
            )
            ?.classList.toggle(
              "open"
            );
        }
      );

    document
      .getElementById(
        "novaSolicitacaoBtn"
      )
      ?.addEventListener(
        "click",
        openModal
      );

    document
      .getElementById(
        "novaSolicitacaoBtn2"
      )
      ?.addEventListener(
        "click",
        openModal
      );

    document
      .getElementById(
        "shareFormBtn"
      )
      ?.addEventListener(
        "click",
        copyPublicLink
      );

    document
      .getElementById(
        "closeModal"
      )
      ?.addEventListener(
        "click",
        closeModal
      );

    document
      .getElementById(
        "closeClientModal"
      )
      ?.addEventListener(
        "click",
        () => {

          document
            .getElementById(
              "clientModal"
            )
            ?.classList.add(
              "hidden"
            );
        }
      );

    document
      .getElementById(
        "requestModal"
      )
      ?.addEventListener(
        "click",
        e => {

          if (
            e.target.id ===
            "requestModal"
          ) {
            closeModal();
          }
        }
      );

    document
      .getElementById(
        "clientModal"
      )
      ?.addEventListener(
        "click",
        e => {

          if (
            e.target.id ===
            "clientModal"
          ) {

            document
              .getElementById(
                "clientModal"
              )
              .classList.add(
                "hidden"
              );
          }
        }
      );

    document
      .getElementById(
        "searchInput"
      )
      ?.addEventListener(
        "input",
        renderRequests
      );

    document
      .getElementById(
        "statusFilter"
      )
      ?.addEventListener(
        "change",
        renderRequests
      );

    /* ========================================================
       MODAL DE VEÍCULOS
       ======================================================== */

    document
      .getElementById(
        "novoVeiculoBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          document
            .getElementById(
              "vehicleModal"
            )
            ?.classList.remove(
              "hidden"
            );
        }
      );

    document
      .getElementById(
        "closeVehicleModal"
      )
      ?.addEventListener(
        "click",
        () => {

          document
            .getElementById(
              "vehicleModal"
            )
            ?.classList.add(
              "hidden"
            );
        }
      );

    document
      .getElementById(
        "vehicleForm"
      )
      ?.addEventListener(
        "submit",
        e => {

          e.preventDefault();

          const formData =
            new FormData(
              e.target
            );

          const data =
            Object.fromEntries(
              formData.entries()
            );

          const newVehicle = {

            id:
              `VEH-${vehicles.length + 1}`,

            name:
              data.name,

            plate:
              data.plate,

            capacityLiters:
              parseFloat(
                data.capacityLiters
              ) || 0,

            /*
             * Se o formulário HTML ainda não
             * possuir capacityKg, ficará null.
             */

            capacityKg:
              data.capacityKg !==
                undefined &&
              data.capacityKg !== ""
                ? parseFloat(
                    data.capacityKg
                  )
                : null,

            minVolumeLiters:
              parseFloat(
                data.minVolumeLiters
              ) || 0
          };

          vehicles.push(
            newVehicle
          );

          saveVehicles();

          renderVehicles();

          e.target.reset();

          document
            .getElementById(
              "vehicleModal"
            )
            ?.classList.add(
              "hidden"
            );

          toast(
            "Veículo cadastrado com sucesso."
          );
        }
      );

    /* ========================================================
       PÚBLICO / DASHBOARD
       ======================================================== */

    if (
      !checkPublicURL()
    ) {
      renderDashboard();
    }
  }
);
