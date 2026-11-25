import { memo, useMemo, useState } from "react";
import Icono from "./Icono";
import Tarjeta from "./Tarjeta";
import { BotonCarga, EstadoVacio } from "./ui";
import { desplazarDia, duracion, formatearFecha, formatearFechaLarga, formatoDuracion, hoyIso, minutos } from "../utils";
import { exportarAgendaDia } from "../exportar";

function Agenda({ dia, onCambiarDia, visibles, vencidaIds, catalogo, usuarioActual, hayFiltros, onAbrir, onNueva, notificar }) {
  const [exportando, setExportando] = useState(false);

  const { delDia, ocupado, solapadas } = useMemo(() => {
    const lista = visibles.filter((item) => item.fecha === dia);
    const abiertas = lista.filter((item) => !item.estado.es_cierre);
    const cruces = new Set();
    abiertas.forEach((a, i) => {
      abiertas.slice(i + 1).forEach((b) => {
        const mismoResponsable = a.asignado_a && b.asignado_a && a.asignado_a.id === b.asignado_a.id;
        const seCruzan = minutos(a.hora_inicio) < minutos(b.hora_fin) && minutos(b.hora_inicio) < minutos(a.hora_fin);
        if (mismoResponsable && seCruzan) {
          cruces.add(a.id);
          cruces.add(b.id);
        }
      });
    });
    return { delDia: lista, ocupado: abiertas.reduce((total, item) => total + duracion(item), 0), solapadas: cruces };
  }, [visibles, dia]);

  const jornada = Math.max(0, minutos(catalogo.area.jornada_fin) - minutos(catalogo.area.jornada_inicio));
  const libre = Math.max(0, jornada - ocupado);
  const porcentaje = jornada ? Math.min(100, Math.round((ocupado * 100) / jornada)) : 0;
  const sobreasignado = ocupado > jornada;
  const esHoy = dia === hoyIso();

  async function exportar() {
    if (!delDia.length || exportando) return;
    setExportando(true);
    try {
      await exportarAgendaDia(delDia, { dia, areaNombre: catalogo.area?.nombre, usuarioNombre: usuarioActual?.nombre });
      notificar(`Reporte del ${formatearFecha(dia)} descargado`);
    } catch {
      notificar("No se pudo generar el archivo Excel. Inténtalo de nuevo.", "error");
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="surface p-3 p-md-4" aria-labelledby="titulo-agenda">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3 pb-3 border-bottom">
        <div>
          <h2 id="titulo-agenda" className="h5 fw-bold mb-2">
            {formatearFechaLarga(dia)}
            {esHoy && <span className="badge rounded-pill text-bg-light border ms-2 align-middle small">Hoy</span>}
          </h2>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group" aria-label="Navegar entre días">
              <button type="button" className="btn btn-outline-secondary" onClick={() => onCambiarDia(desplazarDia(dia, -1))} aria-label="Día anterior">
                <Icono nombre="chevronLeft" />
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => onCambiarDia(hoyIso())} disabled={esHoy}>
                Hoy
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => onCambiarDia(desplazarDia(dia, 1))} aria-label="Día siguiente">
                <Icono nombre="chevronRight" />
              </button>
            </div>
            <label className="visually-hidden" htmlFor="agenda-dia">
              Elegir día de agenda
            </label>
            <input
              id="agenda-dia"
              className="form-control form-control-sm w-auto"
              type="date"
              value={dia}
              // Ignora el valor vacío que deja el botón "Borrar" del selector nativo.
              onChange={(evento) => evento.target.value && onCambiarDia(evento.target.value)}
            />
            <BotonCarga
              className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
              cargando={exportando}
              textoCargando="Generando…"
              disabled={!delDia.length}
              onClick={exportar}
              title={delDia.length ? "Descargar reporte Excel de este día" : "No hay actividades para exportar en este día"}
            >
              <Icono nombre="download" /> Exportar .xlsx
            </BotonCarga>
          </div>
          {hayFiltros && delDia.length > 0 && (
            <p className="mini-texto text-secondary mb-0 mt-2">Se muestran y exportan solo las actividades que cumplen los filtros actuales.</p>
          )}
        </div>

        <div className="ocupacion" aria-label="Ocupación de la jornada">
          <div className="d-flex justify-content-between mini-texto text-secondary mb-1 gap-3">
            <span>
              Jornada {catalogo.area.jornada_inicio}–{catalogo.area.jornada_fin}
            </span>
            <span className={sobreasignado ? "text-danger fw-semibold" : ""}>{sobreasignado ? "Sobreasignada" : `${porcentaje}% ocupada`}</span>
          </div>
          <div className="barra barra-gruesa">
            <span style={{ width: `${porcentaje}%`, background: sobreasignado ? "#e11d48" : "#f07d00" }} />
          </div>
          <div className="d-flex justify-content-between mini-texto mt-1 gap-3">
            <span>
              Por ejecutar: <strong>{formatoDuracion(ocupado)}</strong>
            </span>
            <span>
              Disponible: <strong>{formatoDuracion(libre)}</strong>
            </span>
          </div>
        </div>
      </div>

      {delDia.length === 0 ? (
        <EstadoVacio
          icono="calendar"
          titulo={hayFiltros ? "Ninguna actividad de este día coincide con los filtros" : "No hay actividades agendadas para este día"}
          texto={`${formatearFechaLarga(dia)}`}
        >
          <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={onNueva}>
            <Icono nombre="plus" /> Agendar actividad
          </button>
        </EstadoVacio>
      ) : (
        <ol className="list-unstyled mb-0">
          {delDia.map((item) => (
            <li key={item.id} className="agenda-fila">
              <div className="agenda-hora hora">
                <strong>{item.hora_inicio}</strong>
                <span className="text-secondary">{item.hora_fin}</span>
                <span className="mini-texto text-secondary">{formatoDuracion(duracion(item))}</span>
                {solapadas.has(item.id) && (
                  <span className="chip chip-aviso" title="Se cruza con otra actividad del mismo responsable">
                    Cruce
                  </span>
                )}
              </div>
              <Tarjeta actividad={item} vencida={vencidaIds.has(item.id)} onAbrir={onAbrir} mostrarFecha={false} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default memo(Agenda);
