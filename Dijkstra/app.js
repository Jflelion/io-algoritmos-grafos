(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const NODE_R = 19;
  const VIEW_W = 1000;
  const VIEW_H = 650;

  /* ==================================================================
 *  ALGORITMO DE DIJKSTRA — Caminos mínimos desde un nodo origen
 *  ------------------------------------------------------------------
 *  Sección independiente de la interfaz: recibe la red (nodos y arcos),
 *  el nodo origen y si la red es dirigida, y devuelve:
 *    - dist[v]     distancia mínima desde el origen hasta v (Infinity
 *                  si v es inalcanzable)
 *    - prev[v]     nodo predecesor de v en el camino mínimo
 *    - prevEdge[v] id del arco usado para llegar a v
 *    - order       orden en que los nodos recibieron etiqueta permanente
 *    - steps       lista de "fotografías" del estado del algoritmo, usada
 *                  por la interfaz para mostrar la ejecución paso a paso
 *
 *  Implementación clásica O(V²) con etiquetas temporales y permanentes:
 *    1. d(origen) = 0, d(v) = ∞ para todo otro nodo.
 *    2. Entre los nodos con etiqueta temporal, se elige el de menor
 *       distancia u y su etiqueta pasa a ser permanente.
 *    3. Para cada arco u→v con v temporal, se "relaja" el arco:
 *         si d(u) + w(u,v) < d(v)  ⇒  d(v) = d(u) + w(u,v), pred(v) = u
 *    4. Se repite 2–3 hasta que no queden nodos temporales alcanzables.
 *  Requiere pesos NO negativos: así, cuando un nodo se vuelve permanente,
 *  ningún camino posterior puede mejorar su distancia.
 * ================================================================== */
  const Dijkstra = (function () {

  // Construye la lista de adyacencia. En una red no dirigida cada arco
  // se recorre en ambos sentidos.
  function buildAdjacency(nodes, edges, directed) {
    const adj = {};
    nodes.forEach((n) => (adj[n.id] = []));
    edges.forEach((e) => {
      if (!(e.a in adj) || !(e.b in adj)) return;
      adj[e.a].push({ to: e.b, w: e.weight, edgeId: e.id });
      if (!directed) adj[e.b].push({ to: e.a, w: e.weight, edgeId: e.id });
    });
    return adj;
  }

  // Valida que la red permita ejecutar Dijkstra. Devuelve un mensaje
  // de error o null si todo está bien.
  function validate(nodes, edges, sourceId, directed) {
    if (nodes.length === 0) return "La red está vacía: agrega nodos y arcos.";
    if (nodes.length < 2)
      return "Agrega al menos dos nodos para calcular caminos mínimos.";
    if (edges.length === 0)
      return "La red no tiene arcos: crea al menos un arco entre dos nodos.";
    if (sourceId == null)
      return "Selecciona un nodo de origen antes de ejecutar el algoritmo.";
    const ids = new Set(nodes.map((n) => n.id));
    if (!ids.has(sourceId)) return "El nodo de origen seleccionado ya no existe.";
    for (const e of edges) {
      if (!ids.has(e.a) || !ids.has(e.b))
        return "Existe un arco que referencia un nodo inexistente.";
      if (typeof e.weight !== "number" || !isFinite(e.weight))
        return "Existe un arco con un peso no numérico.";
      if (e.weight < 0)
        return (
          "Existe un arco con peso negativo (" +
          e.weight +
          "). Dijkstra solo es válido con pesos no negativos."
        );
    }
    const adj = buildAdjacency(nodes, edges, directed);
    if (adj[sourceId].length === 0)
      return directed
        ? "El nodo de origen no tiene arcos salientes: ningún otro nodo es alcanzable desde él."
        : "El nodo de origen no tiene arcos conectados: ningún otro nodo es alcanzable desde él.";
    return null;
  }

  function run(nodes, edges, sourceId, directed) {
    const adj = buildAdjacency(nodes, edges, directed);
    const dist = {},
      prev = {},
      prevEdge = {};
    const permanent = new Set();
    const order = [];
    const steps = [];

    nodes.forEach((n) => {
      dist[n.id] = Infinity;
      prev[n.id] = null;
      prevEdge[n.id] = null;
    });
    dist[sourceId] = 0;

    // Guarda una copia del estado actual para la visualización.
    function snapshot(extra) {
      steps.push(
        Object.assign(
          {
            dist: Object.assign({}, dist),
            prev: Object.assign({}, prev),
            prevEdge: Object.assign({}, prevEdge),
            permanent: Array.from(permanent),
            current: null,
            edgeId: null,
            target: null,
          },
          extra,
        ),
      );
    }

    snapshot({ kind: "init", iteration: 0 });

    let iteration = 0;
    while (true) {
      // Paso 2: nodo temporal con la menor distancia (empates: el primero
      // en el orden de creación de los nodos).
      let u = null;
      nodes.forEach((n) => {
        if (permanent.has(n.id) || dist[n.id] === Infinity) return;
        if (u === null || dist[n.id] < dist[u]) u = n.id;
      });
      if (u === null) break; // no quedan nodos temporales alcanzables

      iteration++;
      permanent.add(u);
      order.push(u);
      snapshot({ kind: "select", iteration, current: u });

      // Paso 3: relajación de los arcos que salen de u.
      adj[u].forEach((arc) => {
        const v = arc.to;
        if (permanent.has(v)) return;
        const candidate = dist[u] + arc.w;
        const before = dist[v];
        let outcome;
        if (candidate < before) {
          dist[v] = candidate;
          prev[v] = u;
          prevEdge[v] = arc.edgeId;
          outcome = before === Infinity ? "first" : "improved";
        } else {
          outcome = candidate === before ? "tie" : "kept";
        }
        snapshot({
          kind: "relax",
          iteration,
          current: u,
          edgeId: arc.edgeId,
          target: v,
          weight: arc.w,
          candidate,
          before,
          outcome,
        });
      });
    }

    const unreachable = nodes
      .filter((n) => dist[n.id] === Infinity)
      .map((n) => n.id);
    snapshot({ kind: "done", iteration, unreachable });

    return { dist, prev, prevEdge, order, steps, unreachable, source: sourceId };
  }

  // Reconstruye la secuencia de nodos origen → destino siguiendo los
  // predecesores. Devuelve null si el destino es inalcanzable.
  function pathTo(result, targetId) {
    if (result.dist[targetId] === Infinity) return null;
    const nodesSeq = [],
      edgesSeq = [];
    let cur = targetId;
    while (cur != null) {
      nodesSeq.unshift(cur);
      if (result.prevEdge[cur] != null) edgesSeq.unshift(result.prevEdge[cur]);
      cur = result.prev[cur];
    }
    return { nodes: nodesSeq, edges: edgesSeq };
  }

    return { validate, run, pathTo, buildAdjacency };
  })();

  // ============================================================
  //  ESTADO DE LA APLICACIÓN
  // ============================================================
  let nodes = []; // {id, x, y, label}
  let edges = []; // {id, a, b, weight}   (en red dirigida: a → b)
  let idCounter = 0;
  let directed = false;
  let originId = null;

  let mode = "select"; // 'select' | 'add-node' | 'add-edge'
  let pendingEdgeStart = null; // nodo inicial mientras se crea un arco
  let selected = { type: null, id: null };

  // Resultado de Dijkstra (ver sección ALGORITMO DE DIJKSTRA) y estado de la visualización
  let result = null;
  let stepIndex = 0;
  let playTimer = null;
  let focusTarget = null; // nodo destino cuyo recorrido se resalta

  // ============================================================
  //  REFERENCIAS AL DOM
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const svg = $("canvas");
  const edgesLayer = $("edges-layer");
  const nodesLayer = $("nodes-layer");
  const mainEl = $("main");
  const emptyHint = $("empty-hint");
  const canvasBanner = $("canvas-banner");

  const btnModeSelect = $("mode-select");
  const btnModeAddNode = $("mode-add-node");
  const btnModeAddEdge = $("mode-add-edge");
  const modeHint = $("mode-hint");
  const btnTypeUndirected = $("type-undirected");
  const btnTypeDirected = $("type-directed");
  const typeHint = $("type-hint");

  const panelNone = $("panel-none");
  const panelNode = $("panel-node");
  const panelEdge = $("panel-edge");
  const nodeTitle = $("node-title");
  const nodeSub = $("node-sub");
  const nodePath = $("node-path");
  const edgeTitle = $("edge-title");
  const edgeWeightInput = $("edge-weight-input");
  const edgeWeightError = $("edge-weight-error");
  const btnSetOrigin = $("btn-set-origin");
  const btnRenameNode = $("btn-rename-node");
  const btnDeleteNode = $("btn-delete-node");
  const btnDeleteEdge = $("btn-delete-edge");
  const btnUpdateWeight = $("btn-update-weight");
  const btnReverseEdge = $("btn-reverse-edge");

  const originSelect = $("origin-select");
  const chkSteps = $("chk-steps");
  const btnRun = $("btn-run");
  const btnResetResult = $("btn-reset-result");
  const statusArea = $("status-area");

  const stepperBlock = $("stepper-block");
  const stepFirst = $("step-first");
  const stepPrev = $("step-prev");
  const stepPlay = $("step-play");
  const stepNext = $("step-next");
  const stepLast = $("step-last");
  const stepRange = $("step-range");
  const stepCounter = $("step-counter");
  const stepMessage = $("step-message");
  const btnIterTable = $("btn-iter-table");
  const iterDrawer = $("iter-drawer");
  const iterTable = $("iter-table");

  const resultsBlock = $("results-block");
  const resultsBody = document.querySelector("#results-table tbody");
  const focusDetail = $("focus-detail");

  const statNodes = $("stat-nodes");
  const statEdges = $("stat-edges");
  const statOrigin = $("stat-origin");
  const statType = $("stat-type");
  const connDot = $("conn-dot");
  const connText = $("conn-text");

  const modalOverlay = $("modal-overlay");
  const modalTitle = $("modal-title");
  const modalLabel = $("modal-label");
  const modalInput = $("modal-input");
  const modalError = $("modal-error");
  const confirmOverlay = $("confirm-overlay");
  const toastEl = $("toast");

  $("cartouche-date").textContent = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // ============================================================
  //  UTILIDADES
  // ============================================================
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function letterLabel(index) {
    let n = index + 1,
      s = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  // Primera etiqueta alfabética (A, B, …, Z, AA, …) que no esté en uso.
  function nextFreeLabel() {
    const used = new Set(nodes.map((n) => n.label));
    for (let i = 0; ; i++) {
      const l = letterLabel(i);
      if (!used.has(l)) return l;
    }
  }

  const findNode = (id) => nodes.find((n) => n.id === id);
  const findEdge = (id) => edges.find((e) => e.id === id);
  const labelOf = (id) => {
    const n = findNode(id);
    return n ? n.label : "?";
  };
  const L = (id) => esc(labelOf(id)); // etiqueta lista para insertar en HTML

  function edgeExists(a, b) {
    return edges.some(
      (e) => (e.a === a && e.b === b) || (!directed && e.a === b && e.b === a),
    );
  }
  function hasReverse(e) {
    return directed && edges.some((o) => o.a === e.b && o.b === e.a);
  }

  function fmt(w) {
    if (w === Infinity) return "∞";
    if (Number.isInteger(w)) return String(w);
    return String(Math.round(w * 100) / 100);
  }

  function arrowSym() {
    return directed ? "→" : "–";
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function toSvgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Valida el texto de un peso. Dijkstra exige pesos numéricos ≥ 0.
  function parseWeight(raw) {
    const s = String(raw).trim().replace(",", ".");
    if (s === "") return { error: "Ingresa un valor para el peso del arco." };
    const v = Number(s);
    if (!isFinite(v)) return { error: "El peso debe ser un número válido (ej. 4, 2.5)." };
    if (v < 0)
      return {
        error: "No se permiten pesos negativos: el algoritmo de Dijkstra solo funciona con pesos ≥ 0.",
      };
    return { value: v };
  }

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3800);
  }

  function setStatus(html) {
    statusArea.innerHTML = html || "";
  }
  function statusCard(msg, kind) {
    return '<div class="status-card ' + (kind || "") + '">' + msg + "</div>";
  }

  // ============================================================
  //  ESTADO DEL RESULTADO
  // ============================================================
  function currentSnapshot() {
    return result ? result.steps[stepIndex] : null;
  }
  function isFinalStep() {
    return result && stepIndex === result.steps.length - 1;
  }

  // Cualquier cambio estructural de la red invalida el resultado.
  function invalidateResult() {
    stopPlay();
    result = null;
    stepIndex = 0;
    focusTarget = null;
    setStatus("");
    iterDrawer.classList.add("hidden");
    updateResultPanels();
  }

  // ============================================================
  //  MUTACIONES DE LA RED
  // ============================================================
  function addNode(x, y) {
    const id = "n" + idCounter++;
    nodes.push({
      id,
      x: clamp(x, 30, VIEW_W - 30),
      y: clamp(y, 30, VIEW_H - 30),
      label: nextFreeLabel(),
    });
    invalidateResult();
    refreshAll();
  }

  function addEdge(a, b, weight) {
    if (!findNode(a) || !findNode(b)) {
      toast("No se puede crear el arco: uno de los nodos no existe.", "error");
      return;
    }
    edges.push({ id: "e" + idCounter++, a, b, weight });
    invalidateResult();
    refreshAll();
  }

  function deleteNode(id) {
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => e.a !== id && e.b !== id);
    if (originId === id) originId = null;
    selected = { type: null, id: null };
    invalidateResult();
    refreshAll();
  }

  function deleteEdge(id) {
    edges = edges.filter((e) => e.id !== id);
    selected = { type: null, id: null };
    invalidateResult();
    refreshAll();
  }

  function setEdgeWeight(id, w) {
    const e = findEdge(id);
    if (!e) return;
    e.weight = w;
    invalidateResult();
    refreshAll();
  }

  function reverseEdge(id) {
    const e = findEdge(id);
    if (!e) return;
    if (edges.some((o) => o.a === e.b && o.b === e.a)) {
      toast("Ya existe un arco en el sentido contrario.", "error");
      return;
    }
    const t = e.a;
    e.a = e.b;
    e.b = t;
    invalidateResult();
    refreshAll();
  }

  function setOrigin(id) {
    if (originId === id) return;
    originId = id;
    invalidateResult();
    refreshAll();
  }

  function setDirected(flag) {
    if (flag === directed) return;
    if (!flag) {
      const pair = edges.find((e) =>
        edges.some((o) => o !== e && o.a === e.b && o.b === e.a),
      );
      if (pair) {
        toast(
          "Hay arcos en ambos sentidos entre " + labelOf(pair.a) + " y " + labelOf(pair.b) +
            ". Elimina uno de ellos antes de convertir la red en no dirigida.",
          "error",
        );
        return;
      }
    }
    directed = flag;
    invalidateResult();
    refreshAll();
  }

  function clearAll() {
    nodes = [];
    edges = [];
    originId = null;
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    invalidateResult();
    refreshAll();
  }

  // ============================================================
  //  MODAL DE ENTRADA (peso o nombre) Y MODAL DE CONFIRMACIÓN
  // ============================================================
  let modalOpts = null;
  function openInputModal(opts) {
    modalOpts = opts;
    modalTitle.textContent = opts.title;
    modalLabel.textContent = opts.label || "Valor / peso";
    modalInput.type = opts.inputType || "number";
    modalInput.value = opts.initial != null ? opts.initial : "";
    modalError.textContent = "";
    modalOverlay.classList.remove("hidden");
    modalInput.focus();
    modalInput.select();
  }
  function closeModal() {
    modalInput.blur(); // devuelve el teclado a los atajos del lienzo
    modalOverlay.classList.add("hidden");
    modalOpts = null;
  }
  function confirmModal() {
    if (!modalOpts) return;
    const res = modalOpts.validate(modalInput.value);
    if (res.error) {
      modalError.textContent = res.error;
      modalInput.focus();
      return;
    }
    const cb = modalOpts.onConfirm;
    closeModal();
    cb(res.value);
  }
  $("modal-confirm").addEventListener("click", confirmModal);
  $("modal-cancel").addEventListener("click", closeModal);
  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmModal();
    if (e.key === "Escape") closeModal();
  });

  function askWeight(title, initial, onConfirm) {
    openInputModal({
      title,
      label: "Valor / peso (número ≥ 0)",
      inputType: "number",
      initial,
      validate: parseWeight,
      onConfirm,
    });
  }

  function askRename(id) {
    const n = findNode(id);
    if (!n) return;
    openInputModal({
      title: "Renombrar nodo " + n.label,
      label: "Nombre del nodo (máx. 6 caracteres)",
      inputType: "text",
      initial: n.label,
      validate: (raw) => {
        const v = raw.trim();
        if (v === "") return { error: "El nombre no puede quedar vacío." };
        if (v.length > 6) return { error: "Usa como máximo 6 caracteres." };
        if (nodes.some((o) => o.id !== id && o.label === v))
          return { error: "Ya existe otro nodo con ese nombre." };
        return { value: v };
      },
      onConfirm: (v) => {
        n.label = v;
        refreshAll();
      },
    });
  }

  let confirmOnYes = null;
  function showConfirm(message, onYes, title) {
    $("confirm-title").textContent = title || "Confirmar acción";
    $("confirm-message").textContent = message;
    confirmOnYes = onYes;
    confirmOverlay.classList.remove("hidden");
  }
  $("confirm-ok").addEventListener("click", () => {
    const cb = confirmOnYes;
    confirmOverlay.classList.add("hidden");
    confirmOnYes = null;
    if (cb) cb();
  });
  $("confirm-cancel").addEventListener("click", () => {
    confirmOverlay.classList.add("hidden");
    confirmOnYes = null;
  });

  // ============================================================
  //  GEOMETRÍA DE LOS ARCOS
  // ============================================================
  // Devuelve los puntos de una curva cuadrática P0 → C → P2 recortada en
  // el borde de los nodos. Si existe el arco opuesto (red dirigida), la
  // curva se arquea para que ambos sentidos sean visibles.
  function edgeGeometry(e) {
    const na = findNode(e.a),
      nb = findNode(e.b);
    const dx = nb.x - na.x,
      dy = nb.y - na.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len,
      ny = dx / len;
    const bend = hasReverse(e) ? 34 : 0;
    const C = { x: (na.x + nb.x) / 2 + nx * bend, y: (na.y + nb.y) / 2 + ny * bend };
    const trim = (P, toward, r) => {
      const vx = toward.x - P.x,
        vy = toward.y - P.y;
      const l = Math.hypot(vx, vy) || 1;
      return { x: P.x + (vx / l) * r, y: P.y + (vy / l) * r, ux: -vx / l, uy: -vy / l };
    };
    // Extremos sobre el borde del nodo; u = dirección "hacia dentro" del nodo.
    const P0 = trim(na, C, NODE_R + 2);
    const P2 = trim(nb, C, NODE_R + 2);
    // Punto medio de la curva (t = 0.5) para la etiqueta del peso.
    const mx = 0.25 * na.x + 0.5 * C.x + 0.25 * nb.x;
    const my = 0.25 * na.y + 0.5 * C.y + 0.25 * nb.y;
    const off = bend ? 14 : 15;
    return { P0, P2, C, chip: { x: mx + nx * off, y: my + ny * off } };
  }

  function arrowPoints(tip) {
    const ux = tip.ux,
      uy = tip.uy;
    const bx = tip.x - ux * 13,
      by = tip.y - uy * 13;
    const px = -uy * 6.5,
      py = ux * 6.5;
    return [tip.x, tip.y, bx + px, by + py, bx - px, by - py].map((v) => v.toFixed(1)).join(",");
  }

  // ============================================================
  //  RENDER DEL LIENZO
  // ============================================================
  function focusPath() {
    if (!result || !isFinalStep() || focusTarget == null) return null;
    return Dijkstra.pathTo(result, focusTarget);
  }

  function render() {
    emptyHint.classList.toggle("hidden", nodes.length > 0);
    const snap = currentSnapshot();
    const final = isFinalStep();
    const fp = focusPath();
    const focusEdges = new Set(fp ? fp.edges : []);
    const focusNodes = new Set(fp ? fp.nodes : []);
    const permanent = new Set(snap ? snap.permanent : []);

    // Arcos del árbol de caminos mínimos (en el paso actual) con su
    // sentido de recorrido: prevEdge[v] se usa para llegar a v desde prev[v].
    const treeEdges = new Map(); // edgeId -> {from, to, perm}
    if (snap) {
      for (const v in snap.prevEdge) {
        const eid = snap.prevEdge[v];
        if (eid != null) treeEdges.set(eid, { from: snap.prev[v], to: v, perm: permanent.has(v) });
      }
    }

    // ---------- Arcos ----------
    edgesLayer.innerHTML = "";
    edges.forEach((e) => {
      const na = findNode(e.a),
        nb = findNode(e.b);
      if (!na || !nb) return;
      const tree = treeEdges.get(e.id);
      let cls = "edge-group";
      if (selected.type === "edge" && selected.id === e.id) cls += " selected";
      else if (snap && snap.kind === "relax" && snap.edgeId === e.id) cls += " current";
      else if (focusEdges.has(e.id)) cls += " focus";
      else if (tree && (tree.perm || final)) cls += " tree";
      else if (final) cls += " faded";

      const g = el("g", { class: cls, "data-edge-id": e.id }, edgesLayer);
      const geo = edgeGeometry(e);
      const d =
        "M" + geo.P0.x + "," + geo.P0.y + " Q" + geo.C.x + "," + geo.C.y + " " + geo.P2.x + "," + geo.P2.y;
      el("path", { class: "edge-hit", d }, g);
      el("path", { class: "edge-visible", d }, g);

      // Flecha: siempre en red dirigida; en red no dirigida se dibuja sobre
      // los arcos del camino mínimo para indicar el sentido del recorrido.
      let arrowTo = null;
      if (directed) arrowTo = e.b;
      else if (tree && (tree.perm || final)) arrowTo = tree.to;
      else if (snap && snap.kind === "relax" && snap.edgeId === e.id) arrowTo = snap.target;
      if (arrowTo != null) {
        el("polygon", { class: "edge-arrow", points: arrowPoints(arrowTo === e.b ? geo.P2 : geo.P0) }, g);
      }

      const text = fmt(e.weight);
      const w = Math.max(22, text.length * 7.2 + 12);
      const chip = el("g", { class: "weight-chip" }, g);
      el("rect", { x: geo.chip.x - w / 2, y: geo.chip.y - 10, width: w, height: 20, rx: 3 }, chip);
      el("text", { x: geo.chip.x, y: geo.chip.y + 0.5 }, chip).textContent = text;
    });

    // ---------- Nodos ----------
    nodesLayer.innerHTML = "";
    nodes.forEach((n) => {
      let cls = "node-group";
      if (n.id === originId) cls += " origin";
      if (snap) {
        if (permanent.has(n.id)) cls += " permanent";
        if (snap.kind !== "done" && snap.current === n.id) cls += " current";
        if (snap.kind === "relax" && snap.target === n.id) cls += " target";
        if (final && snap.dist[n.id] === Infinity) cls += " unreachable";
        if (fp) cls += focusNodes.has(n.id) ? (n.id === focusTarget ? " focus" : "") : " dimmed";
      }
      if (selected.type === "node" && selected.id === n.id && !fp) cls += " selected";
      if (pendingEdgeStart === n.id) cls += " pending";

      const g = el("g", { class: cls, "data-node-id": n.id, transform: "translate(" + n.x + "," + n.y + ")" }, nodesLayer);
      el("circle", { class: "node-hit", r: 25 }, g);
      el("circle", { class: "node-visible", r: NODE_R }, g);
      el("text", { class: "node-label" }, g).textContent = n.label;

      const labelAbove = n.y > 70;
      if (n.id === originId) {
        el("text", { class: "origin-tag", y: labelAbove ? 31 : -31 }, g).textContent = "ORIGEN";
      }

      // Etiqueta de Dijkstra: [d, p] permanente · (d, p) temporal · ∞
      if (snap) {
        const dv = snap.dist[n.id];
        const p = snap.prev[n.id];
        const isPerm = permanent.has(n.id);
        let text, lcls = "dist-label";
        if (dv === Infinity) {
          text = "∞";
          lcls += " inf";
        } else {
          const body = fmt(dv) + ", " + (p != null ? labelOf(p) : "–");
          text = isPerm ? "[" + body + "]" : "(" + body + ")";
          if (isPerm) lcls += " perm";
        }
        if (snap.kind === "relax" && snap.target === n.id && (snap.outcome === "first" || snap.outcome === "improved"))
          lcls += " updated";
        if (fp && n.id === focusTarget) lcls += " focus";
        const w = Math.max(26, text.length * 7 + 12);
        const ly = labelAbove ? -36 : 36;
        const lab = el("g", { class: lcls }, g);
        el("rect", { x: -w / 2, y: ly - 10, width: w, height: 20, rx: 3 }, lab);
        el("text", { y: ly + 0.5 }, lab).textContent = text;
      }
    });

    renderBanner(snap, fp);
  }

  function renderBanner(snap, fp) {
    let html = "";
    if (fp) {
      html =
        "Camino mínimo " + L(result.source) + " " + arrowSym() + " " + L(focusTarget) + ": " +
        '<span class="mono">' + fp.nodes.map(L).join(" → ") + "</span> · distancia " +
        '<span class="mono">' + fmt(result.dist[focusTarget]) + "</span>";
    } else if (snap && !isFinalStep()) {
      html = stepTitle(snap);
    } else if (!result && originId && nodes.length) {
      html = "";
    }
    canvasBanner.innerHTML = html;
    canvasBanner.classList.toggle("hidden", !html);
  }

  // ============================================================
  //  PANELES (selección, estado, origen, resultados)
  // ============================================================
  function updateSidebar() {
    panelNone.classList.add("hidden");
    panelNode.classList.add("hidden");
    panelEdge.classList.add("hidden");

    if (selected.type === "node") {
      const n = findNode(selected.id);
      if (!n) {
        selected = { type: null, id: null };
        return updateSidebar();
      }
      panelNode.classList.remove("hidden");
      nodeTitle.textContent = "Nodo " + n.label + (n.id === originId ? " (origen)" : "");
      const degOut = edges.filter((e) => e.a === n.id || (!directed && e.b === n.id)).length;
      const degIn = edges.filter((e) => e.b === n.id).length;
      nodeSub.textContent = directed
        ? "Arcos salientes: " + degOut + " · entrantes: " + degIn
        : "Arcos conectados: " + degOut;
      btnSetOrigin.disabled = n.id === originId;
      btnSetOrigin.innerHTML =
        '<span class="tool-icon">◎</span> ' + (n.id === originId ? "Es el nodo origen" : "Establecer como origen");

      // Recorrido desde el origen, si ya se ejecutó Dijkstra
      if (result && isFinalStep()) {
        nodePath.classList.remove("hidden");
        nodePath.innerHTML = pathSummaryHtml(n.id);
      } else nodePath.classList.add("hidden");
    } else if (selected.type === "edge") {
      const e = findEdge(selected.id);
      if (!e) {
        selected = { type: null, id: null };
        return updateSidebar();
      }
      panelEdge.classList.remove("hidden");
      edgeTitle.textContent = "Arco " + labelOf(e.a) + " " + arrowSym() + " " + labelOf(e.b);
      if (document.activeElement !== edgeWeightInput) edgeWeightInput.value = e.weight;
      edgeWeightError.textContent = "";
      btnReverseEdge.classList.toggle("hidden", !directed);
    } else {
      panelNone.classList.remove("hidden");
    }
  }

  function pathSummaryHtml(id) {
    if (id === result.source) return "Este es el nodo origen: distancia <span class=\"mono\">0</span>.";
    const p = Dijkstra.pathTo(result, id);
    if (!p)
      return "<b>Inalcanzable:</b> no existe ningún camino desde " + L(result.source) + " hasta " + L(id) + " (distancia ∞).";
    return (
      'Distancia mínima: <span class="mono">' + fmt(result.dist[id]) + "</span><br>" +
      'Recorrido: <span class="mono">' + p.nodes.map(L).join(" → ") + "</span>"
    );
  }

  function updateModeUI() {
    [btnModeSelect, btnModeAddNode, btnModeAddEdge].forEach((b) => b.classList.remove("active"));
    ({ select: btnModeSelect, "add-node": btnModeAddNode, "add-edge": btnModeAddEdge })[mode].classList.add("active");
    mainEl.className = "mode-" + mode;
    modeHint.textContent =
      mode === "add-node"
        ? "Haz clic en un espacio vacío del lienzo para ubicar un nuevo nodo."
        : mode === "add-edge"
          ? pendingEdgeStart
            ? "Nodo " + labelOf(pendingEdgeStart) + " elegido. Ahora haz clic en el nodo " + (directed ? "destino" : "a conectar") + " (Esc cancela)."
            : "Haz clic en el nodo " + (directed ? "de salida" : "inicial") + " y luego en el otro nodo; después ingresa el peso."
          : "";

    btnTypeUndirected.classList.toggle("active", !directed);
    btnTypeDirected.classList.toggle("active", directed);
    btnTypeUndirected.setAttribute("aria-checked", String(!directed));
    btnTypeDirected.setAttribute("aria-checked", String(directed));
    typeHint.textContent = directed
      ? "Cada arco tiene un sentido (flecha): solo puede recorrerse de su nodo inicial a su nodo final."
      : "Cada arco puede recorrerse en ambos sentidos.";
  }

  function updateOriginSelect() {
    originSelect.innerHTML = "";
    originSelect.appendChild(new Option(nodes.length ? "— Selecciona el nodo origen —" : "— No hay nodos —", ""));
    nodes.forEach((n) => originSelect.appendChild(new Option(n.label, n.id)));
    originSelect.value = originId || "";
  }

  // Nodos alcanzables desde el origen (búsqueda en anchura).
  function reachableFrom(src) {
    const adj = Dijkstra.buildAdjacency(nodes, edges, directed);
    const seen = new Set([src]);
    const queue = [src];
    while (queue.length) {
      const u = queue.shift();
      adj[u].forEach((a) => {
        if (!seen.has(a.to)) {
          seen.add(a.to);
          queue.push(a.to);
        }
      });
    }
    return seen;
  }

  function updateStats() {
    statNodes.textContent = nodes.length;
    statEdges.textContent = edges.length;
    statOrigin.textContent = originId ? labelOf(originId) : "—";
    statType.textContent = directed ? "Dirigida" : "No dirigida";
    if (nodes.length === 0) {
      connDot.className = "conn-dot";
      connText.textContent = "Sin datos";
    } else if (!originId) {
      connDot.className = "conn-dot";
      connText.textContent = "Selecciona un origen para verificar alcanzabilidad";
    } else {
      const r = reachableFrom(originId);
      const ok = r.size === nodes.length;
      connDot.className = "conn-dot " + (ok ? "ok" : "bad");
      connText.textContent = ok
        ? "Todos los nodos son alcanzables desde " + labelOf(originId)
        : r.size - 1 + " de " + (nodes.length - 1) + " nodos alcanzables desde " + labelOf(originId);
    }
  }

  // ---------- Paso a paso ----------
  function stepTitle(s) {
    if (s.kind === "init") return "Inicialización";
    if (s.kind === "select") return "Iteración " + s.iteration + " · se fija la etiqueta de " + L(s.current);
    if (s.kind === "relax")
      return "Iteración " + s.iteration + " · se evalúa el arco " + L(s.current) + " → " + L(s.target);
    return "Fin del algoritmo";
  }

  function stepMessageHtml(s) {
    const tag = '<span class="tag">' + stepTitle(s) + "</span><br>";
    const lab = (v) => {
      const d = s.dist[v];
      if (d === Infinity) return "∞";
      return "(" + fmt(d) + ", " + (s.prev[v] != null ? L(s.prev[v]) : "–") + ")";
    };
    if (s.kind === "init") {
      return (
        tag + "El origen <b>" + L(result.source) + "</b> recibe la etiqueta <span class=\"mono\">[0, –]</span>. " +
        "Los demás nodos comienzan con distancia <span class=\"mono\">∞</span> (aún no se conoce un camino hacia ellos)."
      );
    }
    if (s.kind === "select") {
      const u = s.current;
      const pending = Dijkstra.buildAdjacency(nodes, edges, directed)[u].filter(
        (a) => s.permanent.indexOf(a.to) === -1,
      ).length;
      const label = "[" + fmt(s.dist[u]) + ", " + (s.prev[u] != null ? L(s.prev[u]) : "–") + "]";
      return (
        tag +
        (u === result.source
          ? "Se toma el origen <b>" + L(u) + "</b> (distancia 0)"
          : "Entre los nodos con etiqueta temporal, <b>" + L(u) + "</b> tiene la menor distancia (<span class=\"mono\">" + fmt(s.dist[u]) + "</span>)") +
        "; su etiqueta <span class=\"mono\">" + label + "</span> se vuelve <b>permanente</b>. " +
        (pending
          ? "Ahora se revisan sus " + pending + " arco(s) hacia nodos temporales."
          : "No tiene arcos hacia nodos temporales.")
      );
    }
    if (s.kind === "relax") {
      const u = s.current,
        v = s.target;
      let txt =
        tag + '<span class="mono">d(' + L(u) + ") + w = " + fmt(s.dist[u]) + " + " + fmt(s.weight) + " = " +
        fmt(s.candidate) + "</span><br>";
      if (s.outcome === "first")
        txt += '<span class="up">' + L(v) + " no tenía etiqueta (∞) → nueva etiqueta temporal " + lab(v) + ".</span>";
      else if (s.outcome === "improved")
        txt += '<span class="up">' + fmt(s.candidate) + " &lt; " + fmt(s.before) + " → se mejora la etiqueta de " + L(v) + ": " + lab(v) + ".</span>";
      else if (s.outcome === "tie")
        txt += '<span class="keep">' + fmt(s.candidate) + " = " + fmt(s.before) + " → misma distancia; " + L(v) + " conserva " + lab(v) + " (camino alterno de igual longitud).</span>";
      else
        txt += '<span class="keep">' + fmt(s.candidate) + " ≥ " + fmt(s.before) + " → no mejora; " + L(v) + " conserva " + lab(v) + ".</span>";
      return txt;
    }
    let txt = tag + "Todos los nodos alcanzables tienen etiqueta permanente: las distancias mínimas son definitivas.";
    if (s.unreachable.length)
      txt += "<br><span class=\"keep\">Inalcanzables (distancia ∞): " + s.unreachable.map(L).join(", ") + ".</span>";
    return txt;
  }

  function buildIterTable() {
    const steps = result.steps;
    // Estado al final de cada iteración k (último paso con iteration === k)
    const endOf = {};
    steps.forEach((s, i) => {
      if (s.kind !== "done") endOf[s.iteration] = i;
    });
    const curIter = currentSnapshot().kind === "done" ? -1 : currentSnapshot().iteration;
    let html = "<thead><tr><th>Iteración</th><th>Nodo fijado</th>" +
      nodes.map((n) => "<th>" + esc(n.label) + "</th>").join("") + "</tr></thead><tbody>";
    const maxIter = Math.max.apply(null, Object.keys(endOf).map(Number));
    for (let k = 0; k <= maxIter; k++) {
      const s = steps[endOf[k]];
      const selStep = steps.find((x) => x.kind === "select" && x.iteration === k);
      const u = selStep ? selStep.current : null;
      const before = new Set(selStep ? selStep.permanent.filter((id) => id !== u) : []);
      html += '<tr class="' + (k === curIter ? "active-row" : "") + '"><td class="it">' + k + "</td>" +
        '<td class="sel">' + (u ? L(u) : "—") + "</td>";
      nodes.forEach((n) => {
        const d = s.dist[n.id];
        const p = s.prev[n.id] != null ? L(s.prev[n.id]) : "–";
        if (before.has(n.id)) html += '<td class="fixed">—</td>';
        else if (n.id === u) html += '<td class="perm">[' + fmt(d) + ", " + p + "]</td>";
        else if (d === Infinity) html += '<td class="inf">∞</td>';
        else html += "<td>(" + fmt(d) + ", " + p + ")</td>";
      });
      html += "</tr>";
    }
    iterTable.innerHTML = html + "</tbody>";
  }

  function updateResultPanels() {
    btnResetResult.classList.toggle("hidden", !result);
    stepperBlock.classList.toggle("hidden", !result);
    const final = isFinalStep();
    resultsBlock.classList.toggle("hidden", !final);
    if (!result) return;

    const n = result.steps.length;
    stepRange.max = n - 1;
    stepRange.value = stepIndex;
    stepCounter.textContent = "Paso " + (stepIndex + 1) + " / " + n;
    stepMessage.innerHTML = stepMessageHtml(currentSnapshot());
    stepFirst.disabled = stepPrev.disabled = stepIndex === 0;
    stepNext.disabled = stepLast.disabled = final;
    stepPlay.textContent = playTimer ? "❚❚" : "▶";
    stepPlay.classList.toggle("playing", !!playTimer);
    if (!iterDrawer.classList.contains("hidden")) buildIterTable();

    // Mensaje de estado
    if (final) {
      const reach = nodes.length - result.unreachable.length;
      let html = statusCard(
        "Dijkstra completado desde <b>" + L(result.source) + "</b>. " +
          "Se alcanzaron <b>" + (reach - 1) + " de " + (nodes.length - 1) + "</b> nodos destino.",
        "success",
      );
      if (result.unreachable.length)
        html += statusCard(
          "<b>Nodos inalcanzables:</b> " + result.unreachable.map(L).join(", ") +
            ". No existe ningún camino desde " + L(result.source) + " hasta ellos" +
            (directed ? " respetando el sentido de los arcos" : "") + "; su distancia es ∞.",
          "warn",
        );
      setStatus(html);
    } else {
      setStatus(statusCard("Ejecutando paso a paso. Usa los controles o las flechas ← → del teclado.", ""));
    }

    if (!final) return;
    // Tabla final de distancias y recorridos (en el orden de los nodos)
    resultsBody.innerHTML = "";
    const order = nodes.slice().sort((a, b) => {
      if (a.id === result.source) return -1;
      if (b.id === result.source) return 1;
      return result.dist[a.id] - result.dist[b.id];
    });
    order.forEach((nd) => {
      const tr = document.createElement("tr");
      const d = result.dist[nd.id];
      const p = Dijkstra.pathTo(result, nd.id);
      if (nd.id === result.source) tr.className = "origin-row";
      else if (!p) tr.className = "unreach";
      if (nd.id === focusTarget) tr.className += " focus";
      tr.innerHTML =
        '<td class="node-cell">' + esc(nd.label) + "</td>" +
        '<td class="dist-cell">' + (p ? fmt(d) : "∞") + "</td>" +
        '<td class="route-cell">' +
        (nd.id === result.source ? "origen" : p ? p.nodes.map(L).join(" → ") : "inalcanzable") +
        "</td>";
      tr.addEventListener("click", () => setFocus(nd.id === focusTarget ? null : nd.id));
      resultsBody.appendChild(tr);
    });

    // Detalle del recorrido elegido: secuencia y suma de pesos
    const fp = focusPath();
    if (focusTarget != null) {
      focusDetail.classList.remove("hidden");
      if (focusTarget === result.source) {
        focusDetail.innerHTML = "<b>" + L(focusTarget) + "</b> es el nodo origen (distancia 0).";
      } else if (!fp) {
        focusDetail.innerHTML = "<b>" + L(focusTarget) + "</b> es inalcanzable desde " + L(result.source) + ".";
      } else {
        const ws = fp.edges.map((id) => fmt(findEdge(id).weight));
        focusDetail.innerHTML =
          "Recorrido hasta <b>" + L(focusTarget) + "</b>:<br>" +
          '<span class="mono">' + fp.nodes.map(L).join(" → ") + "</span>" +
          '<div class="breakdown">Distancia = ' + ws.join(" + ") + " = " + fmt(result.dist[focusTarget]) + "</div>";
      }
    } else focusDetail.classList.add("hidden");
  }

  function refreshAll() {
    updateModeUI();
    updateOriginSelect();
    updateStats();
    updateSidebar();
    updateResultPanels();
    render();
  }

  // ============================================================
  //  CONTROLES DE LA EJECUCIÓN
  // ============================================================
  function goToStep(i) {
    if (!result) return;
    stepIndex = clamp(i, 0, result.steps.length - 1);
    if (isFinalStep()) stopPlay();
    updateResultPanels();
    updateSidebar();
    render();
  }

  function stopPlay() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }
  function togglePlay() {
    if (!result) return;
    if (playTimer) {
      stopPlay();
    } else {
      if (isFinalStep()) stepIndex = 0;
      playTimer = setInterval(() => goToStep(stepIndex + 1), 1100);
    }
    goToStep(stepIndex);
  }

  function setFocus(id) {
    focusTarget = id;
    updateResultPanels();
    updateSidebar();
    render();
  }

  stepFirst.addEventListener("click", () => { stopPlay(); goToStep(0); });
  stepPrev.addEventListener("click", () => { stopPlay(); goToStep(stepIndex - 1); });
  stepNext.addEventListener("click", () => { stopPlay(); goToStep(stepIndex + 1); });
  stepLast.addEventListener("click", () => { stopPlay(); goToStep(Infinity); });
  stepPlay.addEventListener("click", togglePlay);
  stepRange.addEventListener("input", () => { stopPlay(); goToStep(Number(stepRange.value)); });
  btnIterTable.addEventListener("click", () => {
    const show = iterDrawer.classList.contains("hidden");
    iterDrawer.classList.toggle("hidden", !show);
    if (show) buildIterTable();
  });
  $("btn-close-iter").addEventListener("click", () => iterDrawer.classList.add("hidden"));

  btnRun.addEventListener("click", () => {
    invalidateResult();
    const err = Dijkstra.validate(nodes, edges, originId, directed);
    if (err) {
      setStatus(statusCard(err, "error"));
      if (!originId) originSelect.focus();
      return;
    }
    result = Dijkstra.run(nodes, edges, originId, directed);
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    stepIndex = chkSteps.checked ? 0 : result.steps.length - 1;
    refreshAll();
  });

  btnResetResult.addEventListener("click", () => {
    invalidateResult();
    refreshAll();
  });

  originSelect.addEventListener("change", () => {
    originSelect.blur();
    setOrigin(originSelect.value || null);
  });

  // ============================================================
  //  PANEL DE SELECCIÓN
  // ============================================================
  function applyWeightFromPanel() {
    if (selected.type !== "edge") return;
    const res = parseWeight(edgeWeightInput.value);
    if (res.error) {
      edgeWeightError.textContent = res.error;
      return;
    }
    edgeWeightInput.blur();
    setEdgeWeight(selected.id, res.value);
    toast("Peso actualizado.", "success");
  }
  btnUpdateWeight.addEventListener("click", applyWeightFromPanel);
  edgeWeightInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyWeightFromPanel();
  });
  btnDeleteEdge.addEventListener("click", () => selected.type === "edge" && deleteEdge(selected.id));
  btnReverseEdge.addEventListener("click", () => selected.type === "edge" && reverseEdge(selected.id));
  btnDeleteNode.addEventListener("click", () => selected.type === "node" && deleteNode(selected.id));
  btnRenameNode.addEventListener("click", () => selected.type === "node" && askRename(selected.id));
  btnSetOrigin.addEventListener("click", () => selected.type === "node" && setOrigin(selected.id));

  // ============================================================
  //  MODOS Y TIPO DE RED
  // ============================================================
  function setMode(m) {
    mode = m;
    pendingEdgeStart = null;
    selected = { type: null, id: null };
    refreshAll();
  }
  btnModeSelect.addEventListener("click", () => setMode("select"));
  btnModeAddNode.addEventListener("click", () => setMode("add-node"));
  btnModeAddEdge.addEventListener("click", () => setMode("add-edge"));
  btnTypeUndirected.addEventListener("click", () => setDirected(false));
  btnTypeDirected.addEventListener("click", () => setDirected(true));

  // ============================================================
  //  INTERACCIÓN CON EL LIENZO (mouse y táctil)
  // ============================================================
  let downInfo = null;

  svg.addEventListener("pointerdown", (e) => {
    const pt = toSvgPoint(e);
    const nodeGroup = e.target.closest(".node-group");
    const edgeGroup = !nodeGroup && e.target.closest(".edge-group");
    downInfo = {
      type: nodeGroup ? "node" : edgeGroup ? "edge" : "background",
      id: nodeGroup ? nodeGroup.dataset.nodeId : edgeGroup ? edgeGroup.dataset.edgeId : null,
      startX: pt.x,
      startY: pt.y,
      moved: false,
    };
  });

  svg.addEventListener("pointermove", (e) => {
    if (!downInfo) return;
    const pt = toSvgPoint(e);
    if (Math.hypot(pt.x - downInfo.startX, pt.y - downInfo.startY) > 4) downInfo.moved = true;
    // Mover un nodo no cambia la red, así que no invalida el resultado.
    if (downInfo.type === "node" && mode === "select" && downInfo.moved) {
      const n = findNode(downInfo.id);
      if (n) {
        n.x = clamp(pt.x, 30, VIEW_W - 30);
        n.y = clamp(pt.y, 30, VIEW_H - 30);
        render();
      }
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (!downInfo) return;
    const info = downInfo;
    downInfo = null;
    if (info.moved && !(info.type === "node" && mode !== "select")) return;
    if (info.type === "node") handleNodeClick(info.id);
    else if (info.type === "edge") handleEdgeClick(info.id);
    else if (e.target.closest && e.target.closest("#canvas")) handleBackgroundClick(toSvgPoint(e));
  });

  function handleNodeClick(id) {
    if (mode === "add-node") {
      toast("Ya hay un nodo en esa posición. Haz clic en un espacio vacío.", "");
      return;
    }
    if (mode === "add-edge") {
      if (pendingEdgeStart === null) {
        pendingEdgeStart = id;
      } else if (pendingEdgeStart === id) {
        pendingEdgeStart = null;
        toast("No se permiten arcos de un nodo hacia sí mismo. Selección cancelada.", "error");
      } else {
        const a = pendingEdgeStart,
          b = id;
        pendingEdgeStart = null;
        if (edgeExists(a, b)) {
          toast("Ya existe un arco " + labelOf(a) + " " + arrowSym() + " " + labelOf(b) + ". Selecciónalo para modificar su peso.", "error");
        } else {
          askWeight("Peso del arco " + labelOf(a) + " " + arrowSym() + " " + labelOf(b), "", (w) => addEdge(a, b, w));
        }
      }
      updateModeUI();
      render();
      return;
    }
    // Modo seleccionar: con resultado final, además se resalta el recorrido.
    selected = { type: "node", id };
    if (result && isFinalStep()) focusTarget = id;
    refreshAll();
  }

  function handleEdgeClick(id) {
    if (mode !== "select") return;
    selected = { type: "edge", id };
    refreshAll();
  }

  function handleBackgroundClick(pt) {
    if (mode === "add-node") {
      addNode(pt.x, pt.y);
    } else if (mode === "add-edge") {
      if (pendingEdgeStart !== null) {
        pendingEdgeStart = null;
        updateModeUI();
        render();
      }
    } else {
      selected = { type: null, id: null };
      focusTarget = null;
      refreshAll();
    }
  }

  // Doble clic: nodo → renombrar · arco → editar peso
  svg.addEventListener("dblclick", (e) => {
    if (mode !== "select") return;
    const ng = e.target.closest(".node-group");
    const eg = !ng && e.target.closest(".edge-group");
    if (ng) askRename(ng.dataset.nodeId);
    else if (eg) {
      const ed = findEdge(eg.dataset.edgeId);
      if (ed)
        askWeight("Peso del arco " + labelOf(ed.a) + " " + arrowSym() + " " + labelOf(ed.b), ed.weight, (w) =>
          setEdgeWeight(ed.id, w),
        );
    }
  });

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (!modalOverlay.classList.contains("hidden") || !confirmOverlay.classList.contains("hidden")) return;

    if (result) {
      if (e.key === "ArrowRight") { stopPlay(); goToStep(stepIndex + 1); e.preventDefault(); return; }
      if (e.key === "ArrowLeft") { stopPlay(); goToStep(stepIndex - 1); e.preventDefault(); return; }
      if (e.key === "Home") { stopPlay(); goToStep(0); e.preventDefault(); return; }
      if (e.key === "End") { stopPlay(); goToStep(Infinity); e.preventDefault(); return; }
      if (e.key === " ") { togglePlay(); e.preventDefault(); return; }
    }
    if (e.key === "1") setMode("select");
    else if (e.key === "2") setMode("add-node");
    else if (e.key === "3") setMode("add-edge");
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (selected.type === "node") { e.preventDefault(); deleteNode(selected.id); }
      else if (selected.type === "edge") { e.preventDefault(); deleteEdge(selected.id); }
    } else if (e.key === "Escape") {
      pendingEdgeStart = null;
      selected = { type: null, id: null };
      focusTarget = null;
      iterDrawer.classList.add("hidden");
      refreshAll();
    }
  });

  // ============================================================
  //  GUARDAR / CARGAR / EXPORTAR
  // ============================================================
  function loadNetwork(data) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges))
      throw new Error('El archivo no tiene el formato esperado (se requieren "nodes" y "edges").');
    const okNodes = data.nodes.every(
      (n) => n && typeof n.id === "string" && typeof n.x === "number" && typeof n.y === "number" && typeof n.label === "string",
    );
    if (!okNodes) throw new Error("Los nodos del archivo tienen datos inválidos o incompletos.");
    const ids = new Set(data.nodes.map((n) => n.id));
    if (ids.size !== data.nodes.length) throw new Error("El archivo contiene nodos con identificador repetido.");
    for (const e of data.edges) {
      if (!e || typeof e.id !== "string" || !ids.has(e.a) || !ids.has(e.b))
        throw new Error("Hay arcos que referencian nodos inexistentes.");
      if (e.a === e.b) throw new Error("Hay arcos de un nodo hacia sí mismo (no permitidos).");
      if (typeof e.weight !== "number" || !isFinite(e.weight))
        throw new Error("Hay arcos con un peso no numérico.");
      if (e.weight < 0)
        throw new Error("Hay arcos con peso negativo (" + e.weight + "); Dijkstra solo admite pesos ≥ 0.");
    }
    nodes = data.nodes.map((n) => ({
      id: n.id,
      x: clamp(n.x, 30, VIEW_W - 30),
      y: clamp(n.y, 30, VIEW_H - 30),
      label: n.label.slice(0, 6),
    }));
    edges = data.edges.map((e) => ({ id: e.id, a: e.a, b: e.b, weight: e.weight }));
    directed = !!data.directed;
    originId = data.origin && ids.has(data.origin) ? data.origin : null;
    let maxSuffix = -1;
    [...nodes, ...edges].forEach((o) => {
      const m = /(\d+)$/.exec(o.id);
      if (m) maxSuffix = Math.max(maxSuffix, parseInt(m[1], 10));
    });
    idCounter = maxSuffix + 1;
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    invalidateResult();
    refreshAll();
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  $("btn-export").addEventListener("click", () => {
    if (!nodes.length) return toast("No hay nada que exportar: la red está vacía.", "error");
    const data = { directed, origin: originId, nodes, edges };
    download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "red-dijkstra-" + stamp() + ".json");
  });

  const fileImport = $("file-import");
  $("btn-import").addEventListener("click", () => fileImport.click());
  fileImport.addEventListener("change", () => {
    const file = fileImport.files && fileImport.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      fileImport.value = "";
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        return toast("El archivo no es un JSON válido.", "error");
      }
      const proceed = () => {
        try {
          loadNetwork(data);
          toast("Red cargada correctamente desde el archivo.", "success");
        } catch (err) {
          toast(err.message, "error");
        }
      };
      if (nodes.length) showConfirm("Cargar este archivo reemplazará la red actual. ¿Deseas continuar?", proceed, "Cargar red");
      else proceed();
    };
    reader.readAsText(file);
  });

  // Exporta el lienzo a PNG copiando los estilos calculados a cada
  // elemento (funciona también al abrir el archivo localmente).
  $("btn-export-image").addEventListener("click", () => {
    if (!nodes.length) return toast("No hay nada que exportar: la red está vacía.", "error");
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", VIEW_W);
    clone.setAttribute("height", VIEW_H);
    const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-family", "font-size",
      "font-weight", "text-anchor", "dominant-baseline", "letter-spacing", "stroke-linecap"];
    const src = svg.querySelectorAll("#edges-layer *, #nodes-layer *");
    const dst = clone.querySelectorAll("#edges-layer *, #nodes-layer *");
    src.forEach((node, i) => {
      const cs = getComputedStyle(node);
      dst[i].setAttribute("style", props.map((p) => p + ":" + cs.getPropertyValue(p)).join(";"));
    });
    clone.querySelectorAll(".edge-hit, .node-hit").forEach((n) => n.remove());
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("width", VIEW_W);
    bg.setAttribute("height", VIEW_H);
    bg.setAttribute("fill", "#12131F");
    clone.insertBefore(bg, clone.firstChild);

    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }),
    );
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = VIEW_W * 2;
      c.height = VIEW_H * 2;
      const ctx = c.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      c.toBlob((b) => (b ? download(b, "red-dijkstra-" + stamp() + ".png") : toast("No se pudo generar la imagen.", "error")));
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      toast("No se pudo generar la imagen.", "error");
    };
    img.src = svgUrl;
  });

  $("btn-clear").addEventListener("click", () => {
    if (!nodes.length) return;
    showConfirm("Se eliminarán todos los nodos y arcos de la red actual. Esta acción no se puede deshacer.", clearAll, "Limpiar red completa");
  });

  // ---------- Redes de ejemplo ----------
  // Red no dirigida clásica (Hillier & Lieberman, parque Seervada): O → T = 13
  const EXAMPLE_UNDIRECTED = {
    directed: false,
    origin: "n0",
    nodes: [
      { id: "n0", x: 110, y: 330, label: "O" },
      { id: "n1", x: 300, y: 160, label: "A" },
      { id: "n2", x: 340, y: 340, label: "B" },
      { id: "n3", x: 290, y: 520, label: "C" },
      { id: "n4", x: 600, y: 190, label: "D" },
      { id: "n5", x: 580, y: 460, label: "E" },
      { id: "n6", x: 860, y: 330, label: "T" },
    ],
    edges: [
      { id: "e7", a: "n0", b: "n1", weight: 2 },
      { id: "e8", a: "n0", b: "n2", weight: 5 },
      { id: "e9", a: "n0", b: "n3", weight: 4 },
      { id: "e10", a: "n1", b: "n2", weight: 2 },
      { id: "e11", a: "n1", b: "n4", weight: 7 },
      { id: "e12", a: "n2", b: "n3", weight: 1 },
      { id: "e13", a: "n2", b: "n4", weight: 4 },
      { id: "e14", a: "n2", b: "n5", weight: 3 },
      { id: "e15", a: "n3", b: "n5", weight: 4 },
      { id: "e16", a: "n4", b: "n5", weight: 1 },
      { id: "e17", a: "n4", b: "n6", weight: 5 },
      { id: "e18", a: "n5", b: "n6", weight: 7 },
    ],
  };
  // Red dirigida con arcos en ambos sentidos y un nodo inalcanzable (G)
  const EXAMPLE_DIRECTED = {
    directed: true,
    origin: "n0",
    nodes: [
      { id: "n0", x: 120, y: 320, label: "A" },
      { id: "n1", x: 340, y: 150, label: "B" },
      { id: "n2", x: 340, y: 480, label: "C" },
      { id: "n3", x: 590, y: 170, label: "D" },
      { id: "n4", x: 600, y: 470, label: "E" },
      { id: "n5", x: 840, y: 320, label: "F" },
      { id: "n6", x: 860, y: 560, label: "G" },
    ],
    edges: [
      { id: "e7", a: "n0", b: "n1", weight: 4 },
      { id: "e8", a: "n0", b: "n2", weight: 2 },
      { id: "e9", a: "n2", b: "n1", weight: 1 },
      { id: "e10", a: "n1", b: "n2", weight: 3 },
      { id: "e11", a: "n1", b: "n3", weight: 5 },
      { id: "e12", a: "n2", b: "n3", weight: 8 },
      { id: "e13", a: "n2", b: "n4", weight: 10 },
      { id: "e14", a: "n3", b: "n4", weight: 2 },
      { id: "e15", a: "n3", b: "n5", weight: 6 },
      { id: "e16", a: "n4", b: "n5", weight: 2 },
      { id: "e17", a: "n6", b: "n5", weight: 3 },
    ],
  };
  function loadExample(ex, msg) {
    const proceed = () => {
      loadNetwork(JSON.parse(JSON.stringify(ex)));
      toast(msg, "success");
    };
    if (nodes.length) showConfirm("Esto reemplazará la red actual por una red de ejemplo. ¿Deseas continuar?", proceed, "Cargar red de ejemplo");
    else proceed();
  }
  $("btn-example").addEventListener("click", () =>
    loadExample(EXAMPLE_UNDIRECTED, "Red de ejemplo no dirigida cargada (origen O). Pulsa «Ejecutar Dijkstra»."),
  );
  $("btn-example-directed").addEventListener("click", () =>
    loadExample(EXAMPLE_DIRECTED, "Red de ejemplo dirigida cargada (origen A; G es inalcanzable)."),
  );

  // ============================================================
  //  INICIO
  // ============================================================
  refreshAll();
})();
