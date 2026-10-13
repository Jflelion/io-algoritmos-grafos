(function () {
"use strict";

  // ============================================================
  //  ESTADO DE LA APLICACIÓN
  // ============================================================
  let nodes = []; // {id, x, y, label}
  let edges = []; // {id, a, b, weight}
let idCounter = 0;
let nextNodeIndex = 0;

  let mode = "select"; // 'select' | 'add-node' | 'add-edge'
  let pendingEdgeStart = null; // id del nodo origen mientras se crea un arco
let selected = { type: null, id: null };

  // Resultado del algoritmo (conjuntos de ids resueltos)
let acceptedIds = new Set();
let rejectedIds = new Set();
let currentAnimEdgeId = null;
let finalTotal = null;
let animTimer = null;
let running = false;

  // ============================================================
  //  REFERENCIAS AL DOM
  // ============================================================
const svg = document.getElementById("canvas");
const edgesLayer = document.getElementById("edges-layer");
const nodesLayer = document.getElementById("nodes-layer");
const mainEl = document.getElementById("main");
const emptyHint = document.getElementById("empty-hint");

const btnModeSelect = document.getElementById("mode-select");
const btnModeAddNode = document.getElementById("mode-add-node");
const btnModeAddEdge = document.getElementById("mode-add-edge");

const panelNone = document.getElementById("panel-none");
const panelNode = document.getElementById("panel-node");
const panelEdge = document.getElementById("panel-edge");
const nodeTitle = document.getElementById("node-title");
const edgeTitle = document.getElementById("edge-title");
const edgeWeightInput = document.getElementById("edge-weight-input");
const edgeWeightError = document.getElementById("edge-weight-error");

const btnDeleteNode = document.getElementById("btn-delete-node");
const btnDeleteEdge = document.getElementById("btn-delete-edge");
const btnUpdateWeight = document.getElementById("btn-update-weight");

const btnRun = document.getElementById("btn-run");
const btnSkip = document.getElementById("btn-skip");
const chkSteps = document.getElementById("chk-steps");
const resultArea = document.getElementById("result-area");
const logEl = document.getElementById("log");
const btnClear = document.getElementById("btn-clear");
const btnExample = document.getElementById("btn-example");
const btnExport = document.getElementById("btn-export");
const btnExportImage = document.getElementById("btn-export-image");
const btnImport = document.getElementById("btn-import");
const fileImport = document.getElementById("file-import");

const statNodes = document.getElementById("stat-nodes");
const statEdges = document.getElementById("stat-edges");
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");

const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalInput = document.getElementById("modal-input");
const modalError = document.getElementById("modal-error");
const modalCancel = document.getElementById("modal-cancel");
const modalConfirm = document.getElementById("modal-confirm");
let modalOnConfirm = null;
let modalOnCancel = null;

const confirmOverlay = document.getElementById("confirm-overlay");
const confirmTitleEl = document.getElementById("confirm-title");
const confirmMessageEl = document.getElementById("confirm-message");
const confirmCancelBtn = document.getElementById("confirm-cancel");
const confirmOkBtn = document.getElementById("confirm-ok");
let confirmOnYes = null;

document.getElementById("cartouche-date").textContent =
    new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    });

  // ============================================================
  //  UTILIDADES
  // ============================================================
function nodeLabel(index) {
    let n = index + 1,
    s = "";
    while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
    }
    return s;
}

function findNode(id) {
    return nodes.find((n) => n.id === id);
}
function findEdge(id) {
    return edges.find((e) => e.id === id);
}
function labelOf(id) {
    const n = findNode(id);
    return n ? n.label : "?";
}

