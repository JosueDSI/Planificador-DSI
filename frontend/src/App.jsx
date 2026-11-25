import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { api, clearAuthToken, getAuthToken } from "./api";
import ActividadModal from "./components/ActividadModal";
import { CrearUsuarioModal, RestablecerClaveModal } from "./components/AdminModals";
import Agenda from "./components/Agenda";
import DashboardSkeleton from "./components/DashboardSkeleton";
import Icono from "./components/Icono";
import Login from "./components/Login";
import Resumen from "./components/Resumen";
import Tablero from "./components/Tablero";
import { Avatar, BotonCarga, EstadoVacio, PilaAvisos } from "./components/ui";
import {
  ESTADO_ABIERTAS,
  ESTADO_PENDIENTES,
  FILTROS_VACIOS,
  PERSONA_SIN_ASIGNAR,
  calcularResumen,
  coincideEstado,
  coincidePersona,
  esVencida,
  hoyIso,
  nuevaClave,
  ordenarActividades,
} from "./utils";

const CLAVE_SESION = "planificador_user_session";
const VISTAS = [
  ["resumen", "Resumen", "grid"],
  ["tablero", "Tablero", "columns"],
  ["agenda", "Agenda", "calendar"],
];
const MENSAJE_SIN_CONEXION = "No se pudo conectar con la API. Verifica tu conexión o que el backend esté activo.";

function leerSesion() {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION);
    return guardada ? JSON.parse(guardada) : null;
  } catch {
    return null;
  }
}

function guardarSesion(usuario) {
  try {
    if (usuario) localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* almacenamiento no disponible (modo privado): la sesión vive solo en memoria */
  }
}

