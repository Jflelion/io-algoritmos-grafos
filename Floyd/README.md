# Constructor de Redes · Algoritmo de Floyd-Warshall

Proyecto de software — Investigación de Operaciones
Ingeniería de Sistemas y Computación · Universidad Tecnológica de Pereira
Docente: Bibiana Patricia Arias Villada

Software para modelar una **red dirigida y ponderada**, construir automáticamente sus matrices de distancias y de recorridos, y aplicar el algoritmo de **Floyd-Warshall** para obtener la distancia mínima y el camino mínimo entre **todos los pares de nodos**. Muestra el procedimiento iteración por iteración y permite consultar el camino entre un origen y un destino.

## Cómo ejecutar

No requiere instalación, compilación ni conexión a internet (sin internet solo cambian las fuentes tipográficas).

1. Abra la carpeta del proyecto.
2. Haga doble clic en **`index.html`** para abrir el programa en un navegador moderno (Chrome, Edge o Firefox).
3. Para ver las pruebas automáticas, abra **`pruebas.html`** (o use el botón «✓ Pruebas del algoritmo» del encabezado).

| Archivo | Contenido |
| --- | --- |
| `index.html` | Estructura de la interfaz |
| `styles.css` | Estilos visuales |
| `app.js` | Código del programa, organizado en secciones (ver abajo) |
| `pruebas.html` | Pruebas automáticas del algoritmo (7 pruebas, 50 verificaciones) |

### Organización del código (`app.js`)

| Sección | Funciones principales |
| --- | --- |
| **ALGORITMO DE FLOYD-WARSHALL** (inicio del archivo) | `initialMatrices` (D₀ y S₀), `validate`, `run` (los tres ciclos k, i, j), `path` (reconstrucción del camino) |
| **ANÁLISIS DE CAMINOS ALTERNATIVOS** | `optimalPaths` (caminos mínimos empatados), `simplePaths` (todos los caminos posibles para comparar) |
| Validación de datos de entrada | `parseWeight`, `validateNodeName`, `arcError` |
| Mutaciones de la red y formularios | agregar, editar y eliminar nodos y arcos |
| Resultado y consultas | `routeBetween`, `consistencyChecks` |
| Render del lienzo y de las matrices | dibujo de la red dirigida, matrices D y S, vistas de iteraciones |

El algoritmo está implementado a mano, sin usar ninguna librería.

## Uso

### 1. Crear la red

- **Ingresar nodos:** escriba un nombre (máx. 6 caracteres) y pulse *Agregar*. El nodo se ubica automáticamente y luego puede arrastrarse.
- **Registrar arcos:** elija el nodo **origen**, el nodo **destino** y el **peso** (número positivo), y pulse *Registrar arco*.
- También se puede trabajar directamente en el lienzo: *Agregar nodo con clic* (tecla `2`) y *Agregar arco con clic* (tecla `3`; primero el origen y luego el destino).
- **Modificar:** en *Seleccionar / Mover* (tecla `1`), haga clic en un arco para cambiar su peso, invertir su sentido o eliminarlo, o en un nodo para renombrarlo o eliminarlo. Doble clic sobre un arco edita su peso y sobre un nodo lo renombra. `Supr` elimina lo seleccionado.
- Mientras se construye la red, el panel inferior muestra en vivo las matrices iniciales **D₀** y **S₀**.

### 2. Ejecutar

Pulse **Ejecutar Floyd-Warshall**. Con «Mostrar procedimiento iteración por iteración» activo, avance con ⏮ ◀ ▶ ▶▏ ⏭, la barra o las flechas `←` `→` (`Espacio` reproduce automáticamente). En cada iteración se resalta el nodo intermedio k, su fila y su columna, y las celdas que cambiaron. En el panel derecho se lista cada operación triple aplicada.

Si la red se modifica después de ejecutar, el resultado se descarta y basta con volver a pulsar *Ejecutar*.

### 3. Ver los resultados

El panel inferior tiene tres pestañas:

- **Iteración actual:** las matrices Dₖ y Sₖ del paso que se está viendo.
- **Todas las iteraciones:** D₀, S₀, D₁, S₁, …, Dₙ, Sₙ una debajo de otra, para revisar la trazabilidad completa. La última es la **matriz final de caminos mínimos**.
- **Caminos de todos los pares:** distancia mínima y camino de cada par (i, j), indicando cuándo hay empate entre varios caminos mínimos.

### 4. Consultar un camino

Elija **origen** y **destino** en *Consultar camino mínimo*, haga clic en una celda de la matriz D, o haga clic en dos nodos del lienzo. Se muestra:

- la **distancia mínima total** y el **camino**, con la suma de los pesos;
- cómo se lee el camino en la matriz S;
- si hay **caminos alternativos** de igual distancia (se dibujan punteados) y la lista de los demás caminos posibles con su distancia;
- un mensaje claro cuando **no existe camino** entre los dos nodos.