function edgeExists(a, b) {
    return edges.some(
(e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    );
}

function formatWeight(w) {
    if (Number.isInteger(w)) return String(w);
    return String(Math.round(w * 100) / 100);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function toSvgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
}

function showTransientMessage(msg, kind) {
    resultArea.innerHTML =
    '<div class="status-card ' + (kind || "") + '">' + msg + "</div>";
}

function clearTimers() {
    if (animTimer) {
    clearTimeout(animTimer);
    animTimer = null;
    }
}

function invalidateResult() {
    clearTimers();
    running = false;
    acceptedIds = new Set();
    rejectedIds = new Set();
    currentAnimEdgeId = null;
    finalTotal = null;
    logEl.innerHTML = "";
    resultArea.innerHTML = "";
    btnSkip.classList.add("hidden");
    btnRun.disabled = false;
}

  // ============================================================
  //  UNION-FIND (para el algoritmo de Kruskal)
  // ============================================================
function DSU(ids) {
    const parent = {},
    rank = {};
    ids.forEach((id) => {
    parent[id] = id;
    rank[id] = 0;
    });
    function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
    }
    function union(a, b) {
    let ra = find(a),
        rb = find(b);
    if (ra === rb) return false;
    if (rank[ra] < rank[rb]) {
        const t = ra;
        ra = rb;
        rb = t;
    }
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra]++;
    return true;
    }
    return { find, union };
}

function checkConnectivity() {
    if (nodes.length === 0) return { connected: false, count: 0 };
    const adj = {};
    nodes.forEach((n) => (adj[n.id] = []));
    edges.forEach((e) => {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
    });
    const visited = new Set([nodes[0].id]);
    const queue = [nodes[0].id];
    while (queue.length) {
    const cur = queue.shift();
    adj[cur].forEach((nb) => {
        if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
        }
    });
    }
    return { connected: visited.size === nodes.length, count: visited.size };
}

  // ============================================================
  //  MUTACIONES DE ESTADO
  // ============================================================
function addNode(x, y) {
    const id = "n" + idCounter++;
    nodes.push({
    id,
    x: clamp(x, 30, 970),
    y: clamp(y, 30, 620),
    label: nodeLabel(nextNodeIndex++),
    });
    invalidateResult();
    render();
}

function addEdge(a, b, weight) {
    edges.push({ id: "e" + idCounter++, a, b, weight });
    invalidateResult();
    render();
}

function deleteNode(id) {
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => e.a !== id && e.b !== id);
    selected = { type: null, id: null };
    invalidateResult();
    render();
    updateSidebar();
}

function deleteEdge(id) {
    edges = edges.filter((e) => e.id !== id);
    selected = { type: null, id: null };
    invalidateResult();
    render();
    updateSidebar();
}

function setEdgeWeight(id, w) {
    const e = findEdge(id);
    if (!e) return;
    e.weight = w;
    invalidateResult();
    render();
    updateSidebar();
}

function clearAll() {
    nodes = [];
    edges = [];
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    invalidateResult();
    render();
    updateSidebar();
}

  // ============================================================
  //  MODAL DE ENTRADA (peso numérico o texto — p. ej. renombrar nodo)
  // ============================================================
function openInputModal(opts) {
    modalTitle.textContent = opts.title;
    modalInput.type = opts.inputType || "number";
    modalInput.value = opts.initial != null ? opts.initial : "";
    modalError.textContent = "";
    modalOnConfirm = opts.onConfirm;
    modalOnCancel = opts.onCancel || null;
    modalOverlay.classList.remove("hidden");
    modalInput.focus();
    modalInput.select();
}
  // Alias con el nombre original, usado para pedir el peso de un arco.
