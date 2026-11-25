import { memo } from "react";
import { Avatar, EstadoVacio } from "./ui";
import { ESTADO_ABIERTAS, ESTADO_PENDIENTES, fechaRelativa, formatearFechaHora } from "../utils";

const ETIQUETA_CAMPO = { alta: "Creada", estado: "Estado", responsable: "Responsable" };

function Kpi({ etiqueta, insignia, valor, detalle, color, activo = false, onClick, titulo, children }) {
  const contenido = (
    <>
      <span className="d-flex justify-content-between align-items-center gap-1 mb-1">
        <span className="kpi-etiqueta">{etiqueta}</span>
        {insignia && <span className="kpi-insignia">{insignia}</span>}
      </span>
      <strong className="kpi-valor">{valor}</strong>
      {children}
      <span className="kpi-detalle">{detalle}</span>
    </>
  );
  if (!onClick) {
    return (
      <div className="kpi-card" style={{ "--kpi": color }}>
        {contenido}
      </div>
    );
  }
  return (
    <button type="button" className={`kpi-card ${activo ? "activo" : ""}`} style={{ "--kpi": color }} aria-pressed={activo} onClick={onClick} title={titulo}>
      {contenido}
    </button>
  );
}

function Dona({ porEstado, total, filtroEstado, onSeleccionar }) {
  const filtroEspecifico = /^\d+$/.test(filtroEstado || "");
  const descripcion = porEstado.map((estado) => `${estado.nombre}: ${estado.cantidad}`).join(", ");
  let acumulado = 0;
  return (
    <div className="dona">
      <svg viewBox="0 0 36 36" role="img" aria-label={`Distribución por estado. ${descripcion}`}>
        <circle className="dona-fondo" cx="18" cy="18" r="15.915" fill="none" strokeWidth="4.2" />
        {total > 0 &&
          porEstado
            .filter((estado) => estado.cantidad > 0)
            .map((estado) => {
              const inicio = acumulado;
              acumulado += estado.fraccion;
              const seleccionado = filtroEstado === String(estado.id);
              return (
                <circle
                  key={estado.id}
                  className="dona-segmento"
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke={estado.color}
                  strokeWidth={seleccionado ? 5.8 : 4.2}
                  strokeDasharray={`${estado.fraccion} ${100 - estado.fraccion}`}
                  strokeDashoffset={-inicio}
                  style={{ opacity: filtroEspecifico && !seleccionado ? 0.3 : 1 }}
                  onClick={() => onSeleccionar(estado.id)}
                />
              );
            })}
      </svg>
      <div className="dona-centro" aria-hidden="true">
        <span className="dona-total">{total}</span>
        <span className="dona-etiqueta">{total === 1 ? "TAREA" : "TAREAS"}</span>
      </div>
    </div>
  );
}

