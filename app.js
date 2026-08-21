const STORAGE_KEY = "sol_nascente_solicitacoes_v1";

const defaultRequests = [
  {
    id: "SOL-2026-000001",
    name: "Exemplo de solicitante",
    phone: "(88) 99999-9999",
    type: "Residência",
    cep: "62690-000",
    address: "Rua Principal, 100",
    neighborhood: "Trairi",
    materials: "Papel, plástico",
    notes: "",
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

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById(sectionId)?.classList.add("active-section");
  document.querySelector(`.nav-item[data-section="${sectionId}"]`)?.classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
  if (sectionId === "dashboard") renderDashboard();
  if (sectionId === "solicitacoes") renderRequests();
  if (sectionId === "rotas") renderRoutes();
  if (sectionId === "clientes") renderClients();
}

function openModal() {
  document.getElementById("requestModal").classList.remove("hidden");
  document.querySelector('#requestForm input[name="name"]').focus();
}
function closeModal() {
  document.getElementById("requestModal").classList.add("hidden");
  document.getElementById("requestForm").reset();
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
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
      <th>Código</th><th>Solicitante</th><th>Local</th><th>Materiais</th><th>Status</th>${withActions ? "<th>Ação</th>" : ""}
    </tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td><strong>${escapeHTML(r.id)}</strong></td>
        <td>${escapeHTML(r.name)}<br><small>${escapeHTML(r.phone)}</small></td>
        <td>${escapeHTML(r.neighborhood)}<br><small>${escapeHTML(r.address)}</small></td>
        <td>${escapeHTML(r.materials)}</td>
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
    const text = `${r.id} ${r.name} ${r.phone} ${r.neighborhood} ${r.materials}`.toLowerCase();
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
        toast("Status atualizado.");
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
    <small>${escapeHTML(r.address)}, ${escapeHTML(r.neighborhood)}</small></span>
  </label>`).join("");

  document.querySelectorAll(".route-checkbox").forEach(c => c.addEventListener("change", updateRoutePreview));
  updateRoutePreview();
}

function updateRoutePreview() {
  const ids = [...document.querySelectorAll(".route-checkbox:checked")].map(c => c.value);
  const selected = ids.map(id => requests.find(r => r.id === id)).filter(Boolean);
  document.getElementById("routeSummary").textContent = selected.length
    ? `${selected.length} ponto(s) selecionado(s). A otimização geográfica será conectada ao serviço de rotas na próxima etapa.`
    : "Nenhum ponto selecionado.";
  document.getElementById("routeOrder").innerHTML = selected.map((r, i) =>
    `<li>${i + 1}. ${escapeHTML(r.name)} — ${escapeHTML(r.neighborhood)}</li>`).join("");
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
        <p>${escapeHTML(r.phone)}</p>
        <p>${escapeHTML(r.address)}, ${escapeHTML(r.neighborhood)}</p>
        <p>${escapeHTML(r.type)}</p>
      </article>`).join("")
    : `<div class="empty-state"><h2>Nenhum cliente cadastrado</h2></div>`;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => showSection(btn.dataset.section));
});
document.querySelectorAll("[data-section-link]").forEach(btn => {
  btn.addEventListener("click", () => showSection(btn.dataset.sectionLink));
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});
document.getElementById("novaSolicitacaoBtn").addEventListener("click", openModal);
document.getElementById("novaSolicitacaoBtn2").addEventListener("click", openModal);
document.getElementById("closeModal").addEventListener("click", closeModal);

document.getElementById("requestModal").addEventListener("click", e => {
  if (e.target.id === "requestModal") closeModal();
});

document.querySelector('#requestForm input[name="phone"]').addEventListener("input", e => {
  e.target.value = formatPhone(e.target.value);
});
document.querySelector('#requestForm input[name="cep"]').addEventListener("input", e => {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
  e.target.value = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
});

document.getElementById("requestForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const request = {
    ...data,
    id: nextId(),
    status: "NOVA",
    createdAt: new Date().toISOString()
  };
  requests.push(request);
  save();
  closeModal();
  renderDashboard();
  toast(`Solicitação ${request.id} cadastrada.`);
});

document.getElementById("searchInput").addEventListener("input", renderRequests);
document.getElementById("statusFilter").addEventListener("change", renderRequests);

document.getElementById("createRouteBtn").addEventListener("click", () => {
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

renderDashboard();