Si solo se elige el origen, se ven los caminos hacia todos los demás nodos.

## Cómo leer la visualización

| Elemento | Significado |
| --- | --- |
| Flecha sobre el arco | Sentido del arco: de origen a destino |
| Nodo morado con «k» | Nodo intermedio de la iteración actual |
| Nodo lila punteado | Nodo ya evaluado como intermedio |
| Nodo verde «ORIGEN» / borde rosa «DESTINO» | Nodos de la consulta |
| Arco rosa grueso | Camino mínimo origen → destino |
| Arco rosa punteado | Otro camino mínimo con la misma distancia (empate) |
| Arco azul | Caminos mínimos desde el origen (cuando no hay destino elegido) |
| Fila y columna moradas en las matrices | Fila y columna del nodo intermedio k |
| Celda rosa | Celda que se actualizó en esa iteración |

## El algoritmo de Floyd-Warshall

### Estructuras de datos

La red se representa con dos matrices n × n, donde cada nodo es una fila y una columna:

- **D (matriz de distancias):** d(i,j) es la longitud del mejor camino conocido de i a j.
- **S (matriz de recorridos):** s(i,j) es el nodo por el que pasa el camino de i a j.

### Matrices iniciales

- **D₀:** d(i,j) = peso del arco i → j; **∞** si no hay arco directo; **0** en la diagonal.
  Como la red es dirigida, el arco A → B llena solo la celda (A,B). Por eso D **no es simétrica**.
- **S₀:** s(i,j) = j, es decir, por ahora se va directo al destino.

### Iteraciones

Para cada nodo intermedio **k = 1, 2, …, n** se aplica a cada celda (i, j), con i ≠ k, j ≠ k e i ≠ j, la **operación triple**:

> si d(i,k) + d(k,j) < d(i,j), entonces d(i,j) ← d(i,k) + d(k,j) y s(i,j) ← k

La fila k y la columna k no cambian, porque d(k,k) = 0.

**Por qué funciona:** después de la iteración k, d(i,j) es la longitud del camino más corto que solo usa como intermedios los nodos 1…k. Al permitir el nodo k hay dos posibilidades:

- el mejor camino **no** pasa por k, y d(i,j) se conserva;
- **sí** pasa por k, y entonces está formado por el mejor camino i → k más el mejor camino k → j.

Al terminar la iteración n se han permitido todos los nodos, así que **Dₙ** contiene las distancias mínimas. La complejidad es **O(n³)**.

### Reconstrucción del camino con S

- Si s(i,j) = j, se va directo por el arco i → j.
- Si s(i,j) = k, el camino es camino(i,k) + camino(k,j), y se repite con cada tramo.
- Si d(i,j) = ∞, **no existe camino**.

### Caminos alternativos

Floyd guarda un solo camino por par. El programa detecta los demás caminos con la misma distancia usando la matriz final. Un arco u → v está en algún camino mínimo de i a j si:

> d(i,u) + w(u,v) = d(i,v)  y  d(i,v) + d(v,j) = d(i,j)

## Validaciones

- El nombre de un nodo no puede estar vacío, tener más de 6 caracteres ni repetirse.
- Un arco exige origen y destino existentes y distintos; no puede repetirse el mismo par (origen, destino).
- El peso debe ser numérico y **positivo** (se rechazan 0 y los negativos), al crear un arco, al editarlo y al cargar un archivo.
- No se ejecuta si la red tiene menos de dos nodos o no tiene arcos.
- Al terminar, el programa hace una **verificación de consistencia**:
  - D₀ tiene exactamente los arcos dibujados;
  - la diagonal es 0;
  - cada camino suma su distancia;
  - los pares con distancia finita coinciden con los pares conectados en el gráfico.

## Pruebas y validación (`pruebas.html`)

Las redes de las pruebas 1 a 4 también se pueden cargar en el programa desde «Redes de ejemplo y de prueba».

| Prueba | Qué verifica | Resultado esperado |
| --- | --- | --- |
| 1 · Dirección de los arcos | A→B (4), B→C (3), C→A (2), A→C (10) | D₀(B,A) = ∞; d(B,A) = 5 por B→C→A; d(A,C) = 7 por A→B→C (mejor que el arco directo de 10); d(C,A) = 2 |
| 2 · Distancias mínimas | Red general de 6 nodos | La matriz D₆ completa coincide con la calculada a mano; A→F = 12 por A→C→B→D→E→F |
| 3 · Caminos alternativos | Dos caminos de igual distancia | d(A,E) = 6 por A→B→D→E **y** A→C→D→E; A→B→E = 7 no es mínimo |
| 4 · Sectores sin conexión | Puente de un solo sentido C→D y nodo aislado G | d(A,F) = 16; d(D,A) = ∞; la fila y la columna de G son ∞ |
| 5 · Consistencia | Red ↔ matriz inicial ↔ resultado | D₀ coincide con los arcos, diagonal 0 y cada camino suma su d(i,j) |
| 6 · Validación de datos | Peso 0, negativo o no numérico, arco a un nodo inexistente, lazo, arco repetido | Todos rechazados |
| 7 · Redes aleatorias | 300 redes comparadas con Dijkstra desde cada nodo | 0 diferencias |

