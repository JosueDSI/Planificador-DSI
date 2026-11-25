# Auditoría de la capa de interfaz (frontend UI): Planificador DSI

- **Fecha:** 2026-11-25
- **Commit auditado:** `e869fcf` (rama `main`). Las líneas citadas se refieren a ese commit.
- **Alcance:** exclusivamente el frontend: `frontend/src/App.jsx`, `frontend/src/api.js`, `frontend/src/styles.css`, `frontend/index.html`. Backend fuera de alcance (ver `auditoria-2026-11-25.md`).
- **Ejes:** estados de interfaz (carga, vacío, error), render y estado, responsividad, accesibilidad y validaciones o flujos.
- **Resultado:** todos los hallazgos de este documento **se corrigieron** en la misma sesión (ver la sección "Cambios aplicados"). Los cambios no están en ningún commit todavía.

## Resumen

| Severidad | Cantidad |
|---|---|
| 🟠 Alto | 10 |
| 🟡 Medio | 21 |
| ⚪ Bajo | 8 |

No hay hallazgos críticos en la capa de interfaz. Los riesgos críticos (autenticación y autorización) están en el backend y se documentan en la auditoría anterior.

---

## 1. Estados de interfaz: carga, vacío y error

| # | Sev. | Archivo:línea | Problema | Propuesta (aplicada) |
|---|---|---|---|---|
| E1 | 🟠 | `App.jsx:514-526`, `:1402` | **Guardar actividad** no tiene estado de carga ni bloqueo. Un doble clic envía dos `POST` y crea actividades duplicadas. | `BotonCarga` con spinner y `disabled` mientras dura la petición, más una salida anticipada (`if (guardando) return`). |
| E2 | 🟠 | `App.jsx:528-538`, `:540-550`, `:330-351`, `:353-364` | Eliminar, comentar, crear usuario y restablecer clave tampoco tienen estado de carga. Doble Enter duplica comentarios. Doble clic en eliminar muestra un 404. | Un indicador de ocupado por cada acción y botones bloqueados con texto de progreso ("Eliminando…", "Enviando…"). |
| E3 | 🟠 | `App.jsx:566-573` | La carga inicial es un texto plano. Si la API falla, el mensaje queda fijo, **sin botón de reintento**, y **el login nunca aparece** porque depende de que cargue el catálogo. | Login independiente del catálogo. Skeleton mientras carga. Pantalla de error con "Reintentar" y "Cerrar sesión". |
| E4 | 🟠 | `api.js:14-19` | `fetch` sin límite de tiempo: una API colgada deja spinners infinitos. Los errores de red muestran "Failed to fetch", en inglés y sin contexto. | `AbortController` con 15 s de límite y mensajes en español para la falta de conexión, el tiempo agotado y los errores 5xx. |
| E5 | 🟡 | `App.jsx:419` | `alert()` bloqueante al exportar un día vacío. | Botón deshabilitado con `title` explicativo y aviso no bloqueante. |
| E6 | 🟡 | `App.jsx:529` | `window.confirm` para eliminar: diálogo nativo, fuera del estilo de la app y bloqueante. | Confirmación en línea dentro del pie del modal ("¿Eliminar DSI-3 definitivamente?"). |
| E7 | 🟡 | `App.jsx:521-522`, `:533-534`, `:557-559` | Guardar, eliminar y mover terminan **en silencio**: no hay confirmación de éxito. | Pila de avisos (toasts) accesible con `aria-live`. |
| E8 | 🟡 | `App.jsx:756` | El banner de error global no se puede cerrar, no tiene `aria-live` y queda "pegado" hasta otra acción. | Los errores pasan a avisos que se cierran solos o con un botón. |
| E9 | 🟡 | `App.jsx:1220-1231` | Columnas del tablero vacías sin mensaje ni zona visible para soltar. | Marcador "Sin actividades" / "Suelta aquí la actividad". |
| E10 | 🟡 | `App.jsx:1097-1124`, `:982-1009` | La gráfica de categorías vacía queda en blanco. La dona con total 0 solo muestra el anillo gris. | `EstadoVacio` compacto. La dona solo dibuja segmentos si hay datos. |
| E11 | 🟡 | `App.jsx:366-378` | Si la búsqueda o los filtros no devuelven nada, ninguna vista lo explica. Además no hay estado vacío para un área sin actividades. | Aviso "Ninguna actividad coincide…" con "Limpiar filtros" y estado vacío con "Nueva actividad". |
| E12 | ⚪ | `App.jsx:666-668` | El botón dice "Verificando…", pero el texto nunca se ve porque el formulario se sustituye por la animación. | Texto de estado accesible bajo la animación líquida. |