function openWeightModal(opts) {
    openInputModal(Object.assign({ inputType: "number" }, opts));
}
function closeModal() {
    modalOverlay.classList.add("hidden");
    modalOnConfirm = null;
    modalOnCancel = null;
}
function confirmModal() {
    const raw = modalInput.value.trim();
    if (modalInput.type === "number") {
    const val = parseFloat(raw);
    if (raw === "" || !isFinite(val)) {
        modalError.textContent = "Ingresa un número válido (ej. 4, 2.5).";
        return;
    }
    const cb = modalOnConfirm;
    closeModal();
    if (cb) cb(val);
    } else {
    if (raw === "") {
        modalError.textContent = "Este campo no puede quedar vacío.";
        return;
    }
    const cb = modalOnConfirm;
    closeModal();
    if (cb) cb(raw);
    }
}
function cancelModal() {
    const cb = modalOnCancel;
    closeModal();
    if (cb) cb();
}
modalConfirm.addEventListener("click", confirmModal);
modalCancel.addEventListener("click", cancelModal);
modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmModal();
    if (e.key === "Escape") cancelModal();
});

  // ============================================================
  //  MODAL DE CONFIRMACIÓN (reemplaza window.confirm, que puede
  //  quedar bloqueado en algunos visores/entornos embebidos)
  // ============================================================
function showConfirm(message, onYes, title) {
    confirmTitleEl.textContent = title || "Confirmar acción";
    confirmMessageEl.textContent = message;
    confirmOnYes = onYes;
    confirmOverlay.classList.remove("hidden");
}
function closeConfirm() {
    confirmOverlay.classList.add("hidden");
    confirmOnYes = null;
}
confirmOkBtn.addEventListener("click", () => {
    const cb = confirmOnYes;
    closeConfirm();
    if (cb) cb();
});
confirmCancelBtn.addEventListener("click", closeConfirm);

  // ============================================================
  //  RENDER
  // ============================================================
function edgeMidpoint(e) {
    const na = findNode(e.a),
    nb = findNode(e.b);
    const mx = (na.x + nb.x) / 2,
    my = (na.y + nb.y) / 2;
    const dx = nb.x - na.x,
    dy = nb.y - na.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len,
    ny = dx / len;
    return { x: mx + nx * 15, y: my + ny * 15 };
}

function edgeClass(e) {
    if (selected.type === "edge" && selected.id === e.id)
    return "edge-selected";
    if (currentAnimEdgeId === e.id) return "edge-current";
    if (acceptedIds.has(e.id)) return "edge-mst";
    if (rejectedIds.has(e.id)) return "edge-rejected";
    return "edge-default";
}

function render() {
    emptyHint.classList.toggle("hidden", nodes.length > 0);

    edgesLayer.innerHTML = "";
    edges.forEach((e) => {
    const na = findNode(e.a),
        nb = findNode(e.b);
    if (!na || !nb) return;
    const cls = edgeClass(e);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "edge-group");
    g.setAttribute("data-edge-id", e.id);

    const hit = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
    );
    hit.setAttribute("class", "edge-hit");
    hit.setAttribute("x1", na.x);
    hit.setAttribute("y1", na.y);
    hit.setAttribute("x2", nb.x);
    hit.setAttribute("y2", nb.y);
    g.appendChild(hit);

    const visible = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
    );
    visible.setAttribute("class", "edge-visible " + cls);
    visible.setAttribute("x1", na.x);
    visible.setAttribute("y1", na.y);
    visible.setAttribute("x2", nb.x);
    visible.setAttribute("y2", nb.y);
    g.appendChild(visible);

    const mp = edgeMidpoint(e);
    const chipClass =
        cls === "edge-mst" ? "mst" : cls === "edge-current" ? "current" : "";
    const text = formatWeight(e.weight);
      const w = Math.max(22, text.length * 7.2 + 12);
    const chip = document.createElementNS("http://www.w3.org/2000/svg", "g");
    chip.setAttribute("class", "weight-chip " + chipClass);
    const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
    );
    rect.setAttribute("x", mp.x - w / 2);
    rect.setAttribute("y", mp.y - 10);
    rect.setAttribute("width", w);
    rect.setAttribute("height", 20);
    rect.setAttribute("rx", 3);
    chip.appendChild(rect);
    const txt = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    );
    txt.setAttribute("x", mp.x);
    txt.setAttribute("y", mp.y + 0.5);
    txt.textContent = text;
    chip.appendChild(txt);
    g.appendChild(chip);

    edgesLayer.appendChild(g);
    });

    nodesLayer.innerHTML = "";
    nodes.forEach((n) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "node-group");
    g.setAttribute("data-node-id", n.id);
    g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");

    const hit = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
    );
    hit.setAttribute("class", "node-hit");
    hit.setAttribute("r", 25);
    g.appendChild(hit);

    let visCls = "node-visible";
    if (selected.type === "node" && selected.id === n.id)
        visCls += " node-selected";
    if (pendingEdgeStart === n.id) visCls += " node-origin";
    const visible = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
    );
    visible.setAttribute("class", visCls);
    visible.setAttribute("r", 19);
    g.appendChild(visible);

    const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    );
    label.setAttribute("class", "node-label");
    label.textContent = n.label;
    g.appendChild(label);

    nodesLayer.appendChild(g);
    });

    updateStats();
}

