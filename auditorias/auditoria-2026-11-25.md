# Auditoría de código: Planificador DSI

- **Fecha:** 2026-11-25
- **Commit auditado:** `284f3df` (rama `main`)
- **Alcance:** todo el código: `backend/app/*`, `api/index.py`, `frontend/src/*`, `vercel.json` y las dependencias. Auditoría de solo lectura, sin modificaciones.

## Resumen

El problema principal es de arquitectura. El backend no tiene autenticación ni autorización. El login solo valida la contraseña y devuelve un JSON que el frontend guarda en `localStorage`. Todos los endpoints confían en los IDs que llegan en el cuerpo de la petición. Varios de los hallazgos siguientes son consecuencia directa de esto.

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 5 |
| 🟠 Alto | 7 |
| 🟡 Medio | 16 |

---

## 🔴 CRÍTICO

### C1. Endpoints de administración sin autenticación: cualquiera puede tomar el control
- **Dónde:** `backend/app/routes.py:167` (`POST /api/usuarios`), `:200` (`POST /api/usuarios/recuperar-clave`), `:402` (`DELETE /api/actividades/{id}`) y, en general, todo el router.
- **Por qué falla:**
  - Ninguna ruta comprueba quién hace la petición.
  - Cualquiera con la URL puede ejecutar `POST /api/usuarios/recuperar-clave {"usuario_id":1,"nueva_clave":"x"}` y quedarse con la cuenta del administrador.
  - También puede ejecutar `POST /api/usuarios {..., "es_admin": true}` y crearse una cuenta de administrador.
  - La comprobación `usuarioActual.es_admin` existe solo en la interfaz (`frontend/src/App.jsx:704,715`) y sale de `localStorage` (`App.jsx:239-246`). Basta con editar ese valor en el navegador para ver el panel de administración.
- **Solución:**
  - Emitir un token firmado en `/api/login` (JWT, o una cookie `HttpOnly` + `Secure` + `SameSite`).
  - Crear las dependencias `usuario_actual = Depends(obtener_usuario_token)` y `requiere_admin`.
  - Aplicar `requiere_admin` a crear usuario, restablecer clave y eliminar.
  - En el frontend, validar la sesión contra un endpoint `/api/me` en lugar de confiar en `localStorage`.

### C2. Suplantación de identidad y auditoría falsificable
- **Dónde:** `backend/app/schemas.py:33,47,61` (`reportado_por`, `autor_id`) y `backend/app/routes.py:316,362,381,397`.
- **Por qué falla:** el autor de los comentarios, de los cambios de estado y del historial lo decide el cliente. Cualquiera puede comentar o mover tareas en nombre de otra persona. En `PATCH /estado`, `autor_id` es opcional, así que también se pueden hacer cambios anónimos. El historial no sirve como auditoría.
- **Solución:** obtener `autor_id` del usuario autenticado (C1) e ignorar ese dato en el cuerpo de la petición.

### C3. Contraseña por defecto compartida, versionada en git y sin cambio obligatorio
- **Dónde:** `backend/app/seed.py:70-77`.
- **Por qué falla:**
  - La contraseña inicial está en texto plano en el historial de git y es la misma para las 4 cuentas, que tienen correos corporativos reales (tres de ellas con rol de administrador).
  - No se obliga a cambiarla en el primer inicio de sesión.
  - `/api/login` no limita los intentos (ver A4).
- **Solución:**
  - Leer la contraseña inicial de una variable de entorno o generarla al azar e imprimirla una sola vez.
  - Añadir el campo `debe_cambiar_clave` y forzar el cambio en el primer inicio de sesión.
  - Cambiar ya las contraseñas en producción.
  - Sacar los correos reales del seed.

### C4. Exposición de datos sin sesión
- **Dónde:** `backend/app/routes.py:136` (`/api/usuarios`, devuelve los correos de todo el personal), `:232` (`/api/actividades`) y `:254` (`/api/historial`). En `frontend/src/App.jsx:280-282` el catálogo completo se descarga antes del login.
- **Por qué falla:** toda la información del área (actividades, comentarios, correos) es pública para cualquiera que llame a la API. La pantalla de login solo oculta la interfaz.
- **Solución:** proteger todos los GET con `usuario_actual` y cargar los datos después del login.

