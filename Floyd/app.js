(function () {
  "use strict";

  /* ==================================================================
   *  ALGORITMO DE FLOYD-WARSHALL — Caminos mínimos entre todos los pares
   *  ------------------------------------------------------------------
   *  Estructuras de datos: la red dirigida se representa con dos
   *  matrices n×n (cada nodo se identifica por su posición i = 0..n-1):
   *    - D[i][j]  distancia del mejor camino conocido de i a j.
   *               D[i][i] = 0 y D[i][j] = ∞ si no se conoce camino.
   *    - S[i][j]  matriz de recorridos: nodo intermedio por el que pasa
   *               el camino de i a j. Al inicio S[i][j] = j (arco directo).
   *
   *  Procedimiento:
   *  1. D₀ = pesos de los arcos dirigidos (A → B solo llena la celda
   *     (A,B), nunca la (B,A)); S₀[i][j] = j.
   *  2. Para cada nodo intermedio k = 1..n se evalúa cada celda (i, j)
   *     con i ≠ k, j ≠ k, i ≠ j  (OPERACIÓN TRIPLE):
   *        si d(i,k) + d(k,j) < d(i,j)  ⇒  d(i,j) = d(i,k) + d(k,j)
   *                                         s(i,j) = k
   *     La fila k y la columna k no cambian, porque d(k,k) = 0.
   *  3. Al terminar la iteración n, Dₙ tiene la distancia mínima de cada
   *     par y Sₙ permite reconstruir el camino:
   *        s(i,j) = j  → se va directo por el arco i → j
   *        s(i,j) = k  → camino(i,j) = camino(i,k) + camino(k,j)
   *  Complejidad: O(n³) por los tres ciclos anidados k, i, j.
   * ================================================================== */
  const Floyd = (function () {
    // Construye las matrices iniciales D₀ y S₀ a partir de los arcos.
    function initialMatrices(nodes, edges) {
      const n = nodes.length;
      const index = {};
      nodes.forEach((nd, i) => (index[nd.id] = i));
      const D = [],
        S = [];
      for (let i = 0; i < n; i++) {
        D.push([]);
        S.push([]);
        for (let j = 0; j < n; j++) {
          D[i][j] = i === j ? 0 : Infinity; // diagonal en cero, sin arco = ∞
          S[i][j] = i === j ? null : j; // al inicio se va directo a j
        }
      }
      edges.forEach((e) => {
        const i = index[e.a],
          j = index[e.b];
        if (i == null || j == null) return;
        if (e.weight < D[i][j]) D[i][j] = e.weight; // solo la celda (origen, destino)
      });
      return { D, S };
    }

    // Verifica que los datos permitan ejecutar el algoritmo. Devuelve un
    // mensaje de error o null si todo está bien.
    function validate(nodes, edges) {
      if (nodes.length === 0) return "La red está vacía: ingresa nodos y arcos.";
      if (nodes.length < 2) return "Ingresa al menos dos nodos para calcular caminos mínimos.";
      if (edges.length === 0) return "La red no tiene arcos: registra al menos un arco entre dos nodos.";
      const ids = new Set(nodes.map((n) => n.id));
      const seen = new Set();
      for (const e of edges) {
        if (!ids.has(e.a) || !ids.has(e.b)) return "Existe un arco que referencia un nodo inexistente.";
        if (e.a === e.b) return "Existe un arco de un nodo hacia sí mismo.";
        if (seen.has(e.a + ">" + e.b)) return "Existen dos arcos con el mismo origen y destino.";
        seen.add(e.a + ">" + e.b);
        if (typeof e.weight !== "number" || !isFinite(e.weight)) return "Existe un arco con un peso no numérico.";
        if (e.weight <= 0) return "Existe un arco con peso " + e.weight + ": solo se admiten pesos positivos.";
      }
      return null;
    }

    const copy = (M) => M.map((row) => row.slice());

    // Ejecuta el algoritmo y guarda una "fotografía" de D y S después de
    // cada iteración, junto con las celdas que se actualizaron.
    function run(nodes, edges) {
      const n = nodes.length;
      const { D, S } = initialMatrices(nodes, edges);
      const steps = [{ kind: "init", k: null, D: copy(D), S: copy(S), changes: [] }];

      for (let k = 0; k < n; k++) {
        const changes = [];
        for (let i = 0; i < n; i++) {
          if (i === k || D[i][k] === Infinity) continue; // no hay camino i → k
          for (let j = 0; j < n; j++) {
            if (j === k || j === i || D[k][j] === Infinity) continue; // no hay camino k → j
            const throughK = D[i][k] + D[k][j]; // operación triple
            if (throughK < D[i][j]) {
              changes.push({ i, j, before: D[i][j], after: throughK, dik: D[i][k], dkj: D[k][j] });
              D[i][j] = throughK;
              S[i][j] = k;
            }
          }
        }
        steps.push({ kind: "iter", k, D: copy(D), S: copy(S), changes });
      }

      steps.push({ kind: "done", k: null, D: copy(D), S: copy(S), changes: [] });
      return { ids: nodes.map((nd) => nd.id), steps };
    }

    // Reconstruye el camino i → j con la matriz S. Devuelve los índices
    // de los nodos y la "traza" de consultas a S, o null si d(i,j) = ∞.
    function path(D, S, i, j) {
      if (i === j) return { nodes: [i], trace: [] };
      if (D[i][j] === Infinity) return null;
      const trace = [];
      function expand(a, b) {
        const k = S[a][b];
        if (k === b) return [b]; // tramo directo a → b
        trace.push({ a, b, k });
        return expand(a, k).concat(expand(k, b)); // camino(a,k) + camino(k,b)
      }
      return { nodes: [i].concat(expand(i, j)), trace };
    }

    return { initialMatrices, validate, run, path };
  })();

  /* ==================================================================
   *  ANÁLISIS DE CAMINOS ALTERNATIVOS
   *  ------------------------------------------------------------------
   *  Usa la matriz final D y la matriz de pesos directos W (= D₀):
   *    - optimalPaths: todos los caminos de distancia mínima (empates).
   *      Un arco u → v pertenece a un camino mínimo de i a j si
   *        d(i,u) + w(u,v) + d(v,j) = d(i,j)  y  d(i,u) + w(u,v) = d(i,v)
   *    - simplePaths: caminos sin repetir nodos de i a j, ordenados por
   *      distancia, para comparar el mínimo con las demás opciones.
   * ================================================================== */
  const Routes = (function () {
    const EPS = 1e-9;
    const eq = (a, b) => Math.abs(a - b) < EPS;

    function optimalPaths(D, W, i, j, limit) {
      if (i === j || D[i][j] === Infinity) return [];
      const n = D.length;
      const out = [];
      (function dfs(u, acc) {
        if (out.length >= limit) return;
        if (u === j) return out.push(acc.slice());
        for (let v = 0; v < n; v++) {
          if (v === u || W[u][v] === Infinity) continue;
          if (eq(D[i][u] + W[u][v], D[i][v]) && eq(D[i][v] + D[v][j], D[i][j])) {
            acc.push(v);
            dfs(v, acc);
            acc.pop();
          }
        }
      })(i, [i]);
      return out;
    }

    function simplePaths(W, i, j, limit) {
      const n = W.length;
      const out = [];
      const visited = new Array(n).fill(false);
      let explored = 0;
      (function dfs(u, acc, cost) {
        if (out.length >= limit || ++explored > 20000) return;
        if (u === j) return out.push({ nodes: acc.slice(), cost });
        visited[u] = true;
        for (let v = 0; v < n; v++) {
          if (visited[v] || W[u][v] === Infinity) continue;
          acc.push(v);
          dfs(v, acc, cost + W[u][v]);
          acc.pop();
        }
        visited[u] = false;
      })(i, [i], 0);
      return out.sort((a, b) => a.cost - b.cost);
    }

    return { optimalPaths, simplePaths };
  })();

  // Disponibles para la página de pruebas (pruebas.html)
  window.Floyd = Floyd;
  window.Routes = Routes;
  if (!document.getElementById("canvas")) return;

  // ============================================================
  //  CONSTANTES Y ESTADO DE LA APLICACIÓN
  // ============================================================
  const SVG_NS = "http://www.w3.org/2000/svg";
  const NODE_R = 19;
  const VIEW_W = 1000;
  const VIEW_H = 560;

  let nodes = []; // {id, x, y, label}
  let edges = []; // {id, a, b, weight}  arco dirigido a → b
  let idCounter = 0;

  let mode = "select"; // 'select' | 'add-node' | 'add-edge'
  let pendingEdgeStart = null;
  let selected = { type: null, id: null };

  let result = null; // salida de Floyd.run
  let stepIndex = 0;
  let playTimer = null;
  let qOrigin = null; // consulta: nodo origen
  let qDest = null; // consulta: nodo destino (null = todos)
  let matrixView = "current"; // 'current' | 'all' | 'pairs'

  // ============================================================
  //  REFERENCIAS AL DOM
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const svg = $("canvas");
  const edgesLayer = $("edges-layer");
  const nodesLayer = $("nodes-layer");
  const mainEl = $("main");
  const canvasBanner = $("canvas-banner");

  const btnModeSelect = $("mode-select");
  const btnModeAddNode = $("mode-add-node");
  const btnModeAddEdge = $("mode-add-edge");

  const nodeNameInput = $("node-name-input");
  const arcFrom = $("arc-from");
  const arcTo = $("arc-to");
  const arcWeight = $("arc-weight");

  const panelNone = $("panel-none");
  const panelNode = $("panel-node");
  const panelEdge = $("panel-edge");
  const edgeWeightInput = $("edge-weight-input");
  const edgeWeightError = $("edge-weight-error");
  const btnRoutesFrom = $("btn-routes-from");

  const chkSteps = $("chk-steps");
  const statusArea = $("status-area");
  const stepPlay = $("step-play");
  const stepRange = $("step-range");
  const queryOrigin = $("query-origin");
  const queryDest = $("query-dest");
  const queryResult = $("query-result");

  const matrixPanel = $("matrix-panel");
  const matrixBody = $("matrix-body");
  const matrixTitle = $("matrix-title");

  const modalOverlay = $("modal-overlay");
  const modalInput = $("modal-input");
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
  function nextFreeLabel() {
    const used = new Set(nodes.map((n) => n.label));
    for (let i = 0; ; i++) if (!used.has(letterLabel(i))) return letterLabel(i);
  }

  const findNode = (id) => nodes.find((n) => n.id === id);
  const findEdge = (id) => edges.find((e) => e.id === id);
  const labelOf = (id) => (findNode(id) ? findNode(id).label : "?");
  const L = (id) => esc(labelOf(id));
  const arcBetween = (a, b) => edges.find((e) => e.a === a && e.b === b);
  const hasReverse = (e) => edges.some((o) => o.a === e.b && o.b === e.a);

  function fmt(w) {
    if (w === Infinity) return "∞";
    if (Number.isInteger(w)) return String(w);
    return String(Math.round(w * 100) / 100);
  }
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3800);
  }
  const statusCard = (msg, kind) => '<div class="status-card ' + (kind || "") + '">' + msg + "</div>";

  // ============================================================
  //  VALIDACIÓN DE DATOS DE ENTRADA
  // ============================================================
  function parseWeight(raw) {
    const s = String(raw).trim().replace(",", ".");
    if (s === "") return { error: "Ingresa el peso del arco." };
    const v = Number(s);
    if (!isFinite(v)) return { error: "El peso debe ser un número válido (ej. 4 o 2.5)." };
    if (v <= 0) return { error: "Solo se admiten pesos positivos (mayores que 0)." };
    return { value: v };
  }

  function validateNodeName(raw, exceptId) {
    const v = raw.trim();
    if (v === "") return { error: "El nombre no puede quedar vacío." };
    if (v.length > 6) return { error: "Usa como máximo 6 caracteres." };
    if (nodes.some((o) => o.id !== exceptId && o.label.toLowerCase() === v.toLowerCase()))
      return { error: "Ya existe un nodo llamado «" + v + "»." };
    return { value: v };
  }

  // Revisa si se puede registrar el arco a → b. Devuelve un mensaje o null.
  function arcError(a, b) {
    if (!a || !b) return "Selecciona el nodo de origen y el de destino.";
    if (!findNode(a) || !findNode(b)) return "No se puede crear el arco: uno de los nodos no existe.";
    if (a === b) return "El origen y el destino deben ser nodos diferentes.";
    if (arcBetween(a, b)) return "Ya existe el arco " + labelOf(a) + " → " + labelOf(b) + ". Selecciónalo en el lienzo para cambiar su peso.";
    return null;
  }

  // ============================================================
  //  MUTACIONES DE LA RED
  //  Cualquier cambio invalida el resultado: hay que volver a ejecutar.
  // ============================================================
  function networkChanged() {
    const hadResult = !!result;
    invalidateResult();
    refreshAll();
    if (hadResult) setStatus(statusCard("La red cambió. Vuelve a ejecutar Floyd-Warshall para actualizar los resultados.", "warn"));
  }

  // Busca una posición libre para un nodo ingresado por formulario: primero
  // los puestos de una elipse exterior (8) y luego los de una interior (6),
  // para que los nodos no queden alineados y los arcos no se superpongan.
  function freePosition() {
    const candidates = [];
    for (let t = 0; t < 8; t++) {
      const ang = Math.PI + (t * 2 * Math.PI) / 8;
      candidates.push({ x: 500 + 390 * Math.cos(ang), y: 280 + 210 * Math.sin(ang) });
    }
    for (let t = 0; t < 6; t++) {
      const ang = Math.PI / 6 + (t * 2 * Math.PI) / 6;
      candidates.push({ x: 500 + 190 * Math.cos(ang), y: 280 + 95 * Math.sin(ang) });
    }
    const free = candidates.find((c) => nodes.every((n) => Math.hypot(n.x - c.x, n.y - c.y) > 90));
    if (free) return free;
    const t = nodes.length;
    return { x: clamp(500 + Math.cos(t) * 300, 40, VIEW_W - 40), y: clamp(280 + Math.sin(t * 1.7) * 200, 40, VIEW_H - 40) };
  }

  function addNode(x, y, label) {
    nodes.push({ id: "n" + idCounter++, x: clamp(x, 30, VIEW_W - 30), y: clamp(y, 30, VIEW_H - 30), label: label || nextFreeLabel() });
    networkChanged();
  }

  function addEdge(a, b, weight) {
    const err = arcError(a, b);
    if (err) return toast(err, "error");
    edges.push({ id: "e" + idCounter++, a, b, weight });
    networkChanged();
  }

  function deleteNode(id) {
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => e.a !== id && e.b !== id);
    selected = { type: null, id: null };
    networkChanged();
  }

  function deleteEdge(id) {
    edges = edges.filter((e) => e.id !== id);
    selected = { type: null, id: null };
    networkChanged();
  }

  function setEdgeWeight(id, w) {
    const e = findEdge(id);
    if (!e) return;
    e.weight = w;
    networkChanged();
  }

  function reverseEdge(id) {
    const e = findEdge(id);
    if (!e) return;
    if (arcBetween(e.b, e.a)) return toast("Ya existe el arco " + labelOf(e.b) + " → " + labelOf(e.a) + ".", "error");
    [e.a, e.b] = [e.b, e.a];
    networkChanged();
  }

  function clearAll() {
    nodes = [];
    edges = [];
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    networkChanged();
    setStatus("");
  }

  // ============================================================
  //  FORMULARIOS DE INGRESO DE DATOS
  // ============================================================
  function submitNodeForm() {
    const raw = nodeNameInput.value.trim() || nextFreeLabel();
    const res = validateNodeName(raw);
    $("node-form-error").textContent = res.error || "";
    if (res.error) return;
    const p = freePosition();
    addNode(p.x, p.y, res.value);
    nodeNameInput.value = "";
    nodeNameInput.focus();
  }
  $("btn-add-node-form").addEventListener("click", submitNodeForm);
  nodeNameInput.addEventListener("keydown", (e) => e.key === "Enter" && submitNodeForm());

  function submitArcForm() {
    const errBox = $("arc-form-error");
    const err = arcError(arcFrom.value, arcTo.value);
    if (err) return (errBox.textContent = err);
    const res = parseWeight(arcWeight.value);
    if (res.error) return (errBox.textContent = res.error);
    errBox.textContent = "";
    addEdge(arcFrom.value, arcTo.value, res.value);
    arcWeight.value = "";
    toast("Arco " + labelOf(arcFrom.value) + " → " + labelOf(arcTo.value) + " registrado (peso " + fmt(res.value) + ").", "success");
  }
  $("btn-add-arc").addEventListener("click", submitArcForm);
  arcWeight.addEventListener("keydown", (e) => e.key === "Enter" && submitArcForm());

  function fillNodeSelect(select, placeholder, keep) {
    const prev = keep ? select.value : "";
    select.innerHTML = "";
    select.appendChild(new Option(placeholder, ""));
    nodes.forEach((n) => select.appendChild(new Option(n.label, n.id)));
    select.value = findNode(prev) ? prev : "";
  }

  // ============================================================
  //  MODAL DE ENTRADA Y MODAL DE CONFIRMACIÓN
  // ============================================================
  let modalOpts = null;
  function openInputModal(opts) {
    modalOpts = opts;
    $("modal-title").textContent = opts.title;
    $("modal-label").textContent = opts.label;
    modalInput.type = opts.inputType || "number";
    modalInput.value = opts.initial != null ? opts.initial : "";
    $("modal-error").textContent = "";
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
      $("modal-error").textContent = res.error;
      return modalInput.focus();
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
    openInputModal({ title, label: "Peso (número positivo)", inputType: "number", initial, validate: parseWeight, onConfirm });
  }

  function askRename(id) {
    const n = findNode(id);
    if (!n) return;
    openInputModal({
      title: "Renombrar nodo " + n.label,
      label: "Nombre del nodo (máx. 6 caracteres)",
      inputType: "text",
      initial: n.label,
      validate: (raw) => validateNodeName(raw, id),
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
  //  RESULTADO Y CONSULTAS
  // ============================================================
  const currentSnapshot = () => (result ? result.steps[stepIndex] : null);
  const finalSnapshot = () => result.steps[result.steps.length - 1];
  const isFinalStep = () => !!result && stepIndex === result.steps.length - 1;
  const ix = (id) => (result ? result.ids.indexOf(id) : -1); // fila/columna del nodo
  const idAt = (i) => result.ids[i];
  const LI = (i) => L(idAt(i));

  function setStatus(html) {
    statusArea.innerHTML = html || "";
  }

  function invalidateResult() {
    stopPlay();
    result = null;
    stepIndex = 0;
    qOrigin = null;
    qDest = null;
    setStatus("");
  }

  // Matriz de pesos directos W (= D₀), usada para analizar alternativas.
  const weightMatrix = () => result.steps[0].D;

  // Camino entre dos nodos según las matrices de un paso.
  function routeBetween(fromId, toId, snap) {
    snap = snap || currentSnapshot();
    const p = Floyd.path(snap.D, snap.S, ix(fromId), ix(toId));
    if (!p) return null;
    const ids = p.nodes.map(idAt);
    const arcs = [];
    for (let t = 0; t + 1 < ids.length; t++) arcs.push(arcBetween(ids[t], ids[t + 1]));
    return { nodes: ids, arcs, trace: p.trace, dist: snap.D[ix(fromId)][ix(toId)] };
  }

  // Todos los caminos mínimos (empates) entre dos nodos, con el resultado final.
  function optimalRoutes(fromId, toId) {
    return Routes.optimalPaths(finalSnapshot().D, weightMatrix(), ix(fromId), ix(toId), 8).map((p) => p.map(idAt));
  }

  function setQuery(o, d) {
    qOrigin = o;
    qDest = o && d && d !== o ? d : null;
    selected = { type: null, id: null };
    refreshAll();
  }

  // Comprueba que el gráfico, la matriz inicial y el resultado final sean
  // coherentes entre sí. Devuelve una lista de verificaciones.
  function consistencyChecks() {
    const D0 = result.steps[0].D;
    const F = finalSnapshot();
    const n = result.ids.length;
    const checks = [];

    const arcsOk = edges.every((e) => D0[ix(e.a)][ix(e.b)] === e.weight);
    let finite = 0;
    D0.forEach((row, i) => row.forEach((v, j) => i !== j && v !== Infinity && finite++));
    checks.push({ ok: arcsOk && finite === edges.length, text: "D₀ tiene exactamente los " + edges.length + " arcos dibujados, cada uno en su celda (origen, destino)" });
    checks.push({ ok: F.D.every((row, i) => row[i] === 0), text: "La diagonal de la matriz final es 0" });

    let pathsOk = true,
      reach = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j || F.D[i][j] === Infinity) continue;
        reach++;
        const r = routeBetween(idAt(i), idAt(j), F);
        const sum = r && r.arcs.every(Boolean) ? r.arcs.reduce((s, a) => s + a.weight, 0) : NaN;
        if (!(Math.abs(sum - F.D[i][j]) < 1e-9)) pathsOk = false;
      }
    checks.push({ ok: pathsOk, text: "Cada camino reconstruido usa arcos existentes y su suma de pesos es igual a d(i,j)" });
    checks.push({ ok: reach === countReachablePairs(), text: "Los pares con distancia finita coinciden con los pares conectados en el gráfico (" + reach + ")" });
    return checks;
  }

  // ============================================================
  //  GEOMETRÍA DE LOS ARCOS
  // ============================================================
  // Curva P0 → C → P2 recortada en el borde de los nodos. Si existe el
  // arco en sentido contrario, ambas se arquean para verse por separado.
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
    const P0 = trim(na, C, NODE_R + 2);
    const P2 = trim(nb, C, NODE_R + 2);
    const mx = 0.25 * na.x + 0.5 * C.x + 0.25 * nb.x;
    const my = 0.25 * na.y + 0.5 * C.y + 0.25 * nb.y;
    const off = bend ? 14 : 15;
    return { P0, P2, C, chip: { x: mx + nx * off, y: my + ny * off } };
  }

  function arrowPoints(tip) {
    const bx = tip.x - tip.ux * 13,
      by = tip.y - tip.uy * 13;
    const px = -tip.uy * 6.5,
      py = tip.ux * 6.5;
    return [tip.x, tip.y, bx + px, by + py, bx - px, by - py].map((v) => v.toFixed(1)).join(",");
  }

  // ============================================================
  //  RENDER DEL LIENZO
  // ============================================================
  // Qué resaltar según la consulta: camino a un destino (y sus empates) o
  // caminos desde el origen hacia todos los nodos.
  function queryView() {
    if (!result || !qOrigin) return null;
    const snap = currentSnapshot();
    const view = { edges: new Set(), alt: new Set(), nodes: new Set([qOrigin]), focus: !!qDest, dist: {} };
    nodes.forEach((n) => (view.dist[n.id] = snap.D[ix(qOrigin)][ix(n.id)]));
    const targets = qDest ? [qDest] : nodes.map((n) => n.id).filter((id) => id !== qOrigin);
    targets.forEach((t) => {
      const r = routeBetween(qOrigin, t);
      if (!r) return;
      r.nodes.forEach((id) => view.nodes.add(id));
      r.arcs.forEach((a) => a && view.edges.add(a.id));
    });
    if (qDest && isFinalStep()) {
      optimalRoutes(qOrigin, qDest).forEach((p) => {
        for (let t = 0; t + 1 < p.length; t++) {
          const a = arcBetween(p[t], p[t + 1]);
          if (a && !view.edges.has(a.id)) view.alt.add(a.id);
          view.nodes.add(p[t + 1]);
        }
      });
    }
    return view;
  }

  function render() {
    $("empty-hint").classList.toggle("hidden", nodes.length > 0);
    const snap = currentSnapshot();
    const qv = queryView();
    const pivotId = snap && snap.kind === "iter" ? idAt(snap.k) : null;

    // ---------- Arcos dirigidos ----------
    edgesLayer.innerHTML = "";
    edges.forEach((e) => {
      if (!findNode(e.a) || !findNode(e.b)) return;
      let cls = "edge-group";
      if (selected.type === "edge" && selected.id === e.id) cls += " selected";
      else if (qv && qv.edges.has(e.id)) cls += qv.focus ? " focus" : " tree";
      else if (qv && qv.alt.has(e.id)) cls += " alt";
      else if (qv) cls += " faded";

      const g = el("g", { class: cls, "data-edge-id": e.id }, edgesLayer);
      const geo = edgeGeometry(e);
      const d = "M" + geo.P0.x + "," + geo.P0.y + " Q" + geo.C.x + "," + geo.C.y + " " + geo.P2.x + "," + geo.P2.y;
      el("path", { class: "edge-hit", d }, g);
      el("path", { class: "edge-visible", d }, g);
      el("polygon", { class: "edge-arrow", points: arrowPoints(geo.P2) }, g); // flecha en el destino

      const text = fmt(e.weight);
      const w = Math.max(22, text.length * 7.2 + 12);
      const chip = el("g", { class: "weight-chip" }, g);
      el("rect", { x: geo.chip.x - w / 2, y: geo.chip.y - 10, width: w, height: 20, rx: 4 }, chip);
      el("text", { x: geo.chip.x, y: geo.chip.y + 0.5 }, chip).textContent = text;
    });

    // ---------- Nodos ----------
    nodesLayer.innerHTML = "";
    nodes.forEach((n) => {
      let cls = "node-group";
      if (snap && snap.kind === "iter" && ix(n.id) < snap.k) cls += " used";
      if (n.id === pivotId) cls += " pivot";
      if (qv) {
        if (n.id === qOrigin) cls += " q-origin";
        else if (qv.focus && n.id === qDest) cls += " q-dest";
        else if (qv.focus && !qv.nodes.has(n.id)) cls += " dimmed";
        else if (!qv.focus && qv.dist[n.id] === Infinity) cls += " unreachable";
      }
      if (selected.type === "node" && selected.id === n.id && !qv) cls += " selected";
      if (pendingEdgeStart === n.id) cls += " pending";

      const g = el("g", { class: cls, "data-node-id": n.id, transform: "translate(" + n.x + "," + n.y + ")" }, nodesLayer);
      el("circle", { class: "node-hit", r: 25 }, g);
      el("circle", { class: "node-visible", r: NODE_R }, g);
      el("text", { class: "node-label" }, g).textContent = n.label;

      const above = n.y > 70;
      let tag = null;
      if (qv && n.id === qOrigin) tag = ["origin", "ORIGEN"];
      else if (qv && qv.focus && n.id === qDest) tag = ["dest", "DESTINO"];
      else if (n.id === pivotId) tag = ["pivot", "k"];
      if (tag) el("text", { class: "node-tag " + tag[0], y: above ? 31 : -31 }, g).textContent = tag[1];

      // Distancia desde el origen de la consulta
      if (qv && n.id !== qOrigin && (!qv.focus || n.id === qDest)) {
        const dv = qv.dist[n.id];
        const text = "d=" + fmt(dv);
        const w = Math.max(30, text.length * 7 + 12);
        const ly = above ? -35 : 35;
        const lab = el("g", { class: "dist-label" + (dv === Infinity ? " inf" : "") + (qv.focus ? " focus" : "") }, g);
        el("rect", { x: -w / 2, y: ly - 10, width: w, height: 20, rx: 10 }, lab);
        el("text", { y: ly + 0.5 }, lab).textContent = text;
      }
    });

    renderBanner(snap, qv);
  }

  function renderBanner(snap, qv) {
    let html = "",
      route = false;
    if (qv && qv.focus) {
      const r = routeBetween(qOrigin, qDest);
      route = true;
      html = r
        ? "Camino mínimo " + L(qOrigin) + " → " + L(qDest) + ": " +
          '<span class="mono">' + r.nodes.map(L).join(" → ") + "</span> · distancia " + '<span class="mono">' + fmt(r.dist) + "</span>"
        : "No existe camino de " + L(qOrigin) + " a " + L(qDest) + " (d = ∞)";
    } else if (snap && snap.kind === "init") {
      html = "Iteración 0 · matrices iniciales D<sub>0</sub> y S<sub>0</sub>";
    } else if (snap && snap.kind === "iter") {
      html = "Iteración " + (snap.k + 1) + " · nodo intermedio k = <b>" + LI(snap.k) + "</b> · " + snap.changes.length + " celda(s) actualizada(s)";
    }
    canvasBanner.innerHTML = html;
    canvasBanner.classList.toggle("route", route);
    canvasBanner.classList.toggle("hidden", !html);
  }

  // ============================================================
  //  MATRICES D (DISTANCIAS) Y S (RECORRIDOS)
  // ============================================================
  // Genera el HTML de una matriz. opts: {kind:'D'|'S', D, S, labels, k,
  // changes, qi, qj}
  function matrixHtml(o) {
    const n = o.labels.length;
    const changed = new Set((o.changes || []).map((c) => c.i + "," + c.j));
    let html = '<table class="matrix"><thead><tr><th class="corner">' + o.kind + "</th>";
    for (let j = 0; j < n; j++) html += '<th class="' + (j === o.k ? "pivot-line" : "") + '">' + esc(o.labels[j]) + "</th>";
    html += "</tr></thead><tbody>";
    for (let i = 0; i < n; i++) {
      html += '<tr><th class="' + (i === o.k ? "pivot-line" : i === o.qi ? "q-head" : "") + '" data-i="' + i + '" title="Ver caminos desde ' + esc(o.labels[i]) + '">' + esc(o.labels[i]) + "</th>";
      for (let j = 0; j < n; j++) {
        const c = [];
        if (i === j) c.push("diag");
        else if (i === o.qi && j === o.qj) c.push("q-cell");
        else if (changed.has(i + "," + j)) c.push("changed");
        else if (i === o.k || j === o.k) c.push("pivot-line");
        else if (i === o.qi && o.qj < 0) c.push("q-row");
        let v;
        if (o.kind === "D") {
          v = fmt(o.D[i][j]);
          if (o.D[i][j] === Infinity) c.push("inf");
        } else v = i === j ? "—" : esc(o.labels[o.S[i][j]]);
        html += '<td class="' + c.join(" ") + '" data-i="' + i + '" data-j="' + j + '">' + v + "</td>";
      }
      html += "</tr>";
    }
    return html + "</tbody></table>";
  }

  function matrixPairHtml(snap, labels, sub, title) {
    const qi = result && qOrigin ? ix(qOrigin) : -1;
    const qj = qi >= 0 && qDest ? ix(qDest) : -1;
    const base = { D: snap.D, S: snap.S, labels, k: snap.kind === "iter" ? snap.k : -1, changes: snap.changes, qi, qj };
    return (
      (title || "") +
      '<div class="matrix-pair">' +
      '<div class="matrix-box"><div class="matrix-caption">Matriz de distancias D<sub>' + sub + "</sub></div>" +
      '<div class="matrix-scroll">' + matrixHtml(Object.assign({ kind: "D" }, base)) + "</div></div>" +
      '<div class="matrix-box"><div class="matrix-caption">Matriz de recorridos S<sub>' + sub + "</sub></div>" +
      '<div class="matrix-scroll">' + matrixHtml(Object.assign({ kind: "S" }, base)) + "</div></div></div>"
    );
  }

  function stepSub(s) {
    if (s.kind === "init") return "0";
    return String(s.kind === "iter" ? s.k + 1 : result.ids.length);
  }

  function renderMatrices() {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === matrixView));

    // Antes de ejecutar: vista previa en vivo de D₀ y S₀
    if (!result) {
      if (!nodes.length) {
        matrixTitle.innerHTML = "Vista previa · matrices iniciales";
        matrixBody.innerHTML = '<div class="matrix-empty">Ingresa nodos y arcos: aquí se construyen automáticamente la matriz de distancias D<sub>0</sub> y la matriz de recorridos S<sub>0</sub>.</div>';
        return;
      }
      matrixTitle.innerHTML = "Vista previa · D<sub>0</sub> y S<sub>0</sub> se construyen a partir de los arcos ingresados";
      if (matrixView !== "current") {
        matrixBody.innerHTML = '<div class="matrix-empty">Ejecuta Floyd-Warshall para ver esta vista. Por ahora se muestran las matrices iniciales en la pestaña «Iteración actual».</div>';
        return;
      }
      const m = Floyd.initialMatrices(nodes, edges);
      const snap = { kind: "init", D: m.D, S: m.S, changes: [] };
      matrixBody.innerHTML = matrixPairHtml(snap, nodes.map((n) => n.label), "0");
      return;
    }

    const labels = result.ids.map(labelOf);
    const snap = currentSnapshot();

    if (matrixView === "current") {
      const sub = stepSub(snap);
      if (snap.kind === "init") matrixTitle.innerHTML = "Iteración 0 · matrices iniciales";
      else if (snap.kind === "iter") matrixTitle.innerHTML = "Iteración " + sub + " · nodo intermedio k = " + esc(labels[snap.k]);
      else matrixTitle.innerHTML = "Resultado final · matrices de caminos mínimos";
      matrixBody.innerHTML = matrixPairHtml(snap, labels, sub);
    } else if (matrixView === "all") {
      matrixTitle.innerHTML = "Trazabilidad · D y S después de cada iteración";
      const cur = snap.kind === "done" ? result.steps.length - 2 : stepIndex;
      matrixBody.innerHTML = result.steps
        .slice(0, -1) // el paso "done" es igual a la última iteración
        .map((s, idx) => {
          const sub = stepSub(s);
          const title =
            '<div class="iter-title">' +
            (s.kind === "init"
              ? "Iteración 0 · matrices iniciales"
              : "Iteración " + sub + " · k = " + esc(labels[s.k]) + ' <span class="muted">· ' + s.changes.length + " celda(s) actualizada(s)</span>") +
            "</div>";
          return '<div class="iter-block' + (idx === cur ? " current" : "") + '">' + matrixPairHtml(s, labels, sub, title) + "</div>";
        })
        .join("");
    } else {
      matrixTitle.innerHTML = "Caminos mínimos entre todos los pares (resultado final)";
      matrixBody.innerHTML = pairsTableHtml();
    }
  }

  function pairsTableHtml() {
    const F = finalSnapshot();
    let rows = "";
    nodes.forEach((a) =>
      nodes.forEach((b) => {
        if (a.id === b.id) return;
        const r = routeBetween(a.id, b.id, F);
        const alts = r ? optimalRoutes(a.id, b.id).length : 0;
        rows +=
          '<tr class="' + (r ? "" : "none") + '" data-o="' + esc(a.id) + '" data-d="' + esc(b.id) + '">' +
          "<td>" + esc(a.label) + " → " + esc(b.label) + "</td>" +
          '<td class="d">' + (r ? fmt(r.dist) : "∞") + "</td>" +
          "<td>" + (r ? r.nodes.map(L).join(" → ") : "No existe camino") + "</td>" +
          '<td class="' + (alts > 1 ? "alt" : "") + '">' + (r ? (alts > 1 ? alts + " (empate)" : "1") : "—") + "</td></tr>";
      }),
    );
    return (
      '<div class="matrix-scroll full-width"><table class="pairs"><thead><tr><th>Par (origen → destino)</th><th>Distancia mínima</th><th>Camino mínimo</th><th>Caminos mínimos</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>"
    );
  }

  // Clic en una celda: consulta i → j. Clic en el encabezado de fila: caminos desde i.
  matrixBody.addEventListener("click", (e) => {
    const pairRow = e.target.closest("tr[data-o]");
    if (pairRow) return setQuery(pairRow.dataset.o, pairRow.dataset.d);
    const t = e.target.closest("td[data-i], th[data-i]");
    if (!t) return;
    if (!result) return toast("Ejecuta Floyd-Warshall para consultar caminos desde las matrices.", "");
    const i = Number(t.dataset.i);
    if (t.tagName === "TH") return setQuery(idAt(i), null);
    const j = Number(t.dataset.j);
    if (i !== j) setQuery(idAt(i), idAt(j));
  });
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      matrixView = t.dataset.view;
      if (matrixPanel.classList.contains("collapsed")) $("btn-toggle-matrices").click();
      renderMatrices();
    }),
  );
  $("btn-toggle-matrices").addEventListener("click", (e) => {
    const c = matrixPanel.classList.toggle("collapsed");
    e.currentTarget.textContent = c ? "▴ Mostrar" : "▾ Ocultar";
  });
  $("btn-grow-matrices").addEventListener("click", (e) => {
    const g = matrixPanel.classList.toggle("grown");
    e.currentTarget.textContent = g ? "⤡ Reducir" : "⤢ Ampliar";
  });

  // ============================================================
  //  PANELES LATERALES
  // ============================================================
  function updateSidebar() {
    panelNone.classList.add("hidden");
    panelNode.classList.add("hidden");
    panelEdge.classList.add("hidden");

    if (selected.type === "node" && findNode(selected.id)) {
      const n = findNode(selected.id);
      panelNode.classList.remove("hidden");
      $("node-title").textContent = "Nodo " + n.label;
      const out = edges.filter((e) => e.a === n.id).length;
      const inc = edges.filter((e) => e.b === n.id).length;
      $("node-sub").textContent = "Arcos salientes: " + out + " · arcos entrantes: " + inc;
      btnRoutesFrom.classList.toggle("hidden", !result);
    } else if (selected.type === "edge" && findEdge(selected.id)) {
      const e = findEdge(selected.id);
      panelEdge.classList.remove("hidden");
      $("edge-title").textContent = "Arco " + labelOf(e.a) + " → " + labelOf(e.b);
      if (document.activeElement !== edgeWeightInput) edgeWeightInput.value = e.weight;
      edgeWeightError.textContent = "";
    } else {
      selected = { type: null, id: null };
      panelNone.classList.remove("hidden");
    }
  }

  function updateModeUI() {
    [btnModeSelect, btnModeAddNode, btnModeAddEdge].forEach((b) => b.classList.remove("active"));
    ({ select: btnModeSelect, "add-node": btnModeAddNode, "add-edge": btnModeAddEdge })[mode].classList.add("active");
    mainEl.className = "mode-" + mode;
    $("mode-hint").textContent =
      mode === "add-node"
        ? "Haz clic en un espacio vacío del lienzo para ubicar un nuevo nodo."
        : mode === "add-edge"
          ? pendingEdgeStart
            ? "Origen " + labelOf(pendingEdgeStart) + " elegido. Ahora haz clic en el nodo destino (Esc cancela)."
            : "Haz clic en el nodo ORIGEN y luego en el nodo DESTINO; después ingresa el peso."
          : "";
  }

  // Pares (i, j), i ≠ j, conectados por algún camino dirigido (búsqueda
  // en anchura). Sirve para comprobar el resultado de Floyd.
  function countReachablePairs() {
    const adj = {};
    nodes.forEach((n) => (adj[n.id] = []));
    edges.forEach((e) => adj[e.a] && adj[e.a].push(e.b));
    let count = 0;
    nodes.forEach((s) => {
      const seen = new Set([s.id]);
      const queue = [s.id];
      while (queue.length) adj[queue.shift()].forEach((v) => !seen.has(v) && (seen.add(v), queue.push(v)));
      count += seen.size - 1;
    });
    return count;
  }

  function updateStats() {
    $("stat-nodes").textContent = nodes.length;
    $("stat-edges").textContent = edges.length;
    const total = nodes.length * (nodes.length - 1);
    const dot = $("conn-dot"),
      txt = $("conn-text");
    if (nodes.length < 2) {
      $("stat-pairs").textContent = "—";
      dot.className = "conn-dot";
      txt.textContent = nodes.length ? "Ingresa más nodos" : "Sin datos";
      return;
    }
    const r = countReachablePairs();
    $("stat-pairs").textContent = r + " de " + total;
    dot.className = "conn-dot " + (r === total ? "ok" : "bad");
    txt.textContent = r === total ? "Existe camino entre todos los pares de nodos" : total - r + " par(es) sin camino: su distancia será ∞";
  }

  // ---------- Procedimiento iterativo ----------
  function countInf(D) {
    let c = 0;
    D.forEach((row, i) => row.forEach((v, j) => i !== j && v === Infinity && c++));
    return c;
  }

  function stepMessageHtml(s) {
    const n = result.ids.length;
    if (s.kind === "init") {
      return (
        '<span class="tag">Iteración 0 · matrices iniciales</span><br>' +
        "<b>D<sub>0</sub></b>: d(i,j) es el peso del arco i → j; si no hay arco directo se escribe <span class=\"mono\">∞</span>, y la diagonal es 0. " +
        "Como la red es dirigida, el arco A → B solo llena la celda (A,B).<br>" +
        "<b>S<sub>0</sub></b>: s(i,j) = j, es decir, por ahora cada camino va directo a su destino."
      );
    }
    if (s.kind === "iter") {
      const kL = LI(s.k);
      let html =
        '<span class="tag">Iteración ' + (s.k + 1) + " · nodo intermedio k = " + kL + "</span><br>" +
        "La fila y la columna de <b>" + kL + "</b> no cambian. Para cada otra celda se aplica la operación triple: " +
        '<span class="mono">si d(i,' + kL + ") + d(" + kL + ",j) &lt; d(i,j)</span> entonces se reemplaza d(i,j) y s(i,j) = " + kL + ".";
      if (!s.changes.length) return html + '<br><span class="keep">Ninguna celda mejora pasando por ' + kL + ".</span>";
      html += "<br><b>Celdas actualizadas (" + s.changes.length + "):</b><ul>";
      s.changes.forEach((c) => {
        html +=
          "<li>d(" + LI(c.i) + "," + LI(c.j) + "): " + fmt(c.before) + ' → <span class="up">' +
          fmt(c.dik) + " + " + fmt(c.dkj) + " = " + fmt(c.after) + "</span>; s(" + LI(c.i) + "," + LI(c.j) + ") = " + kL + "</li>";
      });
      return html + "</ul>";
    }
    let html =
      '<span class="tag">Fin del algoritmo</span><br>' +
      "Ya se evaluaron los " + n + " nodos como intermedios. <b>D<sub>" + n + "</sub></b> contiene la distancia mínima entre cada par y " +
      "<b>S<sub>" + n + "</sub></b> permite reconstruir cada camino.";
    const inf = countInf(s.D);
    if (inf) html += '<br><span class="keep">' + inf + " par(es) quedaron en ∞: no existe camino entre ellos.</span>";
    return html;
  }

  function updateResultPanels() {
    $("btn-reset-result").classList.toggle("hidden", !result);
    $("stepper-block").classList.toggle("hidden", !result);
    $("query-block").classList.toggle("hidden", !result);
    if (!result) return;

    const total = result.steps.length;
    const final = isFinalStep();
    stepRange.max = total - 1;
    stepRange.value = stepIndex;
    $("step-counter").textContent = "Paso " + (stepIndex + 1) + " / " + total;
    $("step-message").innerHTML = stepMessageHtml(currentSnapshot());
    $("step-first").disabled = $("step-prev").disabled = stepIndex === 0;
    $("step-next").disabled = $("step-last").disabled = final;
    stepPlay.textContent = playTimer ? "❚❚" : "▶";
    stepPlay.classList.toggle("playing", !!playTimer);

    if (final) {
      const n = result.ids.length;
      const inf = countInf(currentSnapshot().D);
      let html = statusCard(
        "Floyd-Warshall completado: <b>" + n + "</b> iteraciones, " + (n * (n - 1) - inf) + " de " + n * (n - 1) + " pares con camino.",
        "success",
      );
      if (inf) html += statusCard("<b>" + inf + " par(es) sin camino</b> (∞ en D): no existe forma de ir de uno al otro respetando el sentido de los arcos.", "warn");
      const checks = consistencyChecks();
      html += statusCard(
        "<b>Verificación de consistencia</b><br>" + checks.map((c) => (c.ok ? "✓ " : "✗ ") + c.text).join("<br>"),
        checks.every((c) => c.ok) ? "" : "error",
      );
      setStatus(html);
    } else {
      setStatus(statusCard("Mostrando el procedimiento iterativo. Usa los controles o las flechas ← → del teclado.", ""));
    }

    fillNodeSelect(queryOrigin, "— elige —");
    queryOrigin.value = qOrigin || "";
    queryDest.innerHTML = "";
    queryDest.appendChild(new Option("— todos —", ""));
    nodes.forEach((nd) => nd.id !== qOrigin && queryDest.appendChild(new Option(nd.label, nd.id)));
    queryDest.value = qDest || "";
    queryDest.disabled = !qOrigin;
    queryResult.innerHTML = queryResultHtml(final);
  }

  function queryResultHtml(final) {
    if (!qOrigin) return '<div class="hint-line">Elige un nodo de origen y un destino.</div>';
    const note = final ? "" : '<div class="hint-line">Valores de la iteración actual: aún pueden mejorar en las siguientes.</div>';

    if (!qDest) {
      const rows = nodes
        .filter((n) => n.id !== qOrigin)
        .map((n) => ({ n, r: routeBetween(qOrigin, n.id) }))
        .sort((a, b) => (a.r ? a.r.dist : Infinity) - (b.r ? b.r.dist : Infinity));
      return (
        note +
        '<table class="results"><thead><tr><th>Destino</th><th>Distancia</th><th>Camino desde ' + L(qOrigin) + "</th></tr></thead><tbody>" +
        rows
          .map(
            (x) =>
              '<tr class="' + (x.r ? "" : "unreach") + '" data-id="' + esc(x.n.id) + '">' +
              '<td class="node-cell">' + esc(x.n.label) + "</td>" +
              '<td class="dist-cell">' + (x.r ? fmt(x.r.dist) : "∞") + "</td>" +
              '<td class="route-cell">' + (x.r ? x.r.nodes.map(L).join(" → ") : "no existe camino") + "</td></tr>",
          )
          .join("") +
        "</tbody></table>"
      );
    }

    const r = routeBetween(qOrigin, qDest);
    if (!r)
      return (
        note +
        '<div class="path-card none"><b>No existe un camino</b> de ' + L(qOrigin) + " a " + L(qDest) + ' respetando el sentido de los arcos: d(' +
        L(qOrigin) + "," + L(qDest) + ") = ∞.</div>"
      );

    const trace = r.trace.length
      ? "Lectura de la matriz S:<br>" +
        r.trace.map((t) => "s(" + LI(t.a) + "," + LI(t.b) + ") = " + LI(t.k) + " → " + LI(t.a) + "…" + LI(t.k) + " + " + LI(t.k) + "…" + LI(t.b)).join("<br>") +
        "<br>Los demás tramos son arcos directos (s(i,j) = j)."
      : "s(" + L(qOrigin) + "," + L(qDest) + ") = " + L(qDest) + " → se va directo por el arco.";

    let alts = "";
    if (final) {
      const opt = optimalRoutes(qOrigin, qDest);
      const all = Routes.simplePaths(weightMatrix(), ix(qOrigin), ix(qDest), 60);
      const isOpt = (p) => Math.abs(p.cost - r.dist) < 1e-9;
      alts =
        '<div class="alts">' +
        (opt.length > 1
          ? "<b>Hay " + opt.length + " caminos mínimos de igual distancia</b> (" + fmt(r.dist) + "). Floyd conserva el primero que encuentra; los demás se marcan punteados en el lienzo."
          : "Es el único camino de distancia mínima.") +
        "<br>Caminos posibles de " + L(qOrigin) + " a " + L(qDest) + " (" + (all.length >= 60 ? "primeros 60" : all.length) + "):" +
        "<ol>" +
        all
          .slice(0, 6)
          .map((p) => '<li class="' + (isOpt(p) ? "opt" : "") + '">' + p.nodes.map(LI).join(" → ") + " = " + fmt(p.cost) + (isOpt(p) ? " (mínimo)" : "") + "</li>")
          .join("") +
        (all.length > 6 ? "<li>…</li>" : "") +
        "</ol></div>";
    }

    return (
      note +
      '<div class="path-card">' +
      "Distancia mínima d(" + L(qOrigin) + "," + L(qDest) + ') = <span class="big">' + fmt(r.dist) + "</span><br>" +
      'Camino: <span class="route">' + r.nodes.map(L).join(" → ") + "</span><br>" +
      '<span class="mono">= ' + r.arcs.map((a) => fmt(a.weight)).join(" + ") + " = " + fmt(r.dist) + "</span>" +
      '<div class="trace">' + trace + "</div>" + alts + "</div>"
    );
  }

  queryResult.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) setQuery(qOrigin, tr.dataset.id);
  });
  queryOrigin.addEventListener("change", () => {
    queryOrigin.blur();
    setQuery(queryOrigin.value || null, null);
  });
  queryDest.addEventListener("change", () => {
    queryDest.blur();
    setQuery(qOrigin, queryDest.value || null);
  });

  function refreshAll() {
    updateModeUI();
    fillNodeSelect(arcFrom, "—", true);
    fillNodeSelect(arcTo, "—", true);
    updateStats();
    updateSidebar();
    updateResultPanels();
    renderMatrices();
    render();
  }

  // ============================================================
  //  CONTROLES DE LA EJECUCIÓN
  // ============================================================
  function goToStep(i) {
    if (!result) return;
    stepIndex = clamp(i, 0, result.steps.length - 1);
    if (isFinalStep()) stopPlay();
    refreshAll();
  }
  function stopPlay() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }
  function togglePlay() {
    if (!result) return;
    if (playTimer) stopPlay();
    else {
      if (isFinalStep()) stepIndex = 0;
      playTimer = setInterval(() => goToStep(stepIndex + 1), 1700);
    }
    goToStep(stepIndex);
  }

  $("step-first").addEventListener("click", () => { stopPlay(); goToStep(0); });
  $("step-prev").addEventListener("click", () => { stopPlay(); goToStep(stepIndex - 1); });
  $("step-next").addEventListener("click", () => { stopPlay(); goToStep(stepIndex + 1); });
  $("step-last").addEventListener("click", () => { stopPlay(); goToStep(Infinity); });
  stepPlay.addEventListener("click", togglePlay);
  stepRange.addEventListener("input", () => { stopPlay(); goToStep(Number(stepRange.value)); });

  $("btn-run").addEventListener("click", () => {
    invalidateResult();
    const err = Floyd.validate(nodes, edges);
    if (err) {
      refreshAll();
      return setStatus(statusCard(err, "error"));
    }
    result = Floyd.run(nodes, edges);
    selected = { type: null, id: null };
    pendingEdgeStart = null;
    stepIndex = chkSteps.checked ? 0 : result.steps.length - 1;
    if (matrixPanel.classList.contains("collapsed")) $("btn-toggle-matrices").click();
    refreshAll();
  });

  $("btn-reset-result").addEventListener("click", () => {
    invalidateResult();
    refreshAll();
  });

  // ============================================================
  //  PANEL DE SELECCIÓN
  // ============================================================
  function applyWeightFromPanel() {
    if (selected.type !== "edge") return;
    const res = parseWeight(edgeWeightInput.value);
    if (res.error) return (edgeWeightError.textContent = res.error);
    edgeWeightInput.blur();
    setEdgeWeight(selected.id, res.value);
    toast("Peso actualizado.", "success");
  }
  $("btn-update-weight").addEventListener("click", applyWeightFromPanel);
  edgeWeightInput.addEventListener("keydown", (e) => e.key === "Enter" && applyWeightFromPanel());
  $("btn-delete-edge").addEventListener("click", () => selected.type === "edge" && deleteEdge(selected.id));
  $("btn-reverse-edge").addEventListener("click", () => selected.type === "edge" && reverseEdge(selected.id));
  $("btn-delete-node").addEventListener("click", () => selected.type === "node" && deleteNode(selected.id));
  $("btn-rename-node").addEventListener("click", () => selected.type === "node" && askRename(selected.id));
  btnRoutesFrom.addEventListener("click", () => selected.type === "node" && setQuery(selected.id, null));

  // ============================================================
  //  MODOS DEL LIENZO
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
    if (mode === "add-node") return toast("Ya hay un nodo en esa posición. Haz clic en un espacio vacío.", "");
    if (mode === "add-edge") {
      if (pendingEdgeStart === null) pendingEdgeStart = id;
      else {
        const a = pendingEdgeStart,
          b = id;
        pendingEdgeStart = null;
        const err = arcError(a, b);
        if (err) toast(err, "error");
        else askWeight("Peso del arco " + labelOf(a) + " → " + labelOf(b), "", (w) => addEdge(a, b, w));
      }
      updateModeUI();
      return render();
    }
    // Modo seleccionar: con resultado, el primer clic elige el origen y el
    // segundo el destino de la consulta.
    if (result) {
      if (!qOrigin || id === qOrigin || qDest) {
        qOrigin = id;
        qDest = null;
        selected = { type: "node", id };
        refreshAll();
      } else setQuery(qOrigin, id);
      return;
    }
    selected = { type: "node", id };
    refreshAll();
  }

  function handleEdgeClick(id) {
    if (mode !== "select") return;
    selected = { type: "edge", id };
    refreshAll();
  }

  function handleBackgroundClick(pt) {
    if (mode === "add-node") addNode(pt.x, pt.y);
    else if (mode === "add-edge") {
      if (pendingEdgeStart !== null) {
        pendingEdgeStart = null;
        updateModeUI();
        render();
      }
    } else {
      selected = { type: null, id: null };
      qOrigin = null;
      qDest = null;
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
      if (ed) askWeight("Peso del arco " + labelOf(ed.a) + " → " + labelOf(ed.b), ed.weight, (w) => setEdgeWeight(ed.id, w));
    }
  });

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (!modalOverlay.classList.contains("hidden") || !confirmOverlay.classList.contains("hidden")) return;

    if (result) {
      const keys = { ArrowRight: stepIndex + 1, ArrowLeft: stepIndex - 1, Home: 0, End: Infinity };
      if (e.key in keys) {
        stopPlay();
        goToStep(keys[e.key]);
        return e.preventDefault();
      }
      if (e.key === " ") {
        togglePlay();
        return e.preventDefault();
      }
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
      qOrigin = null;
      qDest = null;
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
    const pairs = new Set();
    for (const e of data.edges) {
      if (!e || typeof e.id !== "string" || !ids.has(e.a) || !ids.has(e.b)) throw new Error("Hay arcos que referencian nodos inexistentes.");
      if (e.a === e.b) throw new Error("Hay arcos de un nodo hacia sí mismo (no permitidos).");
      if (pairs.has(e.a + ">" + e.b)) throw new Error("Hay arcos repetidos con el mismo origen y destino.");
      pairs.add(e.a + ">" + e.b);
      if (typeof e.weight !== "number" || !isFinite(e.weight) || e.weight <= 0) throw new Error("Hay arcos con peso no válido: solo se admiten pesos positivos.");
    }
    nodes = data.nodes.map((n) => ({ id: n.id, x: clamp(n.x, 30, VIEW_W - 30), y: clamp(n.y, 30, VIEW_H - 30), label: n.label.slice(0, 6) }));
    edges = data.edges.map((e) => ({ id: e.id, a: e.a, b: e.b, weight: e.weight }));
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
    download(new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" }), "red-floyd-" + stamp() + ".json");
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

  // Exporta el lienzo a PNG copiando los estilos calculados de cada elemento.
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
    bg.setAttribute("fill", "#F6F4EF");
    clone.insertBefore(bg, clone.firstChild);

    const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = VIEW_W * 2;
      c.height = VIEW_H * 2;
      const ctx = c.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      c.toBlob((b) => (b ? download(b, "red-floyd-" + stamp() + ".png") : toast("No se pudo generar la imagen.", "error")));
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

  // ---------- Redes de ejemplo y de prueba ----------
  function net(nodeList, arcList) {
    const nodesOut = nodeList.map(([label, x, y], i) => ({ id: "n" + i, x, y, label }));
    const id = (label) => nodesOut.find((n) => n.label === label).id;
    return { nodes: nodesOut, edges: arcList.map(([a, b, w], i) => ({ id: "e" + (100 + i), a: id(a), b: id(b), weight: w })) };
  }
  const EXAMPLES = [
    {
      name: "Red general (6 nodos)",
      msg: "Red general cargada. Pulsa «Ejecutar Floyd-Warshall».",
      data: net(
        [["A", 120, 280], ["B", 330, 110], ["C", 330, 450], ["D", 580, 280], ["E", 810, 450], ["F", 830, 110]],
        [["A", "B", 4], ["A", "C", 2], ["C", "B", 1], ["B", "C", 3], ["B", "D", 5], ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 2], ["F", "A", 3]],
      ),
    },
    {
      name: "Prueba 1 · dirección de los arcos",
      msg: "Prueba 1: compara d(A,C) con d(C,A) y d(A,B) con d(B,A).",
      data: net(
        [["A", 200, 300], ["B", 500, 110], ["C", 800, 300]],
        [["A", "B", 4], ["B", "C", 3], ["C", "A", 2], ["A", "C", 10]],
      ),
    },
    {
      name: "Prueba 2 · caminos alternativos (empate)",
      msg: "Prueba 2: de A a E hay dos caminos mínimos de distancia 6.",
      data: net(
        [["A", 120, 280], ["B", 350, 110], ["C", 350, 450], ["D", 600, 280], ["E", 860, 280]],
        [["A", "B", 2], ["A", "C", 3], ["B", "D", 3], ["C", "D", 2], ["D", "E", 1], ["B", "E", 5]],
      ),
    },
    {
      name: "Prueba 3 · sectores sin conexión",
      msg: "Prueba 3: desde D, E y F no se llega a A, B ni C, y G está aislado.",
      data: net(
        [["A", 110, 140], ["B", 330, 110], ["C", 250, 330], ["D", 560, 330], ["E", 800, 160], ["F", 820, 430], ["G", 130, 480]],
        [["A", "B", 3], ["B", "C", 4], ["C", "A", 2], ["C", "D", 6], ["D", "E", 1], ["E", "F", 2], ["F", "D", 4]],
      ),
    },
  ];
  const exampleSelect = $("example-select");
  EXAMPLES.forEach((ex, i) => exampleSelect.appendChild(new Option(ex.name, i)));
  $("btn-load-example").addEventListener("click", () => {
    const ex = EXAMPLES[Number(exampleSelect.value)];
    const proceed = () => {
      loadNetwork(JSON.parse(JSON.stringify(ex.data)));
      toast(ex.msg, "success");
    };
    if (nodes.length) showConfirm("Esto reemplazará la red actual por «" + ex.name + "». ¿Deseas continuar?", proceed, "Cargar red");
    else proceed();
  });

  // ============================================================
  //  INICIO
  // ============================================================
  refreshAll();
})();
