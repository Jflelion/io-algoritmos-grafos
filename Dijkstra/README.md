# Constructor de Redes · Algoritmo de Dijkstra

Proyecto de software — Investigación de Operaciones
Ingeniería de Sistemas y Computación · Universidad Tecnológica de Pereira
Docente: Bibiana Patricia Arias Villada

Aplicación web para construir libremente una red ponderada (dirigida o no dirigida), elegir un nodo de origen y ejecutar el algoritmo de Dijkstra para obtener las distancias mínimas y los caminos mínimos hacia los demás nodos. Muestra el resultado directamente sobre la red y permite recorrer la ejecución paso a paso.

## Cómo ejecutar

No requiere instalación, compilación ni conexión a internet (sin internet solo cambian las fuentes tipográficas).

1. Abra la carpeta del proyecto.
2. Haga doble clic en **`index.html`** para abrirlo en un navegador moderno (Chrome, Edge o Firefox).

Archivos:

| Archivo | Contenido |
| --- | --- |
| `index.html` | Estructura de la interfaz |
| `styles.css` | Estilos visuales |
| `app.js` | Lógica completa: **algoritmo de Dijkstra** (sección «ALGORITMO DE DIJKSTRA», al inicio del archivo), construcción de la red, dibujo, validaciones y visualización de resultados |

## Uso rápido

1. **Agregar nodo** (tecla `2`): haga clic en el lienzo para ubicar cada nodo.
2. **Agregar arco** (tecla `3`): haga clic en un nodo y luego en otro; escriba el peso (número ≥ 0).
3. **Seleccionar / Mover** (tecla `1`):
   - arrastre un nodo para moverlo;
   - haga clic en un arco para cambiar su peso o eliminarlo (en red dirigida también puede invertir su sentido);
   - haga clic en un nodo para eliminarlo, renombrarlo o establecerlo como origen;
   - doble clic sobre un nodo lo renombra; doble clic sobre un arco edita su peso;
   - `Supr` elimina el elemento seleccionado y `Esc` cancela.
4. Elija el **tipo de red**: *No dirigida* o *Dirigida*.
5. Elija el **nodo de origen** en el panel derecho (o con «Establecer como origen»).
6. Pulse **Ejecutar Dijkstra**.
   - Con «Mostrar ejecución paso a paso» activo, use los botones ⏮ ◀ ▶ ▶▏ ⏭, la barra deslizante o las flechas `←` `→` del teclado (`Espacio` reproduce automáticamente).
   - «Ver tabla de iteraciones» muestra la tabla clásica de etiquetas por iteración.
7. En el resultado final, haga clic en una fila de la tabla o en un nodo del lienzo para resaltar su recorrido desde el origen y ver la suma de pesos.
8. «Volver a la red original» quita el resultado y muestra la red sin marcas.

También puede cargar las **redes de ejemplo**, guardar/cargar la red en formato `.json` y exportar el lienzo como imagen `.png`.

## Cómo leer la visualización

| Elemento | Significado |
| --- | --- |
| Nodo lila con la marca «ORIGEN» | Nodo de origen |
| `[d, p]` sobre fondo coral | Etiqueta **permanente**: distancia mínima `d` definitiva, llegando desde el predecesor `p` |
| `(d, p)` con borde punteado | Etiqueta **temporal**: mejor distancia conocida hasta ese momento |
| `∞` / nodo punteado gris | Nodo **inalcanzable** desde el origen |
| Arco coral con flecha | Arco que pertenece a un camino mínimo (la flecha indica el sentido del recorrido) |
| Arco amarillo grueso | Camino mínimo hacia el destino que se seleccionó |
| Arco turquesa animado | Arco que se está evaluando (relajación) en el paso actual |
| Arco gris punteado | Arco que no forma parte de ningún camino mínimo |

## El algoritmo (sección «ALGORITMO DE DIJKSTRA» de `app.js`)

Dijkstra calcula las distancias mínimas desde un origen `s` cuando **todos los pesos son no negativos**.

1. **Inicialización:** `d(s) = 0` y `d(v) = ∞` para los demás nodos. Todas las etiquetas son temporales.
2. **Selección:** entre los nodos con etiqueta temporal y distancia finita se elige el de menor distancia `u`, y su etiqueta pasa a ser **permanente**.
3. **Relajación:** para cada arco `u → v` con `v` temporal:
   si `d(u) + w(u,v) < d(v)`, entonces `d(v) = d(u) + w(u,v)` y `pred(v) = u`.
4. Se repiten los pasos 2 y 3 hasta que no queden nodos temporales alcanzables. Los nodos que conservan `∞` son inalcanzables.

**¿Por qué no se admiten pesos negativos?** Cuando un nodo se vuelve permanente, cualquier otro camino hacia él tendría que pasar por un nodo temporal con distancia mayor o igual, y como los pesos son ≥ 0 no podría resultar más corto. Con un peso negativo esta garantía deja de cumplirse y el resultado podría ser incorrecto.

**Camino mínimo:** se reconstruye siguiendo los predecesores desde el destino hasta el origen (función `pathTo`).

**Detalles de implementación:**

- La selección del mínimo es lineal (versión clásica O(V²)), que es la más fiel al procedimiento de clase.
- En red no dirigida, cada arco se agrega a la lista de adyacencia en ambos sentidos.
- En caso de empate en la selección, se toma el nodo creado primero. En caso de empate al relajar (`=`), se conserva el predecesor actual: existe un camino alterno de igual longitud.
- Cada paso se guarda como una «fotografía» del estado (`steps`), que la interfaz usa para la visualización paso a paso y la tabla de iteraciones.

## Validaciones implementadas

- No se pueden crear arcos entre nodos inexistentes, de un nodo hacia sí mismo ni arcos duplicados.
- El peso debe ser numérico y **no negativo**; se rechaza al crear o editar un arco y al cargar un archivo.
- Se exige un nodo de origen antes de ejecutar.
- No se ejecuta si la red está vacía, tiene menos de dos nodos, no tiene arcos, o si el origen no tiene arcos (salientes, en red dirigida).
- Se informa qué nodos son inalcanzables desde el origen y su distancia se muestra como ∞.
- El panel «Estado de la red» indica en todo momento cuántos nodos son alcanzables desde el origen.
- Cualquier cambio en la red, en los pesos, en el tipo de red o en el origen invalida el resultado anterior, para que nunca se muestre un resultado desactualizado.

## Redes de ejemplo

- **No dirigida** (problema del parque Seervada, Hillier & Lieberman): origen O; distancia mínima a T = 13 por O → A → B → D → T.
- **Dirigida:** origen A, con arcos en ambos sentidos entre B y C y un nodo G inalcanzable. Distancia mínima a F = 12 por A → C → B → D → E → F.