export default function App() {
  const [catalogo, setCatalogo] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [carga, setCarga] = useState({ cargando: true, error: "" });
  const [vista, setVista] = useState("resumen");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [dia, setDia] = useState(hoyIso);
  const [usuarioActual, setUsuarioActual] = useState(leerSesion);
  const [mostrarSkeleton, setMostrarSkeleton] = useState(false);
  const [editor, setEditor] = useState(null); // { id: number | null }
  const [modalAdmin, setModalAdmin] = useState(null); // "crear" | "clave" | null
  const [moviendo, setMoviendo] = useState(() => new Set());
  const [avisos, setAvisos] = useState([]);
  const [ahora, setAhora] = useState(() => Date.now());

  const temporizadores = useRef(new Set());
  const actividadesRef = useRef(actividades);
  actividadesRef.current = actividades;

  const programar = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      temporizadores.current.delete(id);
      fn();
    }, ms);
    temporizadores.current.add(id);
  }, []);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  const notificar = useCallback(
    (texto, tipo = "exito") => {
      const id = nuevaClave();
      setAvisos((lista) => [...lista.slice(-3), { id, texto, tipo }]);
      programar(() => setAvisos((lista) => lista.filter((aviso) => aviso.id !== id)), tipo === "error" ? 6500 : 3500);
    },
    [programar]
  );
  const cerrarAviso = useCallback((id) => setAvisos((lista) => lista.filter((aviso) => aviso.id !== id)), []);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!silencioso) setCarga({ cargando: true, error: "" });
      try {
        const datos = await api.inicio();
        setCatalogo(datos);
        setActividades(datos.actividades);
        setHistorial(datos.historial);
        setCarga({ cargando: false, error: "" });
      } catch {
        if (silencioso) notificar("No se pudieron actualizar los datos. Se muestran los últimos disponibles.", "error");
        else setCarga({ cargando: false, error: MENSAJE_SIN_CONEXION });
      }
    },
    [notificar]
  );

  const cerrarSesion = useCallback(() => {
    clearAuthToken();
    setUsuarioActual(null);
    guardarSesion(null);
    setCatalogo(null);
    setActividades([]);
    setHistorial([]);
    setEditor(null);
    setModalAdmin(null);
    setFiltros(FILTROS_VACIOS);
    setVista("resumen");
  }, []);

  // C4: No cargar catálogo ni actividades sin una sesión autenticada con token válido
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setUsuarioActual(null);
      guardarSesion(null);
      setCarga({ cargando: false, error: "" });
      return;
    }
    // Validar sesión contra el servidor (C1 / C4)
    api
      .me()
      .then((usuario) => {
        setUsuarioActual(usuario);
        guardarSesion(usuario);
        cargar();
      })
      .catch(() => {
        cerrarSesion();
        setCarga({ cargando: false, error: "" });
      });
  }, [cargar, cerrarSesion]);

  // Manejador global cuando la API rechaza una petición por token inválido o expirado
  useEffect(() => {
    const alDesautenticar = () => {
      cerrarSesion();
      notificar("Tu sesión ha expirado o no es válida. Por favor inicia sesión.", "error");
    };
    window.addEventListener("dsi:unauthorized", alDesautenticar);
    return () => window.removeEventListener("dsi:unauthorized", alDesautenticar);
  }, [cerrarSesion, notificar]);

  // Reloj de la interfaz: "Vencida" se recalcula cada minuto aunque nadie interactúe.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // La sesión guardada en el navegador se contrasta con la lista real de usuarios activos.
  useEffect(() => {
    if (!catalogo || !usuarioActual) return;
    const vigente = catalogo.usuarios.find((usuario) => usuario.id === usuarioActual.id);
    if (!vigente) {
      cerrarSesion();
      notificar("Tu sesión ya no es válida. Vuelve a iniciar sesión.", "error");
      return;
    }
    if (JSON.stringify(vigente) !== JSON.stringify(usuarioActual)) {
      setUsuarioActual(vigente);
      guardarSesion(vigente);
    }
  }, [catalogo, usuarioActual, cerrarSesion, notificar]);

  const iniciarSesion = useCallback(
    (usuario) => {
      setUsuarioActual(usuario);
      guardarSesion(usuario);
      setMostrarSkeleton(true);
      programar(() => setMostrarSkeleton(false), 750);
      cargar({ silencioso: Boolean(catalogo) });
    },
    [cargar, catalogo, programar]
  );

  // ---------- Filtrado y métricas (memoizados) ----------
  const busqueda = useDeferredValue(filtros.q);
  const filtrosActivos = useMemo(
    () => ({ categoria: filtros.categoria, prioridad: filtros.prioridad, persona: filtros.persona, estado: filtros.estado }),
    [filtros.categoria, filtros.prioridad, filtros.persona, filtros.estado]
  );
  const hayFiltros = Boolean(filtros.q.trim()) || Object.values(filtrosActivos).some(Boolean);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return actividades.filter((actividad) => {
      if (q) {
        const texto = `${actividad.clave} ${actividad.titulo || ""} ${actividad.descripcion || ""} ${actividad.observaciones || ""}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return (
        (!filtrosActivos.categoria || actividad.categoria?.id === Number(filtrosActivos.categoria)) &&
        (!filtrosActivos.prioridad || actividad.prioridad?.id === Number(filtrosActivos.prioridad)) &&
        coincidePersona(actividad, filtrosActivos.persona) &&
        coincideEstado(actividad, filtrosActivos.estado)
      );
    });
  }, [actividades, busqueda, filtrosActivos]);

  const vencidaIds = useMemo(() => new Set(actividades.filter((a) => esVencida(a, ahora)).map((a) => a.id)), [actividades, ahora]);
  const stats = useMemo(() => calcularResumen(visibles, catalogo, vencidaIds), [visibles, catalogo, vencidaIds]);

  const cambiarFiltros = useCallback((cambios) => setFiltros((previo) => ({ ...previo, ...cambios })), []);
  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_VACIOS), []);

  // ---------- Acciones sobre actividades ----------
  const abrirActividad = useCallback((actividad) => setEditor({ id: actividad.id }), []);
  const abrirNueva = useCallback(() => setEditor({ id: null }), []);
  const cerrarEditor = useCallback(() => setEditor(null), []);
  const refrescarHistorial = useCallback(() => api.historial().then(setHistorial).catch(() => {}), []);

  const alGuardar = useCallback(
    (actividad, esNueva) => {
      setActividades((lista) => ordenarActividades(esNueva ? [...lista, actividad] : lista.map((a) => (a.id === actividad.id ? actividad : a))));
      setEditor(null);
      refrescarHistorial();
      const oculta = hayFiltros ? " (puede quedar oculta por los filtros activos)" : "";
      notificar(esNueva ? `Actividad ${actividad.clave} creada${oculta}` : `Cambios guardados en ${actividad.clave}`);
    },
    [hayFiltros, notificar, refrescarHistorial]
  );

  const alEliminar = useCallback(
    (actividad) => {
      setActividades((lista) => lista.filter((a) => a.id !== actividad.id));
      setEditor(null);
      refrescarHistorial();
      notificar(`Actividad ${actividad.clave} eliminada`);
    },
    [notificar, refrescarHistorial]
  );

  const alActualizar = useCallback((actividad) => setActividades((lista) => lista.map((a) => (a.id === actividad.id ? actividad : a))), []);

  // Movimiento optimista con reversión si la API falla.
  const moverActividad = useCallback(
    async (id, estadoId) => {
      const previa = actividadesRef.current.find((a) => a.id === id);
      const estado = catalogo?.estados.find((e) => e.id === estadoId);
      if (!previa || !estado || previa.estado.id === estadoId) return;

      setActividades((lista) => lista.map((a) => (a.id === id ? { ...a, estado: { ...estado } } : a)));
      setMoviendo((actual) => new Set(actual).add(id));
      try {
        const actualizada = await api.mover(id, estadoId, usuarioActual?.id ?? null);
        setActividades((lista) => lista.map((a) => (a.id === actualizada.id ? actualizada : a)));
        refrescarHistorial();
        notificar(`${actualizada.clave} movida a «${estado.nombre}»`);
      } catch (err) {
        setActividades((lista) => lista.map((a) => (a.id === id ? previa : a)));
        notificar(`No se pudo mover ${previa.clave}: ${err.message}`, "error");
      } finally {
        setMoviendo((actual) => {
          const siguiente = new Set(actual);
          siguiente.delete(id);
          return siguiente;
        });
      }
    },
    [catalogo, notificar, refrescarHistorial, usuarioActual]
  );

  // ---------- Pantallas previas al tablero ----------
  if (!usuarioActual) {
    return (
      <>
        <Login onLogin={iniciarSesion} avisoConexion={carga.error} onReintentarConexion={() => cargar()} />
        <PilaAvisos avisos={avisos} onCerrar={cerrarAviso} />
      </>
    );
  }

  if (mostrarSkeleton || (!catalogo && carga.cargando)) {
    return <DashboardSkeleton />;
  }

  if (!catalogo) {
    return (
      <main className="container py-5" style={{ maxWidth: 520 }}>
        <div className="surface p-4 p-md-5 text-center">
          <span className="estado-vacio-icono text-warning mb-3">
            <Icono nombre="alert" tam={28} />
          </span>
          <h1 className="h5 fw-bold">No pudimos cargar el planificador</h1>
          <p className="text-secondary small" role="alert">
            {carga.error}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <BotonCarga className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => cargar()}>
              <Icono nombre="refresh" /> Reintentar
            </BotonCarga>
            <button type="button" className="btn btn-light btn-sm" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>
    );
  }

  const actividadEditada = editor?.id != null ? actividades.find((a) => a.id === editor.id) : null;
  const editorVisible = editor && (editor.id == null || actividadEditada);
  const totalDia = visibles.filter((a) => a.fecha === dia).length;

  return (
    <>
      <a href="#contenido" className="visually-hidden-focusable salto-contenido">
        Saltar al contenido
      </a>

      <header className="app-header">
        <div className="app-contenedor d-flex justify-content-between align-items-center gap-2 gap-md-3 py-2">
          <div className="d-flex align-items-center gap-2 gap-md-3 min-w-0">
            <img src="/static/amphos21-logo.png" alt="Amphos 21" className="app-logo" />
            <div className="border-start ps-2 ps-md-3 min-w-0">
              <div className="d-flex align-items-center gap-2">
                <h1 className="h6 mb-0 fw-bold text-dark text-truncate app-nombre">Planificador DSI</h1>
                {usuarioActual.es_admin && <span className="badge-admin d-none d-sm-inline-block">Admin</span>}
              </div>
              <p className="mb-0 text-secondary text-truncate d-none d-sm-block app-subtitulo">{catalogo.area.nombre}</p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {usuarioActual.es_admin && (
              <div className="btn-group btn-group-sm" role="group" aria-label="Administración">
                <button
                  type="button"
                  className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={() => setModalAdmin("crear")}
                  aria-label="Nuevo usuario"
                  title="Nuevo usuario"
                >
                  <Icono nombre="userPlus" />
                  <span className="d-none d-lg-inline">Nuevo usuario</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={() => setModalAdmin("clave")}
                  aria-label="Restablecer contraseña"
                  title="Restablecer contraseña"
                >
                  <Icono nombre="key" />
                  <span className="d-none d-lg-inline">Restablecer clave</span>
                </button>
              </div>
            )}
            <div className="usuario-chip d-none d-sm-flex" title={`${usuarioActual.nombre} · ${usuarioActual.email || usuarioActual.usuario_acceso}`}>
              <Avatar nombre={usuarioActual.nombre} />
              <div className="d-none d-md-block min-w-0">
                <div className="small fw-semibold text-truncate">{usuarioActual.nombre}</div>
                <div className="usuario-email text-truncate">{usuarioActual.email || usuarioActual.usuario_acceso}</div>
              </div>
            </div>
            <button type="button" className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" onClick={cerrarSesion} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icono nombre="logout" />
              <span className="d-none d-sm-inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className="app-contenedor py-3 py-md-4 fade-in-content" tabIndex={-1}>
        <section className="surface p-3 mb-3" aria-label="Filtros de actividades">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-lg">
              <label htmlFor="f-busqueda" className="visually-hidden">
                Buscar actividad
              </label>
              <div className="campo-busqueda">
                <Icono nombre="search" className="campo-busqueda-icono" />
                <input
                  id="f-busqueda"
                  type="search"
                  className="form-control"
                  placeholder="Buscar por clave, título, descripción…"
                  value={filtros.q}
                  onChange={(evento) => cambiarFiltros({ q: evento.target.value })}
                />
              </div>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="f-categoria" className="visually-hidden">
                Categoría
              </label>
              <select id="f-categoria" className={`form-select ${filtros.categoria ? "filtro-activo" : ""}`} value={filtros.categoria} onChange={(e) => cambiarFiltros({ categoria: e.target.value })}>
                <option value="">Todas las categorías</option>
                {catalogo.categorias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="f-prioridad" className="visually-hidden">
                Prioridad
              </label>
              <select id="f-prioridad" className={`form-select ${filtros.prioridad ? "filtro-activo" : ""}`} value={filtros.prioridad} onChange={(e) => cambiarFiltros({ prioridad: e.target.value })}>
                <option value="">Todas las prioridades</option>
                {catalogo.prioridades.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="f-persona" className="visually-hidden">
                Responsable
              </label>
              <select id="f-persona" className={`form-select ${filtros.persona ? "filtro-activo" : ""}`} value={filtros.persona} onChange={(e) => cambiarFiltros({ persona: e.target.value })}>
                <option value="">Todos los responsables</option>
                <option value={PERSONA_SIN_ASIGNAR}>Sin asignar</option>
                {catalogo.usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="f-estado" className="visually-hidden">
                Estado
              </label>
              <select id="f-estado" className={`form-select ${filtros.estado ? "filtro-activo" : ""}`} value={filtros.estado} onChange={(e) => cambiarFiltros({ estado: e.target.value })}>
                <option value="">Todos los estados</option>
                <option value={ESTADO_PENDIENTES}>Pendientes (por hacer + espera)</option>
                <option value={ESTADO_ABIERTAS}>Abiertas (sin completar)</option>
                {catalogo.estados.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
            <span className="small text-secondary d-inline-flex align-items-center gap-1" aria-live="polite">
              {hayFiltros && <Icono nombre="filter" tam={13} />}
              {hayFiltros ? `Mostrando ${visibles.length} de ${actividades.length} actividades` : `${actividades.length} actividades en total`}
            </span>
            <div className="d-flex gap-2">
              {hayFiltros && (
                <button className="btn btn-link btn-sm text-decoration-none" type="button" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              )}
              <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 px-3" type="button" onClick={abrirNueva}>
                <Icono nombre="plus" /> Nueva actividad
              </button>
            </div>
          </div>
        </section>

        <nav className="mb-3" aria-label="Vistas">
          <ul className="nav nav-pills gap-1 vistas">
            {VISTAS.map(([id, nombre, icono]) => (
              <li className="nav-item" key={id}>
                <button
                  type="button"
                  className={`nav-link d-inline-flex align-items-center gap-2 ${vista === id ? "active" : ""}`}
                  aria-current={vista === id ? "page" : undefined}
                  onClick={() => setVista(id)}
                >
                  <Icono nombre={icono} />
                  {nombre}
                  {id === "agenda" && totalDia > 0 && <span className="badge rounded-pill contador-vista">{totalDia}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {actividades.length === 0 ? (
          <div className="surface p-4">
            <EstadoVacio icono="calendar" titulo="Aún no hay actividades registradas" texto="Crea la primera actividad del área para empezar a planificar.">
              <button type="button" className="btn btn-primary btn-sm mt-2 d-inline-flex align-items-center gap-1" onClick={abrirNueva}>
                <Icono nombre="plus" /> Nueva actividad
              </button>
            </EstadoVacio>
          </div>
        ) : (
          <>
            {hayFiltros && visibles.length === 0 && (
              <div className="alert alert-light border d-flex flex-wrap align-items-center gap-2 py-2 small" role="status">
                <Icono nombre="search" />
                <span className="me-auto">Ninguna actividad coincide con la búsqueda o los filtros actuales.</span>
                <button type="button" className="btn btn-outline-secondary btn-sm py-0" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              </div>
            )}

            {vista === "resumen" && (
              <Resumen
                stats={stats}
                filtros={filtrosActivos}
                hayFiltros={hayFiltros}
                catalogo={catalogo}
                historial={historial}
                vencidaIds={vencidaIds}
                cambiarFiltros={cambiarFiltros}
                limpiarFiltros={limpiarFiltros}
                onAbrir={abrirActividad}
              />
            )}

            {vista === "tablero" && (
              <Tablero estados={catalogo.estados} visibles={visibles} vencidaIds={vencidaIds} moviendo={moviendo} onAbrir={abrirActividad} onMover={moverActividad} />
            )}

            {vista === "agenda" && (
              <Agenda
                dia={dia}
                onCambiarDia={setDia}
                visibles={visibles}
                vencidaIds={vencidaIds}
                catalogo={catalogo}
                usuarioActual={usuarioActual}
                hayFiltros={hayFiltros}
                onAbrir={abrirActividad}
                onNueva={abrirNueva}
                notificar={notificar}
              />
            )}
          </>
        )}
      </main>

      {editorVisible && (
        <ActividadModal
          key={editor.id ?? "nueva"}
          actividad={actividadEditada}
          catalogo={catalogo}
          usuarioActual={usuarioActual}
          actividades={actividades}
          onCerrar={cerrarEditor}
          onGuardada={alGuardar}
          onEliminada={alEliminar}
          onActualizada={alActualizar}
        />
      )}

      {modalAdmin === "crear" && (
        <CrearUsuarioModal puestos={catalogo.puestos} onCerrar={() => setModalAdmin(null)} onCreado={() => cargar({ silencioso: true })} />
      )}
      {modalAdmin === "clave" && <RestablecerClaveModal usuarios={catalogo.usuarios} onCerrar={() => setModalAdmin(null)} />}

      <PilaAvisos avisos={avisos} onCerrar={cerrarAviso} />
    </>
  );
}