function updateStats() {
    statNodes.textContent = nodes.length;
    statEdges.textContent = edges.length;
    if (nodes.length === 0) {
    connDot.className = "conn-dot";
    connText.textContent = "Sin datos";
    return;
    }
    const conn = checkConnectivity();
    if (conn.connected) {
    connDot.className = "conn-dot ok";
    connText.textContent = "Red conexa";
    } else {
    connDot.className = "conn-dot bad";
    connText.textContent =
        "No conexa (" + conn.count + "/" + nodes.length + " alcanzables)";
    }
}

  // ============================================================
  //  SIDEBAR
  // ============================================================
function updateSidebar() {
    panelNone.classList.add("hidden");
    panelNode.classList.add("hidden");
    panelEdge.classList.add("hidden");

    if (selected.type === "node") {
    const n = findNode(selected.id);
    if (!n) {
        selected = { type: null, id: null };
        updateSidebar();
        return;
    }
    panelNode.classList.remove("hidden");
    nodeTitle.textContent = "Nodo " + n.label;
    } else if (selected.type === "edge") {
    const e = findEdge(selected.id);
    if (!e) {
        selected = { type: null, id: null };
        updateSidebar();
        return;
    }
    panelEdge.classList.remove("hidden");
    edgeTitle.textContent = "Arco " + labelOf(e.a) + " – " + labelOf(e.b);
    edgeWeightInput.value = e.weight;
    edgeWeightError.textContent = "";
    } else {
    panelNone.classList.remove("hidden");
    }
}

btnUpdateWeight.addEventListener("click", () => {
    if (selected.type !== "edge") return;
    const val = parseFloat(edgeWeightInput.value);
    if (edgeWeightInput.value.trim() === "" || !isFinite(val)) {
    edgeWeightError.textContent = "Ingresa un número válido.";
    return;
    }
    setEdgeWeight(selected.id, val);
});
btnDeleteEdge.addEventListener("click", () => {
    if (selected.type === "edge") deleteEdge(selected.id);
});
btnDeleteNode.addEventListener("click", () => {
    if (selected.type === "node") deleteNode(selected.id);
});

  // ============================================================
  //  MODOS Y HERRAMIENTAS
  // ============================================================
function setMode(m) {
    mode = m;
    pendingEdgeStart = null;
    selected = { type: null, id: null };
    [btnModeSelect, btnModeAddNode, btnModeAddEdge].forEach((b) =>
    b.classList.remove("active"),
    );
    mainEl.classList.remove("mode-select", "mode-add-node", "mode-add-edge");
    mainEl.classList.add("mode-" + m);
    if (m === "select") btnModeSelect.classList.add("active");
    if (m === "add-node") btnModeAddNode.classList.add("active");
    if (m === "add-edge") btnModeAddEdge.classList.add("active");
    updateSidebar();
    render();
}
btnModeSelect.addEventListener("click", () => setMode("select"));
btnModeAddNode.addEventListener("click", () => setMode("add-node"));
btnModeAddEdge.addEventListener("click", () => setMode("add-edge"));

  // ============================================================
  //  INTERACCIÓN CON EL LIENZO (puntero: mouse + táctil)
  // ============================================================