## 2. Render y estado

| # | Sev. | Archivo:línea | Problema | Propuesta (aplicada) |
|---|---|---|---|---|
| R1 | 🟠 | `App.jsx:230-1580` | Un solo componente de 1 350 líneas. **Cada tecla** en la búsqueda, un comentario, el login o el formulario re-renderiza el dashboard entero (KPIs, dona, tablero). | División en `components/` (Resumen, Tablero, Agenda, ActividadModal, AdminModals, Login, Modal, Tarjeta). El estado del formulario vive en su modal. `memo` en las vistas y `useDeferredValue` en la búsqueda. |
| R2 | 🟠 | `App.jsx:23-26`, `:89`, `:108` | `vencida()` usa `new Date()` en cada render, pero **nada re-renderiza con el tiempo**. Una tarea que vence a las 10:00 no se marca como "Vencida" hasta que el usuario interactúa. | Reloj `ahora` que se actualiza cada 60 s y un `Set` memoizado de IDs vencidos. |
| R3 | 🟠 | `App.jsx:552-564` | El drag & drop no actualiza la interfaz de forma optimista: la tarjeta vuelve a su columna hasta que responde la API, sin ninguna indicación. Soltarla en su misma columna llama igualmente a la API y a `/historial`. | Movimiento optimista con reversión si la API falla, tarjeta atenuada mientras se guarda y salida anticipada si el estado no cambia. |
| R4 | 🟠 | `App.jsx:840`, `:847-849` vs `:384` | **Desincronización entre KPI y filtro**: "Pendientes" cuenta por hacer + en espera, pero al hacer clic filtra solo por hacer. "Prioritarias" cuenta las de prioridad Alta *abiertas*, pero al hacer clic muestra también las completadas. | Filtros compuestos `pendientes` y `abiertas`, y los KPIs usan exactamente la misma regla al contar que al filtrar. |
| R5 | 🟡 | `App.jsx:822,833,843,867,891,915,934` | Estilos en línea con `"… !important"`: React **descarta** el valor, así que los bordes de color de los KPIs y el color del TOTAL nunca se pintan. | Clase `.kpi-card` con la variable CSS `--kpi`. |
| R6 | 🟡 | `App.jsx:819` | La clase `ring-active` no existe en el CSS: el KPI activo no se distingue. | Estado `.activo` y `aria-pressed`. |
| R7 | 🟡 | `App.jsx:1176`, `:1179`, `:1183`, `:1139`, `:682-688` | El mismo `filter` se ejecuta tres veces por render. Un bucle por persona recorre todas las actividades (O(n·u)). `delDia`/`ocupado` no están memoizados. | `calcularResumen()` en una sola pasada, memoizada. |
| R8 | 🟡 | `App.jsx:1355` | La key `nueva-${indice}` en subtareas nuevas hace que, al borrar una intermedia, el foco y la edición salten a otra fila. | Clave estable `_key` por subtarea. |
| R9 | 🟡 | `App.jsx:239-246` | La sesión de `localStorage` nunca se contrasta con los datos reales: un usuario desactivado sigue "dentro" y un cambio de nombre o de rol no se refleja. | Sincronización con `catalogo.usuarios`: la sesión se cierra si el usuario ya no está activo y se actualiza si cambió. |
| R10 | 🟡 | `App.jsx:521-522`, `:534`, `:347` | Tras guardar o eliminar se recargan los **8 endpoints** de inicio. | Actualización local del elemento afectado y solo se refresca `/historial`. |
| R11 | 🟡 | `App.jsx:2`, `index.html:9` | `xlsx` (430 KB) va en el bundle inicial aunque solo se use al exportar. Bootstrap se carga **dos veces** (CDN y npm). | `import("xlsx")` bajo demanda (chunk separado) y eliminación del enlace al CDN. |
| R12 | ⚪ | `App.jsx:985` | Los porcentajes de la dona se redondean por separado y pueden sumar 99 o 101 (huecos o solapamientos). | Arcos con la proporción exacta; solo se redondea la etiqueta. |
| R13 | ⚪ | `App.jsx:313-315`, `:305` | Los temporizadores del login y del skeleton no se cancelan al desmontar. | Registro de temporizadores con limpieza en el `unmount`. |
| R14 | ⚪ | `App.jsx:106`, `:1209`, `:1261` | Fechas en crudo (`2026-11-25`, `2026-11-25T08:10`). | `Intl.DateTimeFormat("es-PE")` y fechas relativas ("Hoy", "Mañana"). |

