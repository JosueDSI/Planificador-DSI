import { memo, useMemo, useState } from "react";
import Tarjeta, { MIME_ACTIVIDAD } from "./Tarjeta";
import { colorEstado } from "../utils";

const aceptaArrastre = (evento) => Array.from(evento.dataTransfer?.types || []).includes(MIME_ACTIVIDAD);

function Tablero({ estados, visibles, vencidaIds, moviendo, onAbrir, onMover }) {
  // Estado local: resaltar la columna destino solo re-renderiza el tablero, no toda la app.
  const [destino, setDestino] = useState(null);

  const porEstado = useMemo(() => {
    const mapa = new Map(estados.map((estado) => [estado.id, []]));
    visibles.forEach((actividad) => mapa.get(actividad.estado.id)?.push(actividad));
    return mapa;
  }, [estados, visibles]);

  return (
    <div className="tablero" onDragEnd={() => setDestino(null)}>
      {estados.map((estado) => {
        const columna = porEstado.get(estado.id) || [];
        const activa = destino === estado.id;
        return (
          <section
            key={estado.id}
            className={`columna ${activa ? "drop-activa" : ""}`}
            aria-labelledby={`columna-${estado.id}`}
            onDragOver={(evento) => {
              if (!aceptaArrastre(evento)) return;
              evento.preventDefault();
              evento.dataTransfer.dropEffect = "move";
              if (destino !== estado.id) setDestino(estado.id);
            }}
            onDragLeave={(evento) => {
              if (!evento.currentTarget.contains(evento.relatedTarget)) setDestino((actual) => (actual === estado.id ? null : actual));
            }}
            onDrop={(evento) => {
              evento.preventDefault();
              setDestino(null);
              const id = Number(evento.dataTransfer.getData(MIME_ACTIVIDAD));
              if (id) onMover(id, estado.id);
            }}
          >
            <header className="columna-cabecera">
              <span className="punto" style={{ background: colorEstado(estado) }} aria-hidden="true" />
              <h2 id={`columna-${estado.id}`} className="h6 fw-bold mb-0">
                {estado.nombre}
              </h2>
              <span className="contador" aria-label={`${columna.length} actividades`}>
                {columna.length}
              </span>
            </header>
            <div className="columna-lista">
              {columna.length === 0 ? (
                <div className="columna-vacia">{activa ? "Suelta aquí la actividad" : "Sin actividades"}</div>
              ) : (
                columna.map((item) => (
                  <Tarjeta
                    key={item.id}
                    actividad={item}
                    vencida={vencidaIds.has(item.id)}
                    moviendo={moviendo.has(item.id)}
                    onAbrir={onAbrir}
                    estados={estados}
                    onMover={onMover}
                    arrastrable
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default memo(Tablero);