let downInfo = null;

svg.addEventListener("pointerdown", (e) => {
    const pt = toSvgPoint(e);
    const nodeGroup = e.target.closest(".node-group");
    const edgeGroup = !nodeGroup && e.target.closest(".edge-group");
    if (nodeGroup) {
    downInfo = {
        type: "node",
        id: nodeGroup.dataset.nodeId,
        startX: pt.x,
        startY: pt.y,
        moved: false,
    };
    } else if (edgeGroup) {
    downInfo = {
        type: "edge",
        id: edgeGroup.dataset.edgeId,
        startX: pt.x,
        startY: pt.y,
        moved: false,
    };
    } else {
    downInfo = {
        type: "background",
        startX: pt.x,
        startY: pt.y,
        moved: false,
    };
    }
});

svg.addEventListener("pointermove", (e) => {
    if (!downInfo) return;
    const pt = toSvgPoint(e);
    const dx = pt.x - downInfo.startX,
    dy = pt.y - downInfo.startY;
    if (Math.hypot(dx, dy) > 4) downInfo.moved = true;
    if (downInfo.type === "node" && mode === "select" && downInfo.moved) {
    const n = findNode(downInfo.id);
    if (n) {
        n.x = clamp(pt.x, 30, 970);
        n.y = clamp(pt.y, 30, 620);
        render();
    }
    }
});

window.addEventListener("pointerup", (e) => {
    if (!downInfo) return;
    const info = downInfo;
    downInfo = null;

    if (info.type === "node") {
    if (!info.moved || mode !== "select") handleNodeClick(info.id);
    } else if (info.type === "edge") {
    if (!info.moved) handleEdgeClick(info.id);
    } else {
    if (!info.moved) handleBackgroundClick(toSvgPoint(e));
    }
});

function handleNodeClick(id) {
    if (mode === "add-node") return;

    if (mode === "add-edge") {
    if (pendingEdgeStart === null) {
        pendingEdgeStart = id;
        render();
    } else if (pendingEdgeStart === id) {
        pendingEdgeStart = null;
        render();
    } else {
        if (edgeExists(pendingEdgeStart, id)) {
        showTransientMessage(
            "Ya existe un arco entre estos dos nodos.",
            "error",
        );
        pendingEdgeStart = null;
        render();
        return;
        }
        const a = pendingEdgeStart,
        b = id;
        pendingEdgeStart = null;
        render();
        openWeightModal({
        title: "Peso del arco " + labelOf(a) + " – " + labelOf(b),
        initial: "",
        onConfirm: (val) => addEdge(a, b, val),
        });
    }
    return;
    }

    // modo seleccionar
    selected = { type: "node", id };
    render();
    updateSidebar();
}

function handleEdgeClick(id) {
    if (mode !== "select") return;
    selected = { type: "edge", id };
    render();
    updateSidebar();
}

function handleBackgroundClick(pt) {
    if (mode === "add-node") {
    addNode(pt.x, pt.y);
    } else if (mode === "add-edge") {
    if (pendingEdgeStart !== null) {
        pendingEdgeStart = null;
        render();
    }
    } else {
    selected = { type: null, id: null };
    render();
    updateSidebar();
    }
}

  // Doble clic sobre un nodo (en modo Seleccionar) para renombrarlo.
svg.addEventListener("dblclick", (e) => {
    if (mode !== "select") return;
    const nodeGroup = e.target.closest(".node-group");
    if (!nodeGroup) return;
    const n = findNode(nodeGroup.dataset.nodeId);
    if (!n) return;
    openInputModal({
    title: "Renombrar nodo",
    inputType: "text",
    initial: n.label,
    onConfirm: (val) => {
        n.label = val.trim().slice(0, 12);
        render();
        updateSidebar();
    },
    });
});

  // Atajos de teclado: Supr/Retroceso elimina la selección, Escape la cancela.