### C5. Base de datos efímera en Vercel (si no está definido `DATABASE_URL`)
- **Dónde:** `backend/app/database.py:15-21`.
- **Por qué falla:**
  - SQLite en `/tmp` es local a cada instancia serverless. Dos instancias tienen datos distintos, y cada arranque en frío borra los datos y vuelve a sembrar la demo.
  - Resultado: actividades que "desaparecen", estados distintos según qué instancia responda y la contraseña por defecto restaurada.
- **Solución:** que el arranque falle si `VERCEL` está definido y `DATABASE_URL` no. Usar Postgres (Neon, Supabase o Vercel Postgres).

---

## 🟠 ALTO

### A1. Condición de carrera en el número correlativo y doble clic en "Guardar"
- **Dónde:** `backend/app/routes.py:299-313` (lee `area.siguiente_numero` y lo incrementa) y `frontend/src/App.jsx:514-526` y `:1402`, donde el botón no se deshabilita.
- **Por qué falla:**
  - Dos peticiones simultáneas leen el mismo número y la segunda choca con `uq_actividad_numero`. Ese `IntegrityError` no se captura, así que el usuario recibe un 500 con el mensaje genérico.
  - Un doble clic puede crear **dos actividades duplicadas** si las peticiones no colisionan.
- **Solución:**
  - En el backend, usar `select(Area).with_for_update()` (Postgres) o capturar `IntegrityError` y reintentar.
  - En el frontend, añadir el estado `guardando`, poner `disabled={guardando}` en el botón y salir pronto con `if (guardando) return;` en `guardar`.

### A2. Doble envío en el resto de acciones críticas
- **Dónde:**
  - `frontend/src/App.jsx:540` (`comentar`, disparado por Enter o por clic): genera comentarios duplicados.
  - `App.jsx:528` (`eliminar`): el segundo clic devuelve un 404 que se muestra como error.
  - `App.jsx:330` (`handleCrearUsuario`): el segundo envío responde "ya registrado" aunque el primero funcionó.
  - `App.jsx:353` (restablecer clave).
- **Por qué falla:** en el backend, `backend/app/routes.py:173-189` comprueba si el usuario existe y luego inserta sin protección (check-then-insert). Con concurrencia, el insert lanza un `IntegrityError` que acaba en un 500.
- **Solución:** un indicador `enviando` por cada acción, y capturar `IntegrityError` para devolver un 409.

### A3. La política de contraseñas no se aplica
- **Dónde:** `backend/app/auth_utils.py:23-25` y `backend/app/schemas.py:76,88`.
- **Por qué falla:** `validar_clave_robusta` solo exige que la contraseña no esté vacía y además **no se llama nunca** (se importa en `schemas.py:5` y no se usa). Hoy se acepta una contraseña de 1 carácter, incluso al restablecer la del administrador.
- **Solución:** exigir mínimo 10–12 caracteres con variedad de tipos de carácter y aplicar la validación con `@field_validator` en `clave` y en `nueva_clave`.

### A4. Login sin límite de intentos y con enumeración de usuarios por tiempo
- **Dónde:** `backend/app/routes.py:155-159`.
- **Por qué falla:**
  - Si el usuario no existe, la respuesta llega enseguida. Si existe, se ejecuta PBKDF2 (unos 100 ms), y esa diferencia revela qué correos son válidos.
  - No hay bloqueo ni límite de intentos.
  - 100 000 iteraciones están por debajo de lo que recomienda OWASP (600 000 para PBKDF2-SHA256).
- **Solución:**
  - Ejecutar siempre `verificar_clave` contra un hash ficticio cuando el usuario no existe.
  - Añadir un límite de intentos (`slowapi`) o un contador de intentos con bloqueo temporal.
  - Migrar a `argon2-cffi` o subir las iteraciones.

