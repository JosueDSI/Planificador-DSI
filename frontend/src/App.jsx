import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const VISTAS = [
  ["resumen", "Resumen"],
  ["tablero", "Tablero"],
  ["agenda", "Agenda"],
];

const hoyIso = () => {
  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

const minutos = (hora) => {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
};

const vencida = (actividad) => {
  if (actividad.estado.es_cierre) return false;
  return new Date(`${actividad.fecha}T${actividad.hora_fin}`) < new Date();
};

const vacio = {
  titulo: "",
  descripcion: "",
  observaciones: "",
  categoria_id: "",
  prioridad_id: "",
  estado_id: "",
  fecha: hoyIso(),
  hora_inicio: "09:00",
  hora_fin: "10:00",
  reportado_por: "",
  asignado_a: "",
  checklist: [],
};

function aFormulario(actividad, catalogo) {
  if (!actividad) {
    return {
      ...vacio,
      fecha: hoyIso(),
      categoria_id: catalogo.categorias[0]?.id ?? "",
      prioridad_id: catalogo.prioridades.find((item) => item.nombre === "Media")?.id ?? catalogo.prioridades[0]?.id ?? "",
      estado_id: catalogo.estados[0]?.id ?? "",
      reportado_por: catalogo.usuarioActual?.id || catalogo.usuarios[0]?.id || "",
    };
  }
  return {
    titulo: actividad.titulo,
    descripcion: actividad.descripcion,
    observaciones: actividad.observaciones,
    categoria_id: actividad.categoria.id,
    prioridad_id: actividad.prioridad.id,
    estado_id: actividad.estado.id,
    fecha: actividad.fecha,
    hora_inicio: actividad.hora_inicio,
    hora_fin: actividad.hora_fin,
    reportado_por: actividad.reportado_por.id,
    asignado_a: actividad.asignado_a?.id ?? "",
    checklist: actividad.checklist.map((item) => ({ ...item })),
  };
}

function aPayload(form) {
  return {
    ...form,
    categoria_id: Number(form.categoria_id),
    prioridad_id: Number(form.prioridad_id),
    estado_id: Number(form.estado_id),
    reportado_por: Number(form.reportado_por),
    asignado_a: form.asignado_a ? Number(form.asignado_a) : null,
    checklist: form.checklist
      .map((item, indice) => ({ ...item, texto: item.texto.trim(), orden: indice + 1 }))
      .filter((item) => item.texto),
  };
}

function Tarjeta({ actividad, onAbrir }) {
  const hechas = actividad.checklist.filter((item) => item.hecho).length;
  return (
    <button
      type="button"
      className={`card tarjeta w-100 mb-2 text-start ${vencida(actividad) ? "vencida" : ""}`}
      style={{ borderLeftColor: actividad.categoria.color }}
      draggable
      onDragStart={(evento) => evento.dataTransfer.setData("text/plain", String(actividad.id))}
      onClick={onAbrir}
    >
      <div className="card-body p-2">
        <div className="d-flex justify-content-between gap-2">
          <strong className="small">{actividad.titulo}</strong>
          <span className={`badge ${actividad.prioridad.nombre === "Alta" ? "text-bg-danger" : actividad.prioridad.nombre === "Media" ? "text-bg-warning" : "text-bg-secondary"}`}>
            {actividad.prioridad.nombre}
          </span>
        </div>
        <div className="text-secondary small mt-1">
          {actividad.clave} · {actividad.asignado_a?.nombre || "Sin responsable"}
        </div>
        <div className="text-secondary small hora">
          {actividad.fecha} · {actividad.hora_inicio}–{actividad.hora_fin}
          {actividad.checklist.length ? ` · ${hechas}/${actividad.checklist.length}` : ""}
          {vencida(actividad) ? " · Vencida" : ""}
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [catalogo, setCatalogo] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [vista, setVista] = useState("resumen");
  const [filtros, setFiltros] = useState({ q: "", categoria: "", prioridad: "", persona: "", estado: "" });
  const [dia, setDia] = useState(hoyIso);

  // Sesión y Auth
  const [usuarioActual, setUsuarioActual] = useState(() => {
    try {
      const u = localStorage.getItem("planificador_user_session");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [formLogin, setFormLogin] = useState({ identificador: "", clave: "" });
  const [errorLogin, setErrorLogin] = useState("");
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [verClaveLogin, setVerClaveLogin] = useState(false);
  const [verClaveNuevo, setVerClaveNuevo] = useState(false);
  const [verClaveRecuperar, setVerClaveRecuperar] = useState(false);

  // Modal Crear Usuario (Admin)
  const [mostrarCrearUsuario, setMostrarCrearUsuario] = useState(false);
  const [nuevoUser, setNuevoUser] = useState({ nombre: "", usuario_acceso: "", email: "", clave: "", es_admin: false });
  const [avisoAdmin, setAvisoAdmin] = useState("");
  const [exitoAdmin, setExitoAdmin] = useState("");

  // Modal Recuperar Clave (Admin)
  const [mostrarRecuperarClave, setMostrarRecuperarClave] = useState(false);
  const [recuperarUser, setRecuperarUser] = useState({ usuario_id: "", nueva_clave: "" });

  const [form, setForm] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargar() {
    const datos = await api.inicio();
    setCatalogo(datos);
    setActividades(datos.actividades);
    setHistorial(datos.historial);
    setError("");

    // Si no hay usuario en sesión, sugerir admin o el primer usuario
    if (!usuarioActual && datos.usuarios.length) {
      const admin = datos.usuarios.find((u) => u.es_admin) || datos.usuarios[0];
      setUsuarioActual(admin);
      localStorage.setItem("planificador_user_session", JSON.stringify(admin));
    }
  }

  useEffect(() => {
    cargar().catch(() => setError("No se pudo conectar con la API. Verifica que el backend esté activo."));
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setErrorLogin("");
    setCargandoLogin(true);
    try {
      const res = await api.login(formLogin.identificador, formLogin.clave);
      setUsuarioActual(res.usuario);
      localStorage.setItem("planificador_user_session", JSON.stringify(res.usuario));
      setFormLogin({ identificador: "", clave: "" });
    } catch (err) {
      setErrorLogin(err.message);
    } finally {
      setCargandoLogin(false);
    }
  }

  function handleLogout() {
    setUsuarioActual(null);
    localStorage.removeItem("planificador_user_session");
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setAvisoAdmin("");
    setExitoAdmin("");
    try {
      await api.crearUsuario(nuevoUser);
      setExitoAdmin("Usuario corporativo creado exitosamente");
      setNuevoUser({ nombre: "", usuario_acceso: "", email: "", clave: "", es_admin: false });
      await cargar();
    } catch (err) {
      setAvisoAdmin(err.message);
    }
  }

  async function handleRecuperarClave(e) {
    e.preventDefault();
    setAvisoAdmin("");
    setExitoAdmin("");
    try {
      const res = await api.recuperarClave(Number(recuperarUser.usuario_id), recuperarUser.nueva_clave);
      setExitoAdmin(res.mensaje || "Contraseña restablecida con éxito");
      setRecuperarUser({ usuario_id: "", nueva_clave: "" });
    } catch (err) {
      setAvisoAdmin(err.message);
    }
  }

  const visibles = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return actividades.filter((actividad) => {
      const texto = `${actividad.titulo || ""} ${actividad.descripcion || ""} ${actividad.observaciones || ""}`.toLowerCase();
      return (
        (!q || texto.includes(q)) &&
        (!filtros.categoria || actividad.categoria?.id === Number(filtros.categoria)) &&
        (!filtros.prioridad || actividad.prioridad?.id === Number(filtros.prioridad)) &&
        (!filtros.persona || actividad.asignado_a?.id === Number(filtros.persona)) &&
        (!filtros.estado || actividad.estado?.id === Number(filtros.estado))
      );
    });
  }, [actividades, filtros]);

  const resumen = useMemo(() => {
    const total = visibles.length;
    const cerradas = visibles.filter((item) => item.estado.es_cierre).length;
    const progreso = visibles.filter((item) => item.estado.columna === "en_progreso").length;
    const pendientes = visibles.filter((item) => item.estado.columna === "por_hacer" || item.estado.columna === "en_espera").length;
    const prioritarias = visibles.filter((item) => item.prioridad.nombre === "Alta" && !item.estado.es_cierre).length;
    const vencidasCount = visibles.filter((item) => vencida(item)).length;
    const cumplimiento = total ? Math.round((cerradas * 100) / total) : 0;

    // Métricas por categoría
    const porCategoria = (catalogo?.categorias || []).map((cat) => {
      const cant = visibles.filter((a) => a.categoria.id === cat.id).length;
      return { ...cat, cantidad: cant, porcentaje: total ? Math.round((cant * 100) / total) : 0 };
    }).filter((c) => c.cantidad > 0);

    // Métricas por estado para gráfica circular / donut
    const porEstado = (catalogo?.estados || []).map((est) => {
      const cant = visibles.filter((a) => a.estado.id === est.id).length;
      return {
        ...est,
        cantidad: cant,
        porcentaje: total ? Math.round((cant * 100) / total) : 0,
        color:
          est.columna === "completado"
            ? "#10b981"
            : est.columna === "en_progreso"
            ? "#3b82f6"
            : est.columna === "en_espera"
            ? "#f59e0b"
            : "#64748b",
      };
    });

    return { total, cerradas, progreso, pendientes, prioritarias, vencidasCount, cumplimiento, porCategoria, porEstado };
  }, [visibles, catalogo]);

  function exportarAgendaDia() {
    const actividadesDia = visibles.filter((item) => item.fecha === dia);
    if (actividadesDia.length === 0) {
      alert("No hay actividades registradas en la fecha " + dia + " para exportar.");
      return;
    }

    const encabezados = ["Clave", "Título", "Fecha", "Hora Inicio", "Hora Fin", "Categoría", "Prioridad", "Estado", "Responsable", "Solicitante", "Subtareas Hechas", "Total Subtareas", "Observaciones"];
    const filas = actividadesDia.map((act) => [
      `"${act.clave}"`,
      `"${(act.titulo || "").replace(/"/g, '""')}"`,
      `"${act.fecha}"`,
      `"${act.hora_inicio}"`,
      `"${act.hora_fin}"`,
      `"${act.categoria.nombre}"`,
      `"${act.prioridad.nombre}"`,
      `"${act.estado.nombre}"`,
      `"${(act.asignado_a?.nombre || "Sin asignar").replace(/"/g, '""')}"`,
      `"${(act.reportado_por?.nombre || "").replace(/"/g, '""')}"`,
      act.checklist.filter((c) => c.hecho).length,
      act.checklist.length,
      `"${(act.observaciones || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [encabezados.join(";"), ...filas.map((f) => f.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `planificador_dsi_agenda_${dia}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function abrirNueva() {
    setEditandoId(null);
    setNota("");
    setAviso("");
    setForm(aFormulario(null, { ...catalogo, usuarioActual }));
  }

  function abrir(actividad) {
    setEditandoId(actividad.id);
    setNota("");
    setAviso("");
    setForm(aFormulario(actividad, catalogo));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setAviso("");
    try {
      const payload = aPayload(form);
      if (editandoId) await api.guardar(editandoId, payload);
      else await api.crear(payload);
      setForm(null);
      await cargar();
    } catch (err) {
      setAviso(err.message);
    }
  }

  async function eliminar() {
    if (!editandoId || !window.confirm("¿Eliminar esta actividad?")) return;
    setAviso("");
    try {
      await api.eliminar(editandoId);
      setForm(null);
      await cargar();
    } catch (err) {
      setAviso(err.message);
    }
  }

  async function comentar() {
    if (!nota.trim() || !usuarioActual) return;
    setAviso("");
    try {
      const actualizada = await api.comentar(editandoId, usuarioActual.id, nota.trim());
      setActividades((lista) => lista.map((item) => (item.id === actualizada.id ? actualizada : item)));
      setNota("");
    } catch (err) {
      setAviso(err.message);
    }
  }

  async function soltar(evento, estadoId) {
    evento.preventDefault();
    const id = Number(evento.dataTransfer.getData("text/plain"));
    if (!id) return;
    try {
      const actualizada = await api.mover(id, estadoId, usuarioActual ? usuarioActual.id : null);
      setActividades((lista) => lista.map((item) => (item.id === actualizada.id ? actualizada : item)));
      setHistorial(await api.historial());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!catalogo) {
    return (
      <main className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h1 className="h3 fw-bold mb-2">Planificador DSI</h1>
        <p className="text-secondary">{error || "Cargando actividades..."}</p>
      </main>
    );
  }

  // Pantalla de Login minimalista si no hay sesión
  if (!usuarioActual) {
    return (
      <main className="container d-flex align-items-center justify-content-center" style={{ minHeight: "85vh" }}>
        <div className="card card-body shadow-sm border-0 p-4" style={{ maxWidth: 400, width: "100%", borderRadius: 16 }}>
          <div className="text-center mb-4">
            <h1 className="h4 fw-bold mb-1">Planificador DSI</h1>
            <p className="text-secondary small mb-0">Acceso corporativo del departamento</p>
          </div>
          {errorLogin && <div className="alert alert-danger py-2 small">{errorLogin}</div>}
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Correo corporativo o usuario</label>
              <input
                className="form-control"
                required
                placeholder="usuario@amphos21.com"
                value={formLogin.identificador}
                onChange={(e) => setFormLogin({ ...formLogin, identificador: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Contraseña</label>
              <div className="input-group">
                <input
                  type={verClaveLogin ? "text" : "password"}
                  className="form-control"
                  required
                  placeholder="••••••••"
                  value={formLogin.clave}
                  onChange={(e) => setFormLogin({ ...formLogin, clave: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setVerClaveLogin(!verClaveLogin)}
                  title={verClaveLogin ? "Ocultar contraseña" : "Ver contraseña"}
                  tabIndex="-1"
                >
                  {verClaveLogin ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <button className="btn btn-primary w-100 py-2" type="submit" disabled={cargandoLogin}>
              {cargandoLogin ? "Verificando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const delDia = visibles.filter((item) => item.fecha === dia);
  const ocupado = delDia
    .filter((item) => !item.estado.es_cierre)
    .reduce((total, item) => total + Math.max(0, minutos(item.hora_fin) - minutos(item.hora_inicio)), 0);
  const jornada = minutos(catalogo.area.jornada_fin) - minutos(catalogo.area.jornada_inicio);
  const libre = Math.max(0, jornada - ocupado);
  const editando = actividades.find((item) => item.id === editandoId);

  return (
    <main className="container-fluid py-4" style={{ maxWidth: 1180 }}>
      {/* Barra superior Minimalista con Auth */}
      <header className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h4 mb-0 fw-bold">Planificador DSI</h1>
            {usuarioActual.es_admin && <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Admin</span>}
          </div>
          <p className="mb-0 text-secondary small">{catalogo.area.nombre}</p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {usuarioActual.es_admin && (
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setAvisoAdmin("");
                  setExitoAdmin("");
                  setMostrarCrearUsuario(true);
                }}
              >
                + Nuevo usuario
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setAvisoAdmin("");
                  setExitoAdmin("");
                  setMostrarRecuperarClave(true);
                }}
              >
                Recuperar clave
              </button>
            </div>
          )}

          <div className="dropdown">
            <div className="d-flex align-items-center gap-2 ps-2 border-start">
              <div className="text-end">
                <div className="small fw-semibold">{usuarioActual.nombre}</div>
                <div className="text-secondary" style={{ fontSize: "0.72rem" }}>{usuarioActual.email || usuarioActual.usuario_acceso}</div>
              </div>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout} title="Cerrar sesión">
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="alert alert-warning py-2 small">{error}</div>}

      <div className="card card-body mb-3 border-0 shadow-sm" style={{ background: "#ffffff" }}>
        <div className="row g-2 align-items-center">
          <div className="col-md">
            <input className="form-control" placeholder="Buscar actividad..." value={filtros.q} onChange={(evento) => setFiltros({ ...filtros, q: evento.target.value })} />
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.categoria} onChange={(evento) => setFiltros({ ...filtros, categoria: evento.target.value })}>
              <option value="">Categoría</option>
              {catalogo.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.prioridad} onChange={(evento) => setFiltros({ ...filtros, prioridad: evento.target.value })}>
              <option value="">Prioridad</option>
              {catalogo.prioridades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.persona} onChange={(evento) => setFiltros({ ...filtros, persona: evento.target.value })}>
              <option value="">Responsable</option>
              {catalogo.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.estado} onChange={(evento) => setFiltros({ ...filtros, estado: evento.target.value })}>
              <option value="">Estado</option>
              {catalogo.estados.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
          <div className="col-md-auto d-flex gap-2">
            {(filtros.q || filtros.categoria || filtros.prioridad || filtros.persona || filtros.estado) && (
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                onClick={() => setFiltros({ q: "", categoria: "", prioridad: "", persona: "", estado: "" })}
                title="Limpiar todos los filtros"
              >
                Limpiar
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={abrirNueva}>
              + Nueva actividad
            </button>
          </div>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        {VISTAS.map(([id, nombre]) => (
          <li className="nav-item" key={id}>
            <button type="button" className={`nav-link ${vista === id ? "active" : ""}`} onClick={() => setVista(id)}>{nombre}</button>
          </li>
        ))}
      </ul>

      {vista === "resumen" && (
        <>
          {/* Tarjetas KPI Superiores: Grid ajustado sin desbordes, con colores sólidos contrastados y clicables */}
          <div className="row g-2 g-xl-3 mb-4">
            <div className="col-6 col-md-4 col-xl-2">
              <div
                className={`card card-body text-start border shadow-sm h-100 p-2 p-xl-3 ${!filtros.estado && !filtros.prioridad ? "ring-active" : ""}`}
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #2563eb !important",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => setFiltros({ ...filtros, categoria: "", prioridad: "", persona: "", estado: "" })}
                title="Clic para ver todas las actividades"
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>TOTAL</span>
                  <span className="badge" style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: "0.68rem" }}>Área</span>
                </div>
                <strong className="fs-2 text-dark my-1" style={{ color: "#1e3a8a !important" }}>{resumen.total}</strong>
                <span className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>Todas las tareas</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div
                className={`card card-body text-start border shadow-sm h-100 p-2 p-xl-3 ${filtros.estado === String(catalogo.estados.find(e => e.columna === "por_hacer" || e.columna === "en_espera")?.id || "") ? "border-warning" : ""}`}
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #d97706 !important",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  const estadoObj = catalogo.estados.find((e) => e.columna === "por_hacer");
                  setFiltros({ ...filtros, estado: estadoObj ? String(estadoObj.id) : "", prioridad: "" });
                }}
                title="Clic para filtrar actividades pendientes"
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>PENDIENTES</span>
                  <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontSize: "0.68rem" }}>Inicio/Espera</span>
                </div>
                <strong className="fs-2 my-1" style={{ color: "#b45309" }}>{resumen.pendientes}</strong>
                <span className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>Por iniciar o espera</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div
                className="card card-body text-start border shadow-sm h-100 p-2 p-xl-3"
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #0284c7 !important",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  const estadoObj = catalogo.estados.find((e) => e.columna === "en_progreso");
                  setFiltros({ ...filtros, estado: estadoObj ? String(estadoObj.id) : "", prioridad: "" });
                }}
                title="Clic para filtrar actividades en progreso"
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>EN PROGRESO</span>
                  <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "0.68rem" }}>En curso</span>
                </div>
                <strong className="fs-2 my-1" style={{ color: "#0369a1" }}>{resumen.progreso}</strong>
                <span className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>En ejecución</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div
                className="card card-body text-start border shadow-sm h-100 p-2 p-xl-3"
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #059669 !important",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  const estadoObj = catalogo.estados.find((e) => e.es_cierre);
                  setFiltros({ ...filtros, estado: estadoObj ? String(estadoObj.id) : "", prioridad: "" });
                }}
                title="Clic para filtrar actividades completadas"
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>COMPLETADAS</span>
                  <span className="badge" style={{ background: "#d1fae5", color: "#047857", fontSize: "0.68rem" }}>Listas</span>
                </div>
                <strong className="fs-2 my-1" style={{ color: "#047857" }}>{resumen.cerradas}</strong>
                <span className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>Finalizadas</span>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div
                className="card card-body text-start border shadow-sm h-100 p-2 p-xl-3"
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #7c3aed !important",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>CUMPLIMIENTO</span>
                  <span className="badge" style={{ background: "#ede9fe", color: "#6d28d9", fontSize: "0.68rem" }}>Global</span>
                </div>
                <strong className="fs-2 my-1" style={{ color: "#6d28d9" }}>{resumen.cumplimiento}%</strong>
                <div className="progress mt-1" style={{ height: 6, background: "#f3e8ff" }}>
                  <div className="progress-bar" style={{ width: `${resumen.cumplimiento}%`, background: "#7c3aed" }}></div>
                </div>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div
                className="card card-body text-start border shadow-sm h-100 p-2 p-xl-3"
                style={{
                  background: "#ffffff",
                  borderLeft: "5px solid #e11d48 !important",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  const alta = catalogo.prioridades.find((p) => p.nombre === "Alta");
                  setFiltros({ ...filtros, prioridad: alta ? String(alta.id) : "", estado: "" });
                }}
                title="Clic para filtrar actividades de prioridad Alta"
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small fw-bold text-secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>PRIORITARIAS</span>
                  <span className="badge" style={{ background: "#ffe4e6", color: "#be123c", fontSize: "0.68rem" }}>Alta</span>
                </div>
                <strong className="fs-2 my-1" style={{ color: "#be123c" }}>{resumen.prioritarias}</strong>
                <span className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>Requieren atención</span>
              </div>
            </div>
          </div>

          {/* Gráficos Interactivos con Filtros Bidireccionales */}
          <div className="row g-3 mb-4">
            {/* Gráfica Circular / Donut por Estado */}
            <div className="col-lg-6">
              <section className="card card-body border shadow-sm h-100 bg-white d-flex flex-column justify-content-between p-3 p-xl-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h2 className="h6 fw-bold mb-0 text-dark">Distribución por Estado</h2>
                    <span className="text-muted small">Haz clic en un estado para filtrar</span>
                  </div>
                  {filtros.estado && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => setFiltros({ ...filtros, estado: "" })}
                    >
                      Quitar filtro
                    </button>
                  )}
                </div>

                <div className="row align-items-center g-3 my-auto">
                  {/* Gráfico Donut Agrandado y Centrado */}
                  <div className="col-sm-5 d-flex flex-column align-items-center justify-content-center text-center">
                    <div className="position-relative d-inline-block" style={{ width: "175px", height: "175px" }}>
                      <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="4.2" />
                        {(() => {
                          let offset = 0;
                          return (resumen.porEstado || []).map((est) => {
                            const strokeDasharray = `${est.porcentaje} ${100 - est.porcentaje}`;
                            const currentOffset = offset;
                            offset += est.porcentaje;
                            const esSeleccionado = filtros.estado === String(est.id);
                            return (
                              <circle
                                key={est.id}
                                cx="18"
                                cy="18"
                                r="15.915"
                                fill="none"
                                stroke={est.color}
                                strokeWidth={esSeleccionado ? "5.8" : "4.2"}
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={-currentOffset}
                                style={{
                                  cursor: "pointer",
                                  opacity: filtros.estado && !esSeleccionado ? 0.35 : 1,
                                  transition: "all 0.25s ease",
                                }}
                                onClick={() => setFiltros({ ...filtros, estado: esSeleccionado ? "" : String(est.id) })}
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div
                        className="position-absolute top-50 start-50 translate-middle text-center"
                        style={{ pointerEvents: "none" }}
                      >
                        <span className="fs-2 fw-bold d-block text-dark lh-1">{resumen.total}</span>
                        <span className="text-secondary fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "0.04em" }}>TAREAS</span>
                      </div>
                    </div>

                    {/* Resumen rápido debajo del donut */}
                    <div className="d-flex justify-content-center align-items-center gap-3 mt-2 pt-2 border-top w-100" style={{ maxWidth: 200 }}>
                      <div className="text-center">
                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>EN FLUJO</div>
                        <div className="fw-bold text-dark small">{resumen.progreso + resumen.pendientes}</div>
                      </div>
                      <div className="border-start" style={{ height: 22 }}></div>
                      <div className="text-center">
                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>RESUELTAS</div>
                        <div className="fw-bold text-success small">{resumen.cerradas}</div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Estados con Barras de Progreso */}
                  <div className="col-sm-7">
                    <div className="d-flex flex-column gap-2 justify-content-center">
                      {(resumen.porEstado || []).map((est) => {
                        const activo = filtros.estado === String(est.id);
                        return (
                          <div
                            key={est.id}
                            className={`p-2 rounded border ${activo ? "bg-light border-primary shadow-sm" : "bg-white"}`}
                            style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                            onClick={() => setFiltros({ ...filtros, estado: activo ? "" : String(est.id) })}
                            title={`Clic para filtrar por ${est.nombre}`}
                          >
                            <div className="d-flex justify-content-between align-items-center small mb-1">
                              <div className="d-flex align-items-center gap-2">
                                <span style={{ width: 10, height: 10, borderRadius: "50%", background: est.color, flexShrink: 0 }}></span>
                                <span className={`${activo ? "fw-bold text-primary" : "fw-semibold text-dark"}`}>
                                  {est.nombre}
                                </span>
                              </div>
                              <span className={`badge ${activo ? "bg-primary text-white" : "bg-light text-dark border"} fw-bold`} style={{ fontSize: "0.75rem" }}>
                                {est.cantidad} <span className="fw-normal" style={{ opacity: 0.85 }}>({est.porcentaje}%)</span>
                              </span>
                            </div>
                            <div className="progress" style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
                              <div
                                className="progress-bar"
                                style={{
                                  width: `${est.porcentaje}%`,
                                  background: est.color,
                                  borderRadius: 4,
                                  opacity: filtros.estado && !activo ? 0.35 : 1,
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Barras de Actividades por Categoría */}
            <div className="col-lg-6">
              <section className="card card-body border shadow-sm h-100 bg-white d-flex flex-column justify-content-between p-3 p-xl-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h2 className="h6 fw-bold mb-0 text-dark">Actividades por Categoría</h2>
                    <span className="text-muted small">Haz clic para filtrar</span>
                  </div>
                  {filtros.categoria && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => setFiltros({ ...filtros, categoria: "" })}
                    >
                      Quitar filtro
                    </button>
                  )}
                </div>
                <div className="d-flex flex-column gap-2 justify-content-center my-auto">
                  {(resumen.porCategoria || []).map((cat) => {
                    const activo = filtros.categoria === String(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`p-2 rounded border ${activo ? "bg-light border-primary" : "bg-white"}`}
                        style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                        onClick={() => setFiltros({ ...filtros, categoria: activo ? "" : String(cat.id) })}
                        title={`Clic para filtrar por ${cat.nombre}`}
                      >
                        <div className="d-flex justify-content-between small mb-1">
                          <span className={`${activo ? "fw-bold text-primary" : "fw-semibold text-dark"}`}>{cat.nombre}</span>
                          <span className="text-secondary fw-bold">{cat.cantidad} act. ({cat.porcentaje}%)</span>
                        </div>
                        <div className="progress" style={{ height: 8, background: "#f1f5f9" }}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${cat.porcentaje}%`,
                              background: cat.color,
                              borderRadius: 4,
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* Sección Inferior: Avance por Persona y Panel de Atención */}
          <div className="row g-3">
            <div className="col-lg-7">
              <section className="card card-body border-0 shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h6 fw-bold mb-0">Avance Individual por Persona</h2>
                  <span className="text-secondary small">Cumplimiento asignado</span>
                </div>
                {catalogo.usuarios.map((usuario) => {
                  const propias = visibles.filter((item) => item.asignado_a?.id === usuario.id);
                  const listas = propias.filter((item) => item.estado.es_cierre).length;
                  const porcentaje = propias.length ? Math.round((listas * 100) / propias.length) : 0;
                  return (
                    <div
                      key={usuario.id}
                      className="mb-3 p-2 rounded"
                      style={{ background: "#f8fafc", cursor: "pointer" }}
                      onClick={() => setFiltros({ ...filtros, persona: String(usuario.id) })}
                      title={`Filtrar actividades de ${usuario.nombre}`}
                    >
                      <div className="d-flex justify-content-between small mb-1">
                        <div>
                          <span className="fw-bold text-dark">{usuario.nombre}</span>
                          {usuario.es_admin && <span className="badge bg-danger-subtle text-danger ms-2" style={{ fontSize: "0.65rem" }}>Admin</span>}
                        </div>
                        <span className="text-secondary">
                          <strong>{listas}</strong> de {propias.length} completadas ({porcentaje}%)
                        </span>
                      </div>
                      <div className="progress" style={{ height: 8, background: "#e2e8f0" }}>
                        <div
                          className={`progress-bar ${porcentaje === 100 ? "bg-success" : porcentaje > 50 ? "bg-primary" : "bg-warning"}`}
                          style={{ width: `${porcentaje}%`, borderRadius: 4 }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>

            <div className="col-lg-5">
              <section className="card card-body border-0 shadow-sm mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h6 fw-bold mb-0">Para Revisar / Atención Inmediata</h2>
                  <span className="badge bg-warning-subtle text-dark">
                    {visibles.filter((item) => vencida(item) || item.estado.columna === "en_espera").length}
                  </span>
                </div>
                {visibles.filter((item) => vencida(item) || item.estado.columna === "en_espera").length === 0 && (
                  <p className="text-secondary mb-0 small py-2">No hay actividades vencidas ni en espera en este momento.</p>
                )}
                {visibles
                  .filter((item) => vencida(item) || item.estado.columna === "en_espera")
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="btn btn-link text-start px-0 py-1 d-block text-decoration-none border-bottom"
                      onClick={() => abrir(item)}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-semibold text-dark small text-truncate" style={{ maxWidth: "70%" }}>
                          {item.clave} · {item.titulo}
                        </span>
                        <span className={`badge ${vencida(item) ? "text-bg-danger" : "text-bg-warning"}`}>
                          {vencida(item) ? "Vencida" : item.estado.nombre}
                        </span>
                      </div>
                    </button>
                  ))}
              </section>

              <section className="card card-body border-0 shadow-sm">
                <h2 className="h6 fw-bold mb-2">Movimientos y Auditoría Reciente</h2>
                {historial.length === 0 && <p className="text-secondary mb-0 small">Todavía no hay cambios registrados.</p>}
                {historial.slice(0, 6).map((fila) => (
                  <p key={fila.id} className="small mb-2 pb-1 border-bottom">
                    <strong>{fila.clave}</strong> {fila.campo}: {fila.valor_anterior ? `${fila.valor_anterior} → ` : ""}<span className="text-primary">{fila.valor_nuevo}</span>
                    <span className="text-secondary d-block" style={{ fontSize: "0.72rem" }}>Por {fila.autor || "Sistema"} · {fila.creado_en}</span>
                  </p>
                ))}
              </section>
            </div>
          </div>
        </>
      )}

      {vista === "tablero" && (
        <div className="row g-3 flex-nowrap overflow-auto pb-2">
          {catalogo.estados.map((estado) => {
            const columna = visibles.filter((item) => item.estado.id === estado.id);
            return (
              <div className="col-10 col-md-3" key={estado.id} style={{ minWidth: 280 }}>
                <section
                  className="columna"
                  onDragOver={(evento) => evento.preventDefault()}
                  onDrop={(evento) => soltar(evento, estado.id)}
                >
                  <h2 className="h6 fw-bold mb-3">{estado.nombre} · {columna.length}</h2>
                  {columna.map((item) => <Tarjeta key={item.id} actividad={item} onAbrir={() => abrir(item)} />)}
                </section>
              </div>
            );
          })}
        </div>
      )}

      {vista === "agenda" && (
        <section className="card card-body border-0 shadow-sm bg-white">
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3 pb-3 border-bottom">
            <div className="d-flex align-items-end gap-3">
              <label className="small text-secondary mb-0">
                <span className="d-block mb-1 fw-bold text-dark">Día de agenda:</span>
                <input className="form-control form-control-sm" type="date" value={dia} onChange={(evento) => setDia(evento.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                onClick={exportarAgendaDia}
                title="Descargar reporte en formato CSV (Excel) de las actividades de este día"
              >
                <span>📊</span> Exportar tareas del día (.CSV)
              </button>
            </div>
            <div className="text-secondary small bg-light p-2 rounded border">
              Jornada <strong>{catalogo.area.jornada_inicio}–{catalogo.area.jornada_fin}</strong> · Agendado: <strong>{Math.floor(ocupado / 60)}h {ocupado % 60}m</strong> · Disponible: <strong>{Math.floor(libre / 60)}h {libre % 60}m</strong>
            </div>
          </div>
          {delDia.length === 0 && (
            <div className="text-center py-5">
              <p className="text-secondary mb-1">No hay actividades agendadas para el {dia}.</p>
              <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={abrirNueva}>
                + Agendar nueva actividad
              </button>
            </div>
          )}
          {delDia.map((item) => (
            <div key={item.id} className="d-flex gap-3 border-bottom py-2 align-items-center">
              <div className="hora text-secondary small fw-bold" style={{ width: 110 }}>{item.hora_inicio}–{item.hora_fin}</div>
              <div className="flex-grow-1">
                <Tarjeta actividad={item} onAbrir={() => abrir(item)} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Modal Crear / Editar Actividad */}
      {form && (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: "rgba(15,23,42,.45)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <form className="modal-content border-0 shadow-lg" onSubmit={guardar}>
              <div className="modal-header">
                <h2 className="modal-title h5 fw-bold">{editandoId ? "Editar actividad" : "Nueva actividad"}</h2>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setForm(null)} />
              </div>
              <div className="modal-body">
                {aviso && <div className="alert alert-danger py-2 small">{aviso}</div>}
                <label className="form-label small fw-bold">Título *</label>
                <input className="form-control mb-2" required value={form.titulo} onChange={(evento) => setForm({ ...form, titulo: evento.target.value })} />
                <label className="form-label small fw-bold">Descripción</label>
                <textarea className="form-control mb-2" rows="2" value={form.descripcion} onChange={(evento) => setForm({ ...form, descripcion: evento.target.value })} />
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Fecha</label>
                    <input className="form-control" type="date" required value={form.fecha} onChange={(evento) => setForm({ ...form, fecha: evento.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Inicio</label>
                    <input className="form-control" type="time" required value={form.hora_inicio} onChange={(evento) => setForm({ ...form, hora_inicio: evento.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Fin</label>
                    <input className="form-control" type="time" required value={form.hora_fin} onChange={(evento) => setForm({ ...form, hora_fin: evento.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Categoría</label>
                    <select className="form-select" value={form.categoria_id} onChange={(evento) => setForm({ ...form, categoria_id: evento.target.value })}>
                      {catalogo.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Prioridad</label>
                    <select className="form-select" value={form.prioridad_id} onChange={(evento) => setForm({ ...form, prioridad_id: evento.target.value })}>
                      {catalogo.prioridades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Estado</label>
                    <select className="form-select" value={form.estado_id} onChange={(evento) => setForm({ ...form, estado_id: evento.target.value })}>
                      {catalogo.estados.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Solicitada por</label>
                    <select className="form-select" value={form.reportado_por} onChange={(evento) => setForm({ ...form, reportado_por: evento.target.value })}>
                      {catalogo.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Responsable asignado (Admin / Gestor)</label>
                    <select className="form-select" value={form.asignado_a} onChange={(evento) => setForm({ ...form, asignado_a: evento.target.value })}>
                      <option value="">Sin asignar</option>
                      {catalogo.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <label className="form-label small fw-bold mt-2">Observaciones</label>
                <textarea className="form-control mb-2" rows="2" value={form.observaciones} onChange={(evento) => setForm({ ...form, observaciones: evento.target.value })} />
                <label className="form-label small fw-bold">Subtareas</label>
                {form.checklist.map((item, indice) => (
                  <div className="input-group mb-2" key={item.id ?? `nueva-${indice}`}>
                    <div className="input-group-text">
                      <input type="checkbox" checked={item.hecho} aria-label="Hecha" onChange={(evento) => {
                        const checklist = [...form.checklist];
                        checklist[indice] = { ...item, hecho: evento.target.checked };
                        setForm({ ...form, checklist });
                      }} />
                    </div>
                    <input className="form-control" value={item.texto} onChange={(evento) => {
                      const checklist = [...form.checklist];
                      checklist[indice] = { ...item, texto: evento.target.value };
                      setForm({ ...form, checklist });
                    }} />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      aria-label="Quitar subtarea"
                      onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, idx) => idx !== indice) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setForm({ ...form, checklist: [...form.checklist, { texto: "", hecho: false }] })}>
                  + Agregar subtarea
                </button>
                {editando && (
                  <div className="mt-3 pt-2 border-top">
                    <h3 className="h6 fw-bold">Comentarios</h3>
                    {editando.comentarios.length === 0 && <p className="text-secondary small">Sin comentarios.</p>}
                    {editando.comentarios.map((item) => (
                      <p key={item.id} className="small mb-1"><strong>{item.autor.nombre}:</strong> {item.cuerpo}</p>
                    ))}
                    <div className="input-group mt-2">
                      <input className="form-control" value={nota} placeholder="Comentario para la revisión" onChange={(evento) => setNota(evento.target.value)} />
                      <button className="btn btn-outline-primary" type="button" onClick={comentar}>Agregar</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer justify-content-between">
                {editandoId ? <button type="button" className="btn btn-outline-danger btn-sm" onClick={eliminar}>Eliminar</button> : <span />}
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setForm(null)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" type="submit">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin: Crear Usuario Corporativo */}
      {mostrarCrearUsuario && (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: "rgba(15,23,42,.45)" }}>
          <div className="modal-dialog">
            <form className="modal-content border-0 shadow-lg" onSubmit={handleCrearUsuario}>
              <div className="modal-header">
                <h2 className="modal-title h5 fw-bold">Nuevo usuario corporativo</h2>
                <button type="button" className="btn-close" onClick={() => setMostrarCrearUsuario(false)} />
              </div>
              <div className="modal-body">
                {avisoAdmin && <div className="alert alert-danger py-2 small">{avisoAdmin}</div>}
                {exitoAdmin && <div className="alert alert-success py-2 small">{exitoAdmin}</div>}
                <div className="mb-2">
                  <label className="form-label small fw-bold">Nombre completo *</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Ej. Ana Martínez"
                    value={nuevoUser.nombre}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, nombre: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-bold">Usuario de acceso *</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Ej. amartinez"
                    value={nuevoUser.usuario_acceso}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, usuario_acceso: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-bold">Correo corporativo *</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    placeholder="usuario@amphos21.com"
                    value={nuevoUser.email}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, email: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Contraseña robusta *</label>
                  <div className="input-group">
                    <input
                      type={verClaveNuevo ? "text" : "password"}
                      className="form-control"
                      required
                      placeholder="Mín. 8 caracteres, mayúscula, número y especial"
                      value={nuevoUser.clave}
                      onChange={(e) => setNuevoUser({ ...nuevoUser, clave: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setVerClaveNuevo(!verClaveNuevo)}
                      title={verClaveNuevo ? "Ocultar contraseña" : "Ver contraseña"}
                      tabIndex="-1"
                    >
                      {verClaveNuevo ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <small className="text-secondary" style={{ fontSize: "0.75rem" }}>
                    Debe contener mayúscula, minúscula, número y caracter especial (!@#$%&*).
                  </small>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="chkAdmin"
                    checked={nuevoUser.es_admin}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, es_admin: e.target.checked })}
                  />
                  <label className="form-check-label small" htmlFor="chkAdmin">
                    Privilegios de Administrador (gestión de usuarios y contraseñas)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light btn-sm" onClick={() => setMostrarCrearUsuario(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary btn-sm">Crear usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin: Recuperar / Restablecer Clave */}
      {mostrarRecuperarClave && (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: "rgba(15,23,42,.45)" }}>
          <div className="modal-dialog">
            <form className="modal-content border-0 shadow-lg" onSubmit={handleRecuperarClave}>
              <div className="modal-header">
                <h2 className="modal-title h5 fw-bold">Recuperar / Cambiar contraseña</h2>
                <button type="button" className="btn-close" onClick={() => setMostrarRecuperarClave(false)} />
              </div>
              <div className="modal-body">
                {avisoAdmin && <div className="alert alert-danger py-2 small">{avisoAdmin}</div>}
                {exitoAdmin && <div className="alert alert-success py-2 small">{exitoAdmin}</div>}
                <div className="mb-3">
                  <label className="form-label small fw-bold">Seleccionar usuario *</label>
                  <select
                    className="form-select"
                    required
                    value={recuperarUser.usuario_id}
                    onChange={(e) => setRecuperarUser({ ...recuperarUser, usuario_id: e.target.value })}
                  >
                    <option value="">Seleccione un usuario...</option>
                    {catalogo.usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.email || u.usuario_acceso})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-bold">Nueva contraseña robusta *</label>
                  <div className="input-group">
                    <input
                      type={verClaveRecuperar ? "text" : "password"}
                      className="form-control"
                      required
                      placeholder="Mín. 8 carácteres, mayúscula, número y especial"
                      value={recuperarUser.nueva_clave}
                      onChange={(e) => setRecuperarUser({ ...recuperarUser, nueva_clave: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setVerClaveRecuperar(!verClaveRecuperar)}
                      title={verClaveRecuperar ? "Ocultar contraseña" : "Ver contraseña"}
                      tabIndex="-1"
                    >
                      {verClaveRecuperar ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <small className="text-secondary" style={{ fontSize: "0.75rem" }}>
                    Ejemplo: <code>ClaveSegura#2026</code>
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light btn-sm" onClick={() => setMostrarRecuperarClave(false)}>Cerrar</button>
                <button type="submit" className="btn btn-primary btn-sm">Actualizar contraseña</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