### Recorrido de la red general (Prueba 2)

Arcos: A→B 4, A→C 2, C→B 1, B→C 3, B→D 5, C→D 8, C→E 10, D→E 2, D→F 6, E→F 2, F→A 3.

| Iteración (k) | Celdas que mejoran |
| --- | --- |
| 1 (A) | d(F,B): ∞ → 3+4 = 7 · d(F,C): ∞ → 3+2 = 5 |
| 2 (B) | d(A,D): ∞ → 9 · d(C,D): 8 → 1+5 = 6 · d(F,D): ∞ → 12 |
| 3 (C) | d(A,B): 4 → 2+1 = 3 · d(A,D): 9 → 8 · d(A,E): ∞ → 12 · d(B,E): ∞ → 13 · d(F,B): 7 → 6 · d(F,D): 12 → 11 · d(F,E): ∞ → 15 |
| 4 (D) | d(A,E): 12 → 10 · d(A,F): ∞ → 14 · d(B,E): 13 → 7 · d(B,F): ∞ → 11 · d(C,E): 10 → 8 · d(C,F): ∞ → 12 · d(F,E): 15 → 13 |
| 5 (E) | d(A,F): 14 → 12 · d(B,F): 11 → 9 · d(C,F): 12 → 10 · d(D,F): 6 → 4 |
| 6 (F) | d(B,A): ∞ → 12 · d(C,A): ∞ → 13 · d(D,A): ∞ → 7 · d(D,B): ∞ → 10 · d(D,C): ∞ → 9 · d(E,A): ∞ → 5 · d(E,B): ∞ → 8 · d(E,C): ∞ → 7 · d(E,D): ∞ → 13 |

Matriz final D₆ (fila = origen, columna = destino):

| Origen | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| **A** | 0 | 3 | 2 | 8 | 10 | 12 |
| **B** | 12 | 0 | 3 | 5 | 7 | 9 |
| **C** | 13 | 1 | 0 | 6 | 8 | 10 |
| **D** | 7 | 10 | 9 | 0 | 2 | 4 |
| **E** | 5 | 8 | 7 | 13 | 0 | 2 |
| **F** | 3 | 6 | 5 | 11 | 13 | 0 |

Lectura de A → F con S₆:

- s(A,F) = E, así que A…E + E…F;
- s(A,E) = D, así que A…D + D…E;
- s(A,D) = C, así que A…C + C…D;
- s(C,D) = B, así que C…B + B…D.

Camino: **A → C → B → D → E → F = 2 + 1 + 5 + 2 + 2 = 12**.

---

## Guía para la sustentación

**Explicación corta.**
> "Floyd-Warshall calcula la distancia mínima entre todos los pares de nodos. Parte de la matriz D₀ con los pesos de los arcos dirigidos, con ∞ donde no hay arco y 0 en la diagonal, y de la matriz de recorridos S₀. En la iteración k pregunta, para cada par (i, j), si es más corto pasar por k. Si lo es, actualiza d(i,j) y escribe k en s(i,j). Después de n iteraciones, D tiene las distancias mínimas y S permite reconstruir cada camino."

**Preguntas probables:**

- **¿Por qué la matriz no es simétrica?** Porque la red es dirigida: el arco A → B solo llena la celda (A,B). En la Prueba 1, d(A,C) = 7 pero d(C,A) = 2.
- **¿Por qué no cambian la fila y la columna k?** Para la fila, d(k,k) + d(k,j) = d(k,j); para la columna, d(i,k) + d(k,k) = d(i,k). Pasar por k no mejora nada.
- **¿Qué significa ∞ al final?** Que no existe ningún camino de i a j que respete el sentido de los arcos (Prueba 4).
- **¿Qué pasa si hay dos caminos con la misma distancia?** La operación triple usa `<` estricto, así que se conserva el primero encontrado. El programa muestra los demás como alternativos (Prueba 3).
- **¿Por qué solo pesos positivos?** Lo exige el enunciado. Floyd funciona también con negativos siempre que no haya ciclos negativos, pero con pesos positivos se garantiza que nunca existan.
- **¿Complejidad?** O(n³) en tiempo, por los tres ciclos anidados, y O(n²) en memoria para D y S.
- **¿Diferencia con Dijkstra?** Dijkstra calcula las distancias desde un solo origen. Floyd las calcula para todos los pares a la vez, con matrices.