### A5. Pérdida de cambios por edición concurrente (last-write-wins)
- **Dónde:** `backend/app/routes.py:322-364`.
- **Por qué falla:** el PUT sobrescribe todos los campos. Si alguien abre el modal y mientras tanto otra persona mueve la tarjeta por drag & drop, al guardar se pisa el estado (y se registra un "cambio" falso en el historial). Además, `checklist.clear()` en `:357` borra y recrea las subtareas, ignora `ChecklistIn.id` y cambia los IDs en cada guardado.
- **Solución:**
  - Control optimista: enviar `actualizado_en` o un campo `version` y devolver 409 si no coincide.
  - Hacer un diff de la checklist por `id`.

### A6. Se puede asignar trabajo a usuarios desactivados y restablecer su contraseña
- **Dónde:** `backend/app/routes.py:280-284` (`exigir_usuario` no comprueba `activo`) y `:200-207`.
- **Solución:** añadir la condición `usuario.activo` en `exigir_usuario` y en `recuperar_clave`.

### A7. Puestos de respaldo con IDs inventados
- **Dónde:** `frontend/src/App.jsx:1458-1465`.
- **Por qué falla:** si `/api/puestos` falla (y en `frontend/src/api.js:44` ese error se silencia con `.catch(() => [])`), el formulario muestra IDs del 1 al 6 que **no coinciden** con el seed. Por ejemplo, el id 3 en el seed es "Desarrollador, Analista y Soporte" y aquí aparece como "Especialista Cloud", y el id 6 no existe. Se crean usuarios con el cargo equivocado o se recibe un 400.
- **Solución:** quitar el respaldo hardcodeado. Si no hay puestos, deshabilitar el formulario y mostrar un error.

---

## 🟡 MEDIO

