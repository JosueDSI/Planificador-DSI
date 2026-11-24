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
  const [filtros, setFiltros] = useState({ q: "", categoria: "", prioridad: "", persona: "" });
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
      const texto = `${actividad.titulo} ${actividad.descripcion} ${actividad.observaciones}`.toLowerCase();
      return (
        (!q || texto.includes(q)) &&
        (!filtros.categoria || actividad.categoria.id === Number(filtros.categoria)) &&
        (!filtros.prioridad || actividad.prioridad.id === Number(filtros.prioridad)) &&
        (!filtros.persona || actividad.asignado_a?.id === Number(filtros.persona))
      );
    });
  }, [actividades, filtros]);

  const resumen = useMemo(() => {
    const total = visibles.length;
    const cerradas = visibles.filter((item) => item.estado.es_cierre).length;
    const progreso = visibles.filter((item) => item.estado.columna === "en_progreso").length;
    const pendientes = visibles.filter((item) => item.estado.columna === "por_hacer" || item.estado.columna === "en_espera").length;
    const prioritarias = visibles.filter((item) => item.prioridad.nombre === "Alta" && !item.estado.es_cierre).length;
    const cumplimiento = total ? Math.round((cerradas * 100) / total) : 0;
    return { total, cerradas, progreso, pendientes, prioritarias, cumplimiento };
  }, [visibles]);

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
              <label className="form-label small fw-semibold text-secondary">Usuario o correo corporativo</label>
              <input
                className="form-control"
                required
                placeholder="admin o usuario@dsi.corp"
                value={formLogin.identificador}
                onChange={(e) => setFormLogin({ ...formLogin, identificador: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Contraseña</label>
              <input
                type="password"
                className="form-control"
                required
                placeholder="••••••••"
                value={formLogin.clave}
                onChange={(e) => setFormLogin({ ...formLogin, clave: e.target.value })}
              />
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                Demo: <code>admin</code> / <code>DsiPass@2026</code>
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
          <div className="col-md-3">
            <select className="form-select" value={filtros.persona} onChange={(evento) => setFiltros({ ...filtros, persona: evento.target.value })}>
              <option value="">Responsable</option>
              {catalogo.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
            </select>
          </div>
          <div className="col-md-auto">
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
          <div className="row g-3 mb-3">
            {[
              [resumen.total, "Total"],
              [resumen.pendientes, "Pendientes"],
              [resumen.progreso, "En progreso"],
              [resumen.cerradas, "Completadas"],
              [`${resumen.cumplimiento}%`, "Cumplimiento"],
              [resumen.prioritarias, "Prioritarias"],
            ].map(([valor, etiqueta]) => (
              <div className="col-6 col-md-2" key={etiqueta}>
                <div className="card card-body text-center border-0 shadow-sm">
                  <strong className="fs-3">{valor}</strong>
                  <span className="text-secondary small">{etiqueta}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-lg-7">
              <section className="card card-body border-0 shadow-sm">
                <h2 className="h5 fw-bold">Avance por persona</h2>
                {catalogo.usuarios.map((usuario) => {
                  const propias = visibles.filter((item) => item.asignado_a?.id === usuario.id);
                  const listas = propias.filter((item) => item.estado.es_cierre).length;
                  const porcentaje = propias.length ? Math.round((listas * 100) / propias.length) : 0;
                  return (
                    <div key={usuario.id} className="mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>{usuario.nombre} {usuario.es_admin ? "(Admin)" : ""}</span>
                        <span className="text-secondary">{listas}/{propias.length} ({porcentaje}%)</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div className="progress-bar bg-primary" style={{ width: `${porcentaje}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
            <div className="col-lg-5">
              <section className="card card-body border-0 shadow-sm mb-3">
                <h2 className="h5 fw-bold">Para revisar</h2>
                {visibles.filter((item) => vencida(item) || item.estado.columna === "en_espera").length === 0 && (
                  <p className="text-secondary mb-0 small">No hay actividades vencidas ni en espera.</p>
                )}
                {visibles
                  .filter((item) => vencida(item) || item.estado.columna === "en_espera")
                  .map((item) => (
                    <button key={item.id} type="button" className="btn btn-link text-start px-0 d-block text-decoration-none" onClick={() => abrir(item)}>
                      <span className="fw-semibold text-dark">{item.clave}</span> · {item.titulo}
                      <span className={`badge ms-2 ${vencida(item) ? "text-bg-danger" : "text-bg-warning"}`}>
                        {vencida(item) ? "Vencida" : item.estado.nombre}
                      </span>
                    </button>
                  ))}
              </section>
              <section className="card card-body border-0 shadow-sm">
                <h2 className="h5 fw-bold">Movimientos recientes</h2>
                {historial.length === 0 && <p className="text-secondary mb-0 small">Todavía no hay cambios registrados.</p>}
                {historial.map((fila) => (
                  <p key={fila.id} className="small mb-2 pb-1 border-bottom">
                    <strong>{fila.clave}</strong> {fila.campo}: {fila.valor_anterior ? `${fila.valor_anterior} → ` : ""}<span className="text-primary">{fila.valor_nuevo}</span>
                    <span className="text-secondary d-block" style={{ fontSize: "0.75rem" }}>Por {fila.autor || "Sistema"}</span>
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
        <section className="card card-body border-0 shadow-sm">
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3 pb-2 border-bottom">
            <label className="small text-secondary mb-0">
              <span className="d-block mb-1 fw-bold text-dark">Día:</span>
              <input className="form-control form-control-sm" type="date" value={dia} onChange={(evento) => setDia(evento.target.value)} />
            </label>
            <div className="text-secondary small">
              Jornada {catalogo.area.jornada_inicio}–{catalogo.area.jornada_fin} · Agendado {Math.floor(ocupado / 60)}h {ocupado % 60}m · Disponible {Math.floor(libre / 60)}h {libre % 60}m
            </div>
          </div>
          {delDia.length === 0 && <p className="text-secondary mb-0 py-3 text-center">Este día no tiene actividades.</p>}
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
                    placeholder="amartinez@empresa.com"
                    value={nuevoUser.email}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, email: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Contraseña robusta *</label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    placeholder="Mín. 8 caracteres, mayúscula, número y especial"
                    value={nuevoUser.clave}
                    onChange={(e) => setNuevoUser({ ...nuevoUser, clave: e.target.value })}
                  />
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
                  <input
                    type="password"
                    className="form-control"
                    required
                    placeholder="Mín. 8 carácteres, mayúscula, número y especial"
                    value={recuperarUser.nueva_clave}
                    onChange={(e) => setRecuperarUser({ ...recuperarUser, nueva_clave: e.target.value })}
                  />
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