document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT") return; // no interferir mientras se escribe en un campo
    if (
    !modalOverlay.classList.contains("hidden") ||
    !confirmOverlay.classList.contains("hidden")
    )
    return;

    if (e.key === "Delete" || e.key === "Backspace") {
    if (selected.type === "node") {
        e.preventDefault();
        deleteNode(selected.id);
    } else if (selected.type === "edge") {
        e.preventDefault();
        deleteEdge(selected.id);
    }
    } else if (e.key === "Escape") {
    pendingEdgeStart = null;
    selected = { type: null, id: null };
    render();
    updateSidebar();
    }
});

  // ============================================================
  //  ALGORITMO DE KRUSKAL + ANIMACIÓN PASO A PASO
  // ============================================================
function logAppend(text, cls) {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

function validateBeforeRun() {
    if (nodes.length < 2)
    return "Agrega al menos dos nodos para calcular un árbol de expansión mínima.";
    if (edges.length === 0) return "La red no tiene arcos definidos.";
    const conn = checkConnectivity();
    if (!conn.connected) {
    return (
        "La red no es conexa: solo " +
        conn.count +
        " de " +
        nodes.length +
        " nodos son alcanzables entre sí. No es posible construir un árbol de expansión mínima. " +
        "Agrega arcos que unan las componentes aisladas."
    );
    }
    return null;
}

btnRun.addEventListener("click", () => {
    if (running) return;
    invalidateResult();
    const err = validateBeforeRun();
    if (err) {
    showTransientMessage(err, "error");
    return;
    }
    const sorted = edges.slice().sort((x, y) => x.weight - y.weight);
    const dsu = DSU(nodes.map((n) => n.id));
    const steps = sorted.map((e) => ({
    edgeId: e.id,
    accepted: dsu.union(e.a, e.b),
    }));

    if (chkSteps.checked) {
    animateSteps(steps);
    } else {
    steps.forEach((s) => {
        if (s.accepted) acceptedIds.add(s.edgeId);
        else rejectedIds.add(s.edgeId);
    });
    finalize();
    }
});

function animateSteps(steps) {
    running = true;
    btnRun.disabled = true;
    btnSkip.classList.remove("hidden");
    let index = 0;

    function step() {
    if (index >= steps.length) {
        finalize();
        return;
    }
    const s = steps[index];
    const e = findEdge(s.edgeId);
    currentAnimEdgeId = s.edgeId;
    render();
    logAppend(
        "Evaluando arco " +
        labelOf(e.a) +
        "–" +
        labelOf(e.b) +
        " (peso " +
        formatWeight(e.weight) +
        ")…",
    );

    animTimer = setTimeout(() => {
        if (s.accepted) {
        acceptedIds.add(s.edgeId);
        logAppend("  → Aceptado (no forma ciclo)", "accepted");
        } else {
        rejectedIds.add(s.edgeId);
        logAppend("  → Descartado (formaría un ciclo)", "rejected");
        }
        currentAnimEdgeId = null;
        index++;
        render();
        animTimer = setTimeout(step, 220);
    }, 620);
    }
    step();
}

btnSkip.addEventListener("click", () => {
    clearTimers();
    // completar de inmediato usando el estado ya calculado
    const err = validateBeforeRun();
    if (err) return;
    const sorted = edges.slice().sort((x, y) => x.weight - y.weight);
    const dsu = DSU(nodes.map((n) => n.id));
    acceptedIds = new Set();
    rejectedIds = new Set();
    currentAnimEdgeId = null;
    sorted.forEach((e) => {
    if (dsu.union(e.a, e.b)) acceptedIds.add(e.id);
    else rejectedIds.add(e.id);
    });
    finalize();
});

function finalize() {
    clearTimers();
    running = false;
    currentAnimEdgeId = null;
    btnRun.disabled = false;
    btnSkip.classList.add("hidden");
    let total = 0;
    acceptedIds.forEach((id) => {
    total += findEdge(id).weight;
    });
    finalTotal = total;
    resultArea.innerHTML = '<div class="status-card success">' + "Árbol de expansión mínima calculado con " +
    acceptedIds.size +
    " arco(s).<br>" +
    'Peso total: <span class="status-total">' +
    formatWeight(total) +
    "</span>" +
    "</div>";
    render();
}

btnClear.addEventListener("click", () => {
    if (nodes.length === 0 && edges.length === 0) return;
    showConfirm(
    "Se eliminarán todos los nodos y arcos de la red actual. Esta acción no se puede deshacer.",
    clearAll,
    "Limpiar red completa",
    );
});

  // ============================================================
  //  GUARDAR / CARGAR RED (.json) — útil para conservar o
  //  compartir configuraciones de red usadas en la sustentación.
  // ============================================================
function recalcCounters() {
    let maxSuffix = -1;
    [...nodes, ...edges].forEach((o) => {
    const m = /^[a-zA-Z]+(\d+)$/.exec(o.id);
    if (m) maxSuffix = Math.max(maxSuffix, parseInt(m[1], 10));
    });
    idCounter = maxSuffix + 1;
    nextNodeIndex = nodes.length;
}

function loadNetwork(data) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error(
        'El archivo no tiene el formato esperado (se requieren "nodes" y "edges").',
    );
    }
    const validNodes = data.nodes.every(
    (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.x === "number" &&
        typeof n.y === "number" &&
        typeof n.label === "string",
    );
    if (!validNodes)
    throw new Error(
        "Los nodos del archivo tienen datos inválidos o incompletos.",
    );
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const validEdges = data.edges.every(
    (e) =>
        e &&
        typeof e.id === "string" &&
        nodeIds.has(e.a) &&
        nodeIds.has(e.b) &&
        typeof e.weight === "number" &&
        isFinite(e.weight),
    );
    if (!validEdges)
    throw new Error(
        "Los arcos del archivo tienen datos inválidos o referencian nodos inexistentes.",
    );

    nodes = data.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    }));
    edges = data.edges.map((e) => ({
    id: e.id,
    a: e.a,
    b: e.b,
    weight: e.weight,
    }));
    recalcCounters();
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    invalidateResult();
    render();
    updateSidebar();
}