## 3. Responsividad, accesibilidad y flujos

| # | Sev. | Archivo:línea | Problema | Propuesta (aplicada) |
|---|---|---|---|---|
| A1 | 🟠 | `App.jsx:818-951`, `:1040`, `:1101`, `:1143`, `:990` | KPIs, filas de estado, categorías y personas son `div` con `onClick`: **inaccesibles por teclado** y sin rol. | `<button>` con `aria-pressed` y foco visible. La dona tiene `role="img"` y una descripción textual. |
| A2 | 🟠 | `App.jsx:91-92`, `:1226-1227` | Mover actividades **solo funciona arrastrando con el ratón**. El drag & drop HTML5 no funciona en pantallas táctiles ni con teclado. | Selector "Mover a…" en cada tarjeta del tablero, como alternativa táctil y de teclado. |
| A3 | 🟡 | `App.jsx:1280-1408`, `:1411`, `:1515` | Modales sin `role="dialog"`/`aria-modal`/`aria-labelledby`. Escape no hace nada, el foco no entra ni se atrapa, el fondo sigue desplazándose y **un clic fuera descarta los cambios sin avisar**. | Componente `Modal` accesible: cierre con Escape, foco inicial y atrapado, bloqueo del scroll, devolución del foco y confirmación "Descartar cambios" si el formulario se modificó. |
| A4 | 🟡 | `App.jsx:1296-1350`, `:761-786` | Las etiquetas del formulario no están asociadas a sus campos (falta `htmlFor`/`id`). Los filtros solo tienen placeholder u opción inicial como etiqueta. | `useId` + `htmlFor` y etiquetas `visually-hidden` en los filtros. |
| A5 | 🟡 | `App.jsx:655-663`, `:1481`, `:1558` | Botones de ver contraseña con emoji, `tabIndex=-1` y sin `aria-label`. | `CampoClave` con icono SVG, `aria-label`, `aria-pressed` y acceso por teclado. |
| A6 | 🟡 | `App.jsx:1310-1314` | No hay validación visual de horario: "fin ≤ inicio" solo se descubre al guardar, por el error del servidor. | Validación en vivo con `is-invalid`, duración calculada y avisos de "fuera de jornada" y de **cruce con otra actividad del mismo responsable**. |
| A7 | 🟡 | `App.jsx:1458-1465` | Si `/api/puestos` falla, aparecen puestos inventados con **IDs que no coinciden** con la BD. | Se eliminan los datos de respaldo; se muestra un aviso y el envío queda bloqueado. |
| A8 | 🟡 | `App.jsx:694-754` | En pantallas de unos 390 px, la cabecera (título, botones de administración, correo, Salir) se aprieta y trunca el título. | Cabecera sticky. A partir de 576 px se ocultan el avatar y la insignia; los botones de administración quedan solo con icono por debajo de `lg`. |
| A9 | 🟡 | `styles.css:180-184` | `max-height: calc(85vh - 120px)` en el cuerpo del modal: en iOS la barra del navegador esconde el pie con los botones. | Modal en columna flex con `100dvh`. En móvil pasa a ser una **hoja inferior** con el pie siempre visible. |
| A10 | ⚪ | `App.jsx:417` | Exportar usa las actividades filtradas sin indicarlo: el "reporte diario" puede salir incompleto. | Nota visible: "Se muestran y exportan solo las actividades que cumplen los filtros". |
| A11 | ⚪ | `App.jsx:1244` | El selector de fecha de la agenda acepta un valor vacío y no tiene botones anterior/siguiente/hoy. | Navegación ◀ Hoy ▶, fecha larga legible y valor vacío ignorado. |
| A12 | ⚪ | `styles.css:204-386` | Animaciones infinitas sin `prefers-reduced-motion`. | Regla global que respeta la preferencia de reducir movimiento. |
| A13 | ⚪ | `App.jsx:80` | Las subtareas vacías se descartan en silencio al guardar. | Aviso "Las subtareas vacías no se guardarán". Enter añade una nueva subtarea. |

