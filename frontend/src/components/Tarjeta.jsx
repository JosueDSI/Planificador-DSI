import { memo } from "react";
import Icono from "./Icono";
import { Avatar } from "./ui";
import { CLASE_PRIORIDAD, fechaRelativa } from "../utils";

// Tipo MIME propio: evita que soltar texto arbitrario (p. ej. "5") mueva una actividad.
export const MIME_ACTIVIDAD = "application/x-actividad-dsi";

function Tarjeta({ actividad, vencida = false, moviendo = false, onAbrir, estados, onMover, arrastrable = false, mostrarFecha = true }) {
  const total = actividad.checklist.length;
  const hechas = actividad.checklist.filter((item) => item.hecho).length;
  const responsable = actividad.asignado_a;
  const comentarios = actividad.comentarios?.length || 0;

  return (
    <article
      className={`tarjeta ${vencida ? "vencida" : ""} ${moviendo ? "moviendo" : ""}`}
      style={{ "--cat": actividad.categoria.color }}
      draggable={arrastrable && !moviendo}
      onDragStart={
        arrastrable
          ? (evento) => {
              evento.dataTransfer.setData(MIME_ACTIVIDAD, String(actividad.id));
              evento.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      // El clic en cualquier parte abre; el botón del título da acceso por teclado (Enter/Espacio burbujean como clic).
      onClick={() => onAbrir(actividad)}
      aria-busy={moviendo || undefined}
    >
      <div className="d-flex justify-content-between align-items-start gap-2">
        <button type="button" className="tarjeta-titulo">
          {actividad.titulo}
        </button>
        <span className={`pill-prioridad ${CLASE_PRIORIDAD[actividad.prioridad.nombre] || "prioridad-baja"}`}>
          {actividad.prioridad.nombre}
        </span>
      </div>

      <div className="tarjeta-meta">
        <span className="tarjeta-clave">{actividad.clave}</span>
        <span aria-hidden="true">·</span>
        <span className="punto" style={{ background: actividad.categoria.color }} aria-hidden="true" />
        <span>{actividad.categoria.nombre}</span>
      </div>

      <div className="tarjeta-pie">
        <span className="hora d-inline-flex align-items-center gap-1">
          <Icono nombre="clock" tam={12} />
          {mostrarFecha && `${fechaRelativa(actividad.fecha)} · `}
          {actividad.hora_inicio}–{actividad.hora_fin}
        </span>
        {total > 0 && (
          <span className={`chip ${hechas === total ? "chip-exito" : ""}`} title="Subtareas completadas">
            <Icono nombre="list" tam={11} /> {hechas}/{total}
          </span>
        )}
        {comentarios > 0 && (
          <span className="chip" title={`${comentarios} comentario(s)`}>
            <Icono nombre="message" tam={11} /> {comentarios}
          </span>
        )}
        {vencida && <span className="chip chip-peligro">Vencida</span>}
        <span className="ms-auto d-inline-flex align-items-center gap-1">
          {responsable ? (
            <>
              <Avatar nombre={responsable.nombre} tam="sm" />
              <span className="visually-hidden">Responsable: {responsable.nombre}</span>
            </>
          ) : (
            <span className="text-secondary">Sin asignar</span>
          )}
        </span>
      </div>

      {estados && onMover && (
        // Alternativa al drag & drop para teclado y pantallas táctiles.
        <div className="tarjeta-mover" onClick={(evento) => evento.stopPropagation()}>
          <label className="visually-hidden" htmlFor={`mover-${actividad.id}`}>
            Mover {actividad.clave} a
          </label>
          <select
            id={`mover-${actividad.id}`}
            className="form-select form-select-sm"
            value={actividad.estado.id}
            disabled={moviendo}
            onChange={(evento) => onMover(actividad.id, Number(evento.target.value))}
          >
            {estados.map((estado) => (
              <option key={estado.id} value={estado.id}>
                {estado.id === actividad.estado.id ? `Estado: ${estado.nombre}` : `Mover a ${estado.nombre}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </article>
  );
}

export default memo(Tarjeta);