| # | Archivo:línea | Problema | Solución |
|---|---|---|---|
| M1 | `backend/app/seed.py:12-17` + `backend/app/main.py:54-57` | Cada arranque **fuerza** la jornada a 08:30–18:30 con un commit. Cualquier configuración distinta de la jornada se revierte sola. Además, el middleware llama a `inicializar_bd()` en cada petición. | El seed solo debe insertar cuando la BD está vacía. Mover la inicialización a migraciones (Alembic) en vez de `create_all` + middleware. |
| M2 | `backend/app/routes.py:232-251` y `frontend/src/App.jsx:272,347,522,534` | `GET /actividades` no tiene paginación ni filtro por fecha y anida todos los comentarios. Después de cada guardado o borrado, `cargar()` repite las **8** peticiones de inicio. Crece de forma lineal con el uso. | Paginación o rango de fechas. Comentarios bajo demanda (`/actividades/{id}/comentarios`). Tras un guardado, actualizar solo el elemento afectado, como ya se hace en `comentar` y `soltar`. |
| M3 | `backend/app/models.py:47,103-104,136,151` y `backend/app/routes.py:356` | `datetime.now()` sin zona horaria. En Vercel el servidor está en UTC, así que el historial y los comentarios aparecen 5 h desplazados para Perú. `date.today()` en el seed tiene el mismo problema. | Guardar en UTC con zona horaria (`DateTime(timezone=True)`, `datetime.now(timezone.utc)`) y formatear en el cliente. |
| M4 | `backend/app/schemas.py:30-32` | La fecha no tiene rango (se aceptan `0001-01-01` y `9999-12-31`). Las horas no se validan contra la jornada. No se pueden registrar actividades que crucen la medianoche, ni se avisa de ello. | Validar el rango (por ejemplo ±2 años) y, si es una regla de negocio, que el horario esté dentro de la jornada. |
| M5 | `backend/app/routes.py:294,332` | Se aceptan categorías o prioridades **inactivas** y categorías de otra área (no se compara `categoria.area_id`). | Filtrar por `activa` y `area_id`. |
| M6 | `backend/app/schemas.py:75` | `usuario_acceso` no tiene validación de longitud. En Postgres, más de 60 caracteres provoca un `DataError` y un 500. Tampoco se valida `nombre` tras `strip()` (`"  a "` pasa la longitud mínima de 2). | `Field(max_length=60, pattern=...)` y validadores con `strip()`. |
| M7 | `backend/app/auth_utils.py:28-33` | Dice validar el "correo corporativo", pero acepta cualquier dominio. | Si es un requisito, exigir `@amphos21.com`. |
| M8 | `backend/app/routes.py:402-408` | Al borrar una actividad, la cascada elimina **también su historial**. No queda rastro de quién borró qué. | Borrado lógico (`eliminada_en`, `eliminada_por`) o un historial sin FK en cascada. |
| M9 | `frontend/src/App.jsx:840,847-849` vs `:384` | El KPI "Pendientes" cuenta `por_hacer` + `en_espera`, pero al hacer clic filtra solo `por_hacer`. La cifra no coincide con la lista. El resaltado de `:840` compara contra el *primer* estado que encuentre. | Un filtro multiestado o separar las dos tarjetas. |
| M10 | `frontend/src/App.jsx:552-564` | Soltar una tarjeta en su misma columna llama igualmente a la API y a `/historial`. Soltar texto externo que sea un número (por ejemplo "5") mueve la actividad 5. | Comparar el estado actual antes de llamar. Usar un MIME propio (`application/x-actividad`). |
| M11 | `frontend/src/App.jsx:280-282` y `:566-572` | Si la API falla al cargar, la pantalla se queda en el error sin reintento y el login no aparece nunca. Además, `frontend/src/api.js:44` oculta los fallos de `/puestos`. | Botón "Reintentar" y mostrar el error real. |
| M12 | `frontend/src/App.jsx:313-315` | Ni el `setTimeout` de 750 ms ni la pausa de 450 ms se cancelan al desmontar el componente (fuga menor y `setState` sobre un componente desmontado). | Guardar el id del temporizador y limpiarlo en un `useEffect` de limpieza. |
| M13 | `frontend/src/App.jsx:1280-1285` | Un clic en el fondo cierra el modal y descarta los cambios sin confirmación. | Comprobar si el formulario tiene cambios (dirty check) antes de cerrar. |
| M14 | `frontend/src/App.jsx:982-1009` | Los porcentajes del donut se redondean por separado. Pueden sumar 99 o 101, lo que deja huecos o solapamientos. | Calcular el arco con la proporción exacta (`cant/total*100`) y redondear solo la etiqueta. |
| M15 | `frontend/package.json` (`xlsx ^0.18.5`) | La versión de npm está abandonada y tiene CVE-2023-30533 y CVE-2024-22363. Solo afectan a la *lectura* de archivos y la app solo escribe, así que el riesgo es bajo, pero aparecerá en cualquier auditoría. | Migrar a `https://cdn.sheetjs.com/xlsx-0.20.x` o a `exceljs`. |
| M16 | `backend/app/main.py:46-51` | CORS con `allow_methods=["*"]` y `allow_headers=["*"]`. Hoy no es explotable porque no hay credenciales, pero al añadir cookies (C1) habrá que restringirlo. | Lista explícita de métodos y cabeceras, y `allow_credentials` solo con orígenes concretos. |

---

## Casos borde verificados sin problemas

- `minutos()` (`frontend/src/App.jsx:18`) fallaría con `null`, pero el backend siempre devuelve `HH:MM`.
- Si se vacía la fecha de la agenda (`dia=""`), solo se muestra la lista vacía. La exportación muestra un aviso y no falla.
- Las listas vacías (sin categorías o sin usuarios) se manejan con `?.` y `|| []` en el resumen.
- `validar_horario` impide `fin <= inicio` en el backend.
- La exportación a Excel no permite inyección de fórmulas: `aoa_to_sheet` escribe los textos como tipo `s`.

## Orden de corrección recomendado

1. **C1 + C2 + C4:** autenticación con token y autor tomado del servidor.
2. **C3:** cambiar las contraseñas ya.
3. **C5:** confirmar que en Vercel está definido `DATABASE_URL` apuntando a Postgres.
4. **A1–A4:** carreras, doble clic y políticas de contraseña y login.
5. El resto.