---

## Cambios aplicados (modernización)

### Estructura nueva

```
frontend/src/
├── App.jsx                     # orquesta estado global, cabecera, filtros y vistas
├── api.js                      # + timeout, mensajes de red en español, 5xx legibles
├── utils.js                    # fechas, filtros, métricas, formularios (funciones puras)
├── exportar.js                 # exportación Excel con import() bajo demanda
├── styles.css                  # tokens de diseño, componentes, móvil, reduced-motion
└── components/
    ├── Modal.jsx               # diálogo accesible reutilizable
    ├── ActividadModal.jsx      # formulario con validación en vivo y estado propio
    ├── AdminModals.jsx         # crear usuario / restablecer clave
    ├── Resumen.jsx             # KPIs, dona, categorías, personas, atención, historial
    ├── Tablero.jsx             # kanban con drop resaltado y movimiento optimista
    ├── Agenda.jsx              # navegación de días, ocupación, cruces, exportar
    ├── Tarjeta.jsx             # tarjeta memoizada (+ selector "Mover a")
    ├── Login.jsx               # conserva la animación líquida A21
    ├── DashboardSkeleton.jsx   # skeleton alineado al nuevo layout
    ├── Icono.jsx               # iconos SVG lineales sin dependencias
    └── ui.jsx                  # BotonCarga, EstadoVacio, Avatar, CampoClave, PilaAvisos
```

### Detalles visuales
- Tokens de superficie (bordes suaves, radios de 10 a 16 px, dos niveles de sombra) y foco visible naranja en toda la app.
- Cabecera fija con desenfoque, avatar con iniciales y botón "Saltar al contenido".
- KPIs con borde de color real, estado activo con anillo y valores con cifras tabulares.
- Tarjetas con chips (subtareas, comentarios, vencida), píldora de prioridad, avatar del responsable y fecha relativa.
- Tablero con scroll-snap en móvil y columna destino resaltada al arrastrar.
- Agenda con barra de ocupación de la jornada, alerta de sobreasignación y marca de "Cruce".
- Historial en forma de línea de tiempo y comentarios como burbujas con autor y hora.
- Login con fondo degradado de marca, aviso de Bloq Mayús y botón deshabilitado hasta completar los campos.
- La animación líquida del isotipo y el skeleton posterior al login **se conservan**.

### Decisiones a revisar
- **Contraseña mínima de 8 caracteres** en "Crear usuario" y "Restablecer clave", solo en la interfaz. El backend aún acepta 1 carácter (hallazgo A3 de la auditoría anterior).
- Selector "Mover a…" visible en todas las tarjetas del tablero. Si en escritorio resulta recargado, puede limitarse a móvil con `d-lg-none`.
- Se respetó el commit `e869fcf`: la hora por defecto de una actividad nueva sigue siendo 09:00–10:00.

## Verificación

- `npm run build`: compila sin errores. Bundle inicial: **222 KB** de JS (68 KB gzip); `xlsx` va en un chunk aparte de 430 KB que solo se descarga al exportar.
- Prueba en Edge headless contra el backend local, con una base SQLite temporal (no se tocó la BD de desarrollo):
  - El login renderiza; el dashboard renderiza con datos y los KPIs cuadran con el seed (10 / 5 / 3 / 2 / 20 % / 4).
  - Sin errores de JavaScript en consola.
  - A 390 px reales no hay desbordamiento horizontal de la página (`scrollWidth` igual al ancho visible).
  - Modal: abre con foco en el título, marca en vivo "fin ≤ inicio" y, al pulsar Escape con cambios, ofrece "Seguir editando / Descartar cambios".
- **No verificado:** crear, guardar, eliminar o mover contra la API desde la interfaz, la exportación real a `.xlsx` ni lectores de pantalla. Conviene una pasada manual con `npm run dev`.