btnExport.addEventListener("click", () => {
    if (nodes.length === 0) {
    showTransientMessage(
        "No hay nada que exportar: la red está vacía.",
        "error",
    );
    return;
    }
    const data = { nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "red-aem-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

btnExportImage.addEventListener("click", () => {
    if (nodes.length === 0) {
    showTransientMessage(
        "No hay nada que exportar: la red está vacía.",
        "error",
    );
    return;
    }
    exportCanvasAsPng();
});

function exportCanvasAsPng() {
    const vb = svg.viewBox.baseVal;
    const width = vb.width || 1000;
    const height = vb.height || 650;

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    const style = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "style",
    );
    style.textContent =
    "#grid path{stroke:#1E3650;stroke-width:1;}" +
    "#grid-major path{stroke:#1E3650;stroke-width:1.4;}" +
    ".node-visible{fill:#F2ECDE;stroke:#152232;stroke-width:2;}" +
    ".node-visible.node-selected,.node-visible.node-origin{stroke:#61B7DE;stroke-width:3.5;}" +
    ".node-label{font-family:'Roboto Slab',serif;font-weight:700;font-size:14px;fill:#152232;text-anchor:middle;dominant-baseline:central;}" +
    ".edge-visible{fill:none;stroke-linecap:round;}" +
    ".edge-visible.edge-default{stroke:#5B7A99;stroke-width:2.25;}" +
    ".edge-visible.edge-selected{stroke:#61B7DE;stroke-width:3;}" +
    ".edge-visible.edge-current{stroke:#61B7DE;stroke-width:3.5;}" +
    ".edge-visible.edge-mst{stroke:#E3A23A;stroke-width:4.5;}" +
    ".edge-visible.edge-rejected{stroke:#3C5570;stroke-width:2;stroke-dasharray:2 5;}" +
    ".weight-chip rect{fill:#F2ECDE;stroke:#152232;stroke-width:1;}" +
    ".weight-chip.mst rect{stroke:#a8792f;stroke-width:1.4;}" +
    ".weight-chip.current rect{stroke:#61B7DE;stroke-width:1.4;}" +
    ".weight-chip text{font-family:'IBM Plex Mono',monospace;font-size:11.5px;fill:#152232;text-anchor:middle;dominant-baseline:central;}";

    const bgRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
    );
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("height", height);
    bgRect.setAttribute("fill", "#0E1B2A");

    clone.insertBefore(bgRect, clone.firstChild);
    clone.insertBefore(style, clone.firstChild);

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], {
    type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
    const scale = 2;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = width * scale;
    canvasEl.height = height * scale;
    const ctx = canvasEl.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(svgUrl);

    canvasEl.toBlob((blob) => {
        if (!blob) {
        showTransientMessage("No se pudo generar la imagen.", "error");
        return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = pngUrl;
        a.download = "red-aem-" + stamp + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
    }, "image/png");
    };
    img.onerror = () => {
    URL.revokeObjectURL(svgUrl);
    showTransientMessage("No se pudo generar la imagen.", "error");
    };
    img.src = svgUrl;
}

btnImport.addEventListener("click", () => fileImport.click());
fileImport.addEventListener("change", () => {
    const file = fileImport.files && fileImport.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
    try {
        const data = JSON.parse(reader.result);
        const proceed = () => {
        try {
            loadNetwork(data);
            showTransientMessage(
            "Red cargada correctamente desde el archivo.",
            "success",
            );
        } catch (err) {
            showTransientMessage(err.message, "error");
        }
        };
        if (nodes.length > 0 || edges.length > 0) {
        showConfirm(
            "Cargar este archivo reemplazará la red actual. ¿Deseas continuar?",
            proceed,
            "Cargar red",
        );
        } else {
        proceed();
        }
    } catch (err) {
        showTransientMessage("El archivo no es un JSON válido.", "error");
    }
    fileImport.value = "";
    };
    reader.readAsText(file);
});

  // Red de ejemplo, útil para probar el algoritmo rápidamente.