function Resumen({ stats, filtros, hayFiltros, catalogo, historial, vencidaIds, cambiarFiltros, limpiarFiltros, onAbrir }) {
  const { estados, prioridades } = catalogo;
  const idProgreso = estados.find((estado) => estado.columna === "en_progreso")?.id;
  const idCierre = estados.find((estado) => estado.es_cierre)?.id;
  const idAlta = prioridades.find((prioridad) => prioridad.nombre === "Alta")?.id;

  const alternarEstadoKpi = (valor) => cambiarFiltros({ estado: filtros.estado === valor ? "" : valor, prioridad: "" });
  const alternarEstado = (id) => cambiarFiltros({ estado: filtros.estado === String(id) ? "" : String(id) });
  const alternarCategoria = (id) => cambiarFiltros({ categoria: filtros.categoria === String(id) ? "" : String(id) });
  const alternarPersona = (id) => cambiarFiltros({ persona: filtros.persona === String(id) ? "" : String(id) });
  const altaActiva = idAlta != null && filtros.prioridad === String(idAlta) && filtros.estado === ESTADO_ABIERTAS;

  return (
    <>
      <h2 className="visually-hidden">Indicadores</h2>
      <div className="row g-2 g-xl-3 mb-4">
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi
            etiqueta="Total"
            insignia="Área"
            valor={stats.total}
            detalle={hayFiltros ? "Con filtros aplicados" : "Todas las tareas"}
            color="#f07d00"
            activo={!hayFiltros}
            onClick={limpiarFiltros}
            titulo="Ver todas las actividades (quita los filtros)"
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi
            etiqueta="Pendientes"
            insignia="Inicio/Espera"
            valor={stats.pendientes}
            detalle="Por hacer y en espera"
            color="#64748b"
            activo={filtros.estado === ESTADO_PENDIENTES}
            onClick={() => alternarEstadoKpi(ESTADO_PENDIENTES)}
            titulo="Filtrar actividades por hacer y en espera"
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi
            etiqueta="En progreso"
            insignia="En curso"
            valor={stats.progreso}
            detalle="En ejecución"
            color="#f07d00"
            activo={idProgreso != null && filtros.estado === String(idProgreso)}
            onClick={idProgreso != null ? () => alternarEstadoKpi(String(idProgreso)) : undefined}
            titulo="Filtrar actividades en progreso"
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi
            etiqueta="Completadas"
            insignia="Listas"
            valor={stats.cerradas}
            detalle="Finalizadas"
            color="#6f9a10"
            activo={idCierre != null && filtros.estado === String(idCierre)}
            onClick={idCierre != null ? () => alternarEstadoKpi(String(idCierre)) : undefined}
            titulo="Filtrar actividades completadas"
          />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi etiqueta="Cumplimiento" insignia="Global" valor={`${stats.cumplimiento}%`} detalle={`${stats.cerradas} de ${stats.total} cerradas`} color="#6f9a10">
            <span className="barra my-1" role="progressbar" aria-valuenow={stats.cumplimiento} aria-valuemin={0} aria-valuemax={100} aria-label="Cumplimiento">
              <span style={{ width: `${stats.cumplimiento}%`, background: "#94c11f" }} />
            </span>
          </Kpi>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi
            etiqueta="Prioritarias"
            insignia="Alta"
            valor={stats.prioritarias}
            detalle={stats.vencidas ? `${stats.vencidas} vencida(s) en total` : "Alta prioridad abiertas"}
            color="#e11d48"
            activo={altaActiva}
            onClick={
              idAlta != null
                ? () => cambiarFiltros(altaActiva ? { prioridad: "", estado: "" } : { prioridad: String(idAlta), estado: ESTADO_ABIERTAS })
                : undefined
            }
            titulo="Filtrar actividades de prioridad Alta sin completar"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <section className="surface h-100 p-3 p-xl-4" aria-labelledby="titulo-estados">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 id="titulo-estados" className="h6 fw-bold mb-0 text-dark">
                  Distribución por estado
                </h2>
                <span className="text-secondary small">Selecciona un estado para filtrar</span>
              </div>
              {filtros.estado && (
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" onClick={() => cambiarFiltros({ estado: "" })}>
                  Quitar filtro
                </button>
              )}
            </div>

            <div className="row align-items-center g-3">
              <div className="col-sm-5 d-flex flex-column align-items-center">
                <Dona porEstado={stats.porEstado} total={stats.total} filtroEstado={filtros.estado} onSeleccionar={alternarEstado} />
                <div className="d-flex justify-content-center gap-3 mt-3 pt-2 border-top w-100" style={{ maxWidth: 210 }}>
                  <div className="text-center">
                    <div className="text-secondary mini-etiqueta">EN FLUJO</div>
                    <div className="fw-bold small">{stats.progreso + stats.pendientes}</div>
                  </div>
                  <div className="border-start" />
                  <div className="text-center">
                    <div className="text-secondary mini-etiqueta">RESUELTAS</div>
                    <div className="fw-bold small text-success">{stats.cerradas}</div>
                  </div>
                </div>
              </div>
              <div className="col-sm-7 d-flex flex-column gap-2">
                {stats.porEstado.map((estado) => {
                  const activo = filtros.estado === String(estado.id);
                  return (
                    <button
                      key={estado.id}
                      type="button"
                      className={`fila-interactiva ${activo ? "activo" : ""}`}
                      aria-pressed={activo}
                      onClick={() => alternarEstado(estado.id)}
                    >
                      <span className="d-flex justify-content-between align-items-center small mb-1 gap-2">
                        <span className="d-flex align-items-center gap-2 fw-semibold">
                          <span className="punto" style={{ background: estado.color }} aria-hidden="true" />
                          {estado.nombre}
                        </span>
                        <span className="fw-bold">
                          {estado.cantidad} <span className="fw-normal text-secondary">({Math.round(estado.fraccion)}%)</span>
                        </span>
                      </span>
                      <span className="barra">
                        <span style={{ width: `${estado.fraccion}%`, background: estado.color }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="col-lg-6">
          <section className="surface h-100 p-3 p-xl-4" aria-labelledby="titulo-categorias">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 id="titulo-categorias" className="h6 fw-bold mb-0 text-dark">
                  Actividades por categoría
                </h2>
                <span className="text-secondary small">Selecciona una categoría para filtrar</span>
              </div>
              {filtros.categoria && (
                <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" onClick={() => cambiarFiltros({ categoria: "" })}>
                  Quitar filtro
                </button>
              )}
            </div>
            {stats.porCategoria.length === 0 ? (
              <EstadoVacio compacto icono="grid" titulo="Sin datos por categoría" texto="No hay actividades que coincidan con los filtros actuales." />
            ) : (
              <div className="d-flex flex-column gap-2">
                {stats.porCategoria.map((categoria) => {
                  const activo = filtros.categoria === String(categoria.id);
                  return (
                    <button
                      key={categoria.id}
                      type="button"
                      className={`fila-interactiva ${activo ? "activo" : ""}`}
                      aria-pressed={activo}
                      onClick={() => alternarCategoria(categoria.id)}
                    >
                      <span className="d-flex justify-content-between small mb-1 gap-2">
                        <span className="fw-semibold d-flex align-items-center gap-2">
                          <span className="punto" style={{ background: categoria.color }} aria-hidden="true" />
                          {categoria.nombre}
                        </span>
                        <span className="text-secondary fw-semibold">
                          {categoria.cantidad} act. ({Math.round(categoria.fraccion)}%)
                        </span>
                      </span>
                      <span className="barra">
                        <span style={{ width: `${categoria.fraccion}%`, background: categoria.color }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <section className="surface p-3 p-xl-4 h-100" aria-labelledby="titulo-personas">
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
              <h2 id="titulo-personas" className="h6 fw-bold mb-0">
                Avance individual por persona
              </h2>
              <span className="text-secondary small">Cumplimiento de lo asignado</span>
            </div>
            {stats.porPersona.length === 0 ? (
              <EstadoVacio compacto icono="userPlus" titulo="No hay personas registradas" />
            ) : (
              <div className="d-flex flex-column gap-2">
                {stats.porPersona.map(({ usuario, total, listas, porcentaje }) => {
                  const activo = filtros.persona === String(usuario.id);
                  return (
                    <button
                      key={usuario.id}
                      type="button"
                      className={`fila-interactiva fila-persona ${activo ? "activo" : ""} ${total === 0 ? "atenuada" : ""}`}
                      aria-pressed={activo}
                      onClick={() => alternarPersona(usuario.id)}
                      title={`Filtrar actividades de ${usuario.nombre}`}
                    >
                      <Avatar nombre={usuario.nombre} />
                      <span className="flex-grow-1 min-w-0">
                        <span className="d-flex justify-content-between small mb-1 gap-2">
                          <span className="fw-semibold text-truncate">
                            {usuario.nombre}
                            {usuario.es_admin && <span className="badge-admin ms-2">Admin</span>}
                          </span>
                          <span className="text-secondary text-nowrap">
                            {total ? (
                              <>
                                <strong className="text-dark">{listas}</strong>/{total} · {porcentaje}%
                              </>
                            ) : (
                              "Sin asignaciones"
                            )}
                          </span>
                        </span>
                        <span className="barra">
                          <span
                            style={{
                              width: `${porcentaje}%`,
                              background: porcentaje === 100 ? "#94c11f" : porcentaje > 50 ? "#f07d00" : "#f59e0b",
                            }}
                          />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="col-lg-5 d-flex flex-column gap-3">
          <section className="surface p-3 p-xl-4" aria-labelledby="titulo-atencion">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 id="titulo-atencion" className="h6 fw-bold mb-0">
                Para revisar
              </h2>
              <span className={`badge rounded-pill ${stats.atencion.length ? "text-bg-warning" : "text-bg-light border"}`}>{stats.atencion.length}</span>
            </div>
            {stats.atencion.length === 0 ? (
              <EstadoVacio compacto icono="check" titulo="Todo al día" texto="No hay actividades vencidas ni en espera." />
            ) : (
              <ul className="list-unstyled mb-0 lista-scroll">
                {stats.atencion.map((item) => {
                  const vencida = vencidaIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <button type="button" className="fila-atencion" onClick={() => onAbrir(item)}>
                        <span className="min-w-0">
                          <span className="d-block fw-semibold small text-truncate">
                            {item.clave} · {item.titulo}
                          </span>
                          <span className="d-block text-secondary mini-texto">
                            {fechaRelativa(item.fecha)} · hasta {item.hora_fin} · {item.asignado_a?.nombre || "Sin asignar"}
                          </span>
                        </span>
                        <span className={`chip ${vencida ? "chip-peligro" : "chip-aviso"}`}>{vencida ? "Vencida" : item.estado.nombre}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="surface p-3 p-xl-4" aria-labelledby="titulo-historial">
            <h2 id="titulo-historial" className="h6 fw-bold mb-2">
              Movimientos recientes
            </h2>
            {historial.length === 0 ? (
              <EstadoVacio compacto icono="clock" titulo="Sin movimientos" texto="Todavía no hay cambios registrados." />
            ) : (
              <ol className="list-unstyled mb-0 linea-tiempo">
                {historial.slice(0, 6).map((fila) => (
                  <li key={fila.id}>
                    <div className="small">
                      <strong>{fila.clave}</strong> <span className="chip">{ETIQUETA_CAMPO[fila.campo] || fila.campo}</span>{" "}
                      {fila.valor_anterior ? `${fila.valor_anterior} → ` : ""}
                      <span className="text-primary-emphasis fw-semibold">{fila.valor_nuevo}</span>
                    </div>
                    <div className="text-secondary mini-texto">
                      Por {fila.autor || "Sistema"} · <time dateTime={fila.creado_en}>{formatearFechaHora(fila.creado_en)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default memo(Resumen);
