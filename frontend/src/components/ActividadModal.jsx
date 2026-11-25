import { useId, useMemo, useRef, useState } from "react";
import { api } from "../api";
import Icono from "./Icono";
import Modal from "./Modal";
import { Avatar, BotonCarga } from "./ui";
import { aFormulario, aPayload, formatearFechaHora, formatoDuracion, minutos, nuevaClave } from "../utils";

const LIMITE_TITULO = 180;
const LIMITE_TEXTO = 1000;

function Contador({ valor, limite }) {
  if (valor.length < limite * 0.8) return null;
  return (
    <div className={`form-text text-end ${valor.length >= limite ? "text-danger" : ""}`} aria-live="polite">
      {valor.length}/{limite}
    </div>
  );
}

/**
 * El estado del formulario vive aquí (no en App): escribir en el modal ya no
 * re-renderiza el tablero, los KPIs ni los gráficos.
 */
export default function ActividadModal({ actividad, catalogo, usuarioActual, actividades, onCerrar, onGuardada, onEliminada, onActualizada }) {
  const esNueva = !actividad;
  const id = useId();
  const [inicial] = useState(() => aFormulario(actividad, catalogo, usuarioActual));
  const [form, setForm] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmando, setConfirmando] = useState(null); // "eliminar" | "descartar" | null
  const [aviso, setAviso] = useState("");
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [nota, setNota] = useState("");
  const [comentando, setComentando] = useState(false);
  const [enfocar, setEnfocar] = useState(null);
  const avisoRef = useRef(null);

  const modificado = useMemo(() => JSON.stringify(form) !== JSON.stringify(inicial), [form, inicial]);
  const actualizar = (campo) => (evento) => setForm((previo) => ({ ...previo, [campo]: evento.target.value }));

  const horaInvalida = Boolean(form.hora_inicio && form.hora_fin && minutos(form.hora_fin) <= minutos(form.hora_inicio));
  const tituloInvalido = !form.titulo.trim();
  const duracionMin = horaInvalida ? 0 : minutos(form.hora_fin) - minutos(form.hora_inicio);
  const fueraJornada =
    !horaInvalida &&
    catalogo.area &&
    (minutos(form.hora_inicio) < minutos(catalogo.area.jornada_inicio) || minutos(form.hora_fin) > minutos(catalogo.area.jornada_fin));

  const cruces = useMemo(() => {
    if (!form.asignado_a || horaInvalida) return [];
    const inicio = minutos(form.hora_inicio);
    const fin = minutos(form.hora_fin);
    return actividades.filter(
      (otra) =>
        otra.id !== actividad?.id &&
        otra.fecha === form.fecha &&
        otra.asignado_a?.id === Number(form.asignado_a) &&
        !otra.estado.es_cierre &&
        minutos(otra.hora_inicio) < fin &&
        inicio < minutos(otra.hora_fin)
    );
  }, [actividades, actividad, form.asignado_a, form.fecha, form.hora_inicio, form.hora_fin, horaInvalida]);

  const subtareasVacias = form.checklist.filter((item) => !item.texto.trim()).length;
  const hechas = form.checklist.filter((item) => item.hecho && item.texto.trim()).length;
  const totalSubtareas = form.checklist.length - subtareasVacias;

  function solicitarCierre() {
    if (guardando || eliminando) return;
    if (modificado) setConfirmando("descartar");
    else onCerrar();
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    requestAnimationFrame(() => avisoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) return;
    setIntentoEnviar(true);
    if (tituloInvalido || horaInvalida) {
      mostrarAviso("Revisa los campos marcados antes de guardar.");
      return;
    }
    setGuardando(true);
    setAviso("");
    try {
      const payload = aPayload(form);
      const resultado = esNueva ? await api.crear(payload) : await api.guardar(actividad.id, payload);
      onGuardada(resultado, esNueva);
    } catch (err) {
      setGuardando(false);
      mostrarAviso(err.message);
    }
  }

  async function eliminar() {
    if (eliminando) return;
    setEliminando(true);
    setAviso("");
    try {
      await api.eliminar(actividad.id);
      onEliminada(actividad);
    } catch (err) {
      setEliminando(false);
      setConfirmando(null);
      mostrarAviso(err.message);
    }
  }

  async function comentar() {
    const texto = nota.trim();
    if (!texto || comentando || !usuarioActual) return;
    setComentando(true);
    setAviso("");
    try {
      const actualizada = await api.comentar(actividad.id, usuarioActual.id, texto);
      onActualizada(actualizada);
      setNota("");
    } catch (err) {
      mostrarAviso(err.message);
    } finally {
      setComentando(false);
    }
  }

  function agregarSubtarea() {
    const clave = nuevaClave();
    setForm((previo) => ({ ...previo, checklist: [...previo.checklist, { texto: "", hecho: false, _key: clave }] }));
    setEnfocar(clave);
  }

  function editarSubtarea(clave, cambios) {
    setForm((previo) => ({
      ...previo,
      checklist: previo.checklist.map((item) => (item._key === clave ? { ...item, ...cambios } : item)),
    }));
  }

  function quitarSubtarea(clave) {
    setForm((previo) => ({ ...previo, checklist: previo.checklist.filter((item) => item._key !== clave) }));
  }

  let pie;
  if (confirmando === "eliminar") {
    pie = (
      <div className="confirmacion w-100 d-flex flex-wrap align-items-center gap-2" role="alert">
        <span className="me-auto small fw-semibold text-danger d-flex align-items-center gap-2">
          <Icono nombre="alert" /> ¿Eliminar {actividad.clave} definitivamente? No se puede deshacer.
        </span>
        <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirmando(null)} disabled={eliminando}>
          Cancelar
        </button>
        <BotonCarga className="btn btn-danger btn-sm" cargando={eliminando} textoCargando="Eliminando…" onClick={eliminar}>
          Sí, eliminar
        </BotonCarga>
      </div>
    );
  } else if (confirmando === "descartar") {
    pie = (
      <div className="confirmacion confirmacion-neutra w-100 d-flex flex-wrap align-items-center gap-2" role="alert">
        <span className="me-auto small fw-semibold">Tienes cambios sin guardar. ¿Descartarlos?</span>
        <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirmando(null)}>
          Seguir editando
        </button>
        <button type="button" className="btn btn-warning btn-sm" onClick={onCerrar}>
          Descartar cambios
        </button>
      </div>
    );
  } else {
    pie = (
      <div className="w-100 d-flex flex-wrap justify-content-between align-items-center gap-2">
        {esNueva ? (
          <span className="mini-texto text-secondary">* Campo obligatorio</span>
        ) : (
          <button type="button" className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" onClick={() => setConfirmando("eliminar")} disabled={guardando}>
            <Icono nombre="trash" /> Eliminar
          </button>
        )}
        <div className="d-flex gap-2 ms-auto">
          <button type="button" className="btn btn-light btn-sm" onClick={solicitarCierre} disabled={guardando}>
            Cancelar
          </button>
          <BotonCarga type="submit" className="btn btn-primary btn-sm px-3" cargando={guardando} textoCargando="Guardando…" disabled={!esNueva && !modificado}>
            {esNueva ? "Crear actividad" : modificado ? "Guardar cambios" : "Sin cambios"}
          </BotonCarga>
        </div>
      </div>
    );
  }

  return (
    <Modal
      titulo={esNueva ? "Nueva actividad" : "Editar actividad"}
      subtitulo={esNueva ? "Completa los datos para agendarla" : `${actividad.clave} · ${actividad.estado.nombre}`}
      onCerrar={solicitarCierre}
      onSubmit={guardar}
      pie={pie}
      ancho={760}
    >
      <div ref={avisoRef}>
        {aviso && (
          <div className="alert alert-danger py-2 small d-flex align-items-start gap-2" role="alert">
            <Icono nombre="alert" className="mt-1" />
            <span>{aviso}</span>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor={`${id}-titulo`} className="form-label small">
          Título de la actividad *
        </label>
        <input
          id={`${id}-titulo`}
          data-autofocus
          className={`form-control ${intentoEnviar && tituloInvalido ? "is-invalid" : ""}`}
          required
          maxLength={LIMITE_TITULO}
          value={form.titulo}
          onChange={actualizar("titulo")}
          placeholder="Ej. Revisar respaldos del área"
          aria-invalid={(intentoEnviar && tituloInvalido) || undefined}
        />
        {intentoEnviar && tituloInvalido && <div className="invalid-feedback">El título es obligatorio.</div>}
        <Contador valor={form.titulo} limite={LIMITE_TITULO} />
      </div>

      <div className="mb-3">
        <label htmlFor={`${id}-descripcion`} className="form-label small">
          Descripción
        </label>
        <textarea id={`${id}-descripcion`} className="form-control" rows="2" maxLength={LIMITE_TEXTO} value={form.descripcion} onChange={actualizar("descripcion")} />
        <Contador valor={form.descripcion} limite={LIMITE_TEXTO} />
      </div>

      <fieldset className="mb-3">
        <legend className="form-label small fw-semibold mb-2">Programación</legend>
        <div className="row g-2">
          <div className="col-12 col-sm-4">
            <label htmlFor={`${id}-fecha`} className="form-label small">
              Fecha *
            </label>
            <input id={`${id}-fecha`} className="form-control" type="date" required value={form.fecha} onChange={actualizar("fecha")} />
          </div>
          <div className="col-6 col-sm-4">
            <label htmlFor={`${id}-inicio`} className="form-label small">
              Hora inicio *
            </label>
            <input id={`${id}-inicio`} className="form-control" type="time" required value={form.hora_inicio} onChange={actualizar("hora_inicio")} />
          </div>
          <div className="col-6 col-sm-4">
            <label htmlFor={`${id}-fin`} className="form-label small">
              Hora fin *
            </label>
            <input
              id={`${id}-fin`}
              className={`form-control ${horaInvalida ? "is-invalid" : ""}`}
              type="time"
              required
              value={form.hora_fin}
              onChange={actualizar("hora_fin")}
              aria-invalid={horaInvalida || undefined}
              aria-describedby={`${id}-horario`}
            />
          </div>
        </div>
        <div id={`${id}-horario`} className="mt-1 mini-texto" aria-live="polite">
          {horaInvalida ? (
            <span className="text-danger fw-semibold">La hora de fin debe ser posterior a la de inicio.</span>
          ) : (
            <span className="text-secondary">
              Duración: <strong>{formatoDuracion(duracionMin)}</strong>
              {fueraJornada && (
                <span className="text-warning-emphasis ms-2">
                  · Fuera de la jornada ({catalogo.area.jornada_inicio}–{catalogo.area.jornada_fin})
                </span>
              )}
            </span>
          )}
        </div>
      </fieldset>

      <div className="row g-2 mb-3">
        <div className="col-12 col-sm-4">
          <label htmlFor={`${id}-categoria`} className="form-label small">
            Categoría
          </label>
          <select id={`${id}-categoria`} className="form-select" value={form.categoria_id} onChange={actualizar("categoria_id")}>
            {catalogo.categorias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-sm-4">
          <label htmlFor={`${id}-prioridad`} className="form-label small">
            Prioridad
          </label>
          <select id={`${id}-prioridad`} className="form-select" value={form.prioridad_id} onChange={actualizar("prioridad_id")}>
            {catalogo.prioridades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-sm-4">
          <label htmlFor={`${id}-estado`} className="form-label small">
            Estado
          </label>
          <select id={`${id}-estado`} className="form-select" value={form.estado_id} onChange={actualizar("estado_id")}>
            {catalogo.estados.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6">
          <label htmlFor={`${id}-solicita`} className="form-label small">
            Solicitada por
          </label>
          <select id={`${id}-solicita`} className="form-select" value={form.reportado_por} onChange={actualizar("reportado_por")}>
            {catalogo.usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6">
          <label htmlFor={`${id}-responsable`} className="form-label small">
            Responsable asignado
          </label>
          <select id={`${id}-responsable`} className="form-select" value={form.asignado_a} onChange={actualizar("asignado_a")}>
            <option value="">Sin asignar</option>
            {catalogo.usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nombre}
              </option>
            ))}
          </select>
        </div>
        {cruces.length > 0 && (
          <div className="col-12">
            <div className="alert alert-warning py-2 mb-0 mini-texto d-flex gap-2" role="status">
              <Icono nombre="alert" className="mt-1" />
              <span>
                El responsable ya tiene {cruces.length === 1 ? "otra actividad" : `${cruces.length} actividades`} en ese horario:{" "}
                {cruces.map((otra) => `${otra.clave} (${otra.hora_inicio}–${otra.hora_fin})`).join(", ")}.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor={`${id}-observaciones`} className="form-label small">
          Observaciones
        </label>
        <textarea id={`${id}-observaciones`} className="form-control" rows="2" maxLength={LIMITE_TEXTO} value={form.observaciones} onChange={actualizar("observaciones")} />
        <Contador valor={form.observaciones} limite={LIMITE_TEXTO} />
      </div>

      <fieldset className="mb-2">
        <legend className="form-label small fw-semibold d-flex justify-content-between align-items-center mb-2">
          <span>Subtareas</span>
          {totalSubtareas > 0 && (
            <span className="mini-texto text-secondary fw-normal">
              {hechas}/{totalSubtareas} completadas
            </span>
          )}
        </legend>
        {totalSubtareas > 0 && (
          <div className="barra mb-2" aria-hidden="true">
            <span style={{ width: `${(hechas * 100) / totalSubtareas}%`, background: "#94c11f" }} />
          </div>
        )}
        {form.checklist.length === 0 && <p className="mini-texto text-secondary mb-2">Divide la actividad en pasos para seguir su avance.</p>}
        {form.checklist.map((item, indice) => (
          <div className="input-group input-group-sm mb-2" key={item._key}>
            <div className="input-group-text bg-white">
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={item.hecho}
                aria-label={`Marcar subtarea ${indice + 1} como hecha`}
                onChange={(evento) => editarSubtarea(item._key, { hecho: evento.target.checked })}
              />
            </div>
            <input
              className={`form-control ${item.hecho ? "subtarea-hecha" : ""}`}
              value={item.texto}
              maxLength={200}
              autoFocus={item._key === enfocar}
              placeholder="Describe la subtarea y pulsa Enter para añadir otra"
              aria-label={`Subtarea ${indice + 1}`}
              onChange={(evento) => editarSubtarea(item._key, { texto: evento.target.value })}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && !evento.nativeEvent.isComposing) {
                  evento.preventDefault();
                  agregarSubtarea();
                }
              }}
            />
            <button type="button" className="btn btn-outline-secondary" aria-label={`Quitar subtarea ${indice + 1}`} onClick={() => quitarSubtarea(item._key)}>
              <Icono nombre="x" tam={14} />
            </button>
          </div>
        ))}
        {subtareasVacias > 0 && <p className="mini-texto text-secondary mb-2">Las subtareas vacías no se guardarán.</p>}
        <button type="button" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" onClick={agregarSubtarea}>
          <Icono nombre="plus" tam={14} /> Agregar subtarea
        </button>
      </fieldset>

      {!esNueva && (
        <section className="mt-4 pt-3 border-top" aria-labelledby={`${id}-comentarios`}>
          <h3 id={`${id}-comentarios`} className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <Icono nombre="message" /> Comentarios
            <span className="badge rounded-pill text-bg-light border">{actividad.comentarios.length}</span>
          </h3>
          {actividad.comentarios.length === 0 && <p className="text-secondary small">Sin comentarios aún. Sé el primero en dejar una nota.</p>}
          <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
            {actividad.comentarios.map((item) => (
              <li key={item.id} className="comentario">
                <Avatar nombre={item.autor.nombre} tam="sm" />
                <div className="min-w-0 flex-grow-1">
                  <div className="mini-texto text-secondary mb-1">
                    <strong className="text-dark">{item.autor.nombre}</strong> · <time dateTime={item.creado_en}>{formatearFechaHora(item.creado_en)}</time>
                  </div>
                  <div className="comentario-cuerpo">{item.cuerpo}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="input-group input-group-sm mt-3">
            <label htmlFor={`${id}-nota`} className="visually-hidden">
              Nuevo comentario
            </label>
            <input
              id={`${id}-nota`}
              className="form-control"
              value={nota}
              maxLength={LIMITE_TEXTO}
              placeholder="Escribe un comentario y pulsa Enter…"
              readOnly={comentando}
              onChange={(evento) => setNota(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && !evento.nativeEvent.isComposing) {
                  evento.preventDefault();
                  comentar();
                }
              }}
            />
            <BotonCarga className="btn btn-outline-primary" cargando={comentando} textoCargando="Enviando…" disabled={!nota.trim()} onClick={comentar}>
              Comentar
            </BotonCarga>
          </div>
        </section>
      )}
    </Modal>
  );
}