const EXAMPLE_NETWORK = {
    nodes: [
    { id: "n0", x: 200, y: 150, label: "A" },
    { id: "n1", x: 420, y: 110, label: "B" },
    { id: "n2", x: 640, y: 170, label: "C" },
    { id: "n3", x: 250, y: 380, label: "D" },
    { id: "n4", x: 480, y: 400, label: "E" },
    { id: "n5", x: 700, y: 400, label: "F" },
    ],
    edges: [
    { id: "e0", a: "n0", b: "n1", weight: 4 },
    { id: "e1", a: "n1", b: "n2", weight: 3 },
    { id: "e2", a: "n0", b: "n3", weight: 6 },
    { id: "e3", a: "n1", b: "n4", weight: 5 },
    { id: "e4", a: "n2", b: "n5", weight: 2 },
    { id: "e5", a: "n3", b: "n4", weight: 1 },
    { id: "e6", a: "n4", b: "n5", weight: 7 },
    { id: "e7", a: "n1", b: "n3", weight: 8 },
    ],
};
btnExample.addEventListener("click", () => {
    const proceed = () => {
    loadNetwork(JSON.parse(JSON.stringify(EXAMPLE_NETWORK)));
    showTransientMessage(
        "Red de ejemplo cargada (6 nodos, 8 arcos).",
        "success",
    );
    };
    if (nodes.length > 0 || edges.length > 0) {
    showConfirm(
        "Esto reemplazará la red actual por una red de ejemplo. ¿Deseas continuar?",
        proceed,
        "Cargar red de ejemplo",
    );
    } else {
    proceed();
    }
});

  // ============================================================
  //  INICIO
  // ============================================================
setMode("select");
render();
updateSidebar();
})();
