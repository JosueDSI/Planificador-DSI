// Utilidades puras de la capa de interfaz (sin dependencias de React).

export const ESTADO_PENDIENTES = "pendientes"; // por_hacer + en_espera
export const ESTADO_ABIERTAS = "abiertas"; // cualquier estado que no sea de cierre
export const PERSONA_SIN_ASIGNAR = "sin";
export const FILTROS_VACIOS = { q: "", categoria: "", prioridad: "", persona: "", estado: "" };

const dosDigitos = (numero) => String(numero).padStart(2, "0");

export const aIso = (fecha) => `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
export const hoyIso = () => aIso(new Date());

function fechaLocal(iso) {
  if (!iso) return null;
  const fecha = new Date(`${iso}T00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function desplazarDia(iso, dias) {
  const fecha = fechaLocal(iso) ?? new Date();
  fecha.setDate(fecha.getDate() + dias);
  return aIso(fecha);
}

export function minutos(hora) {
  if (typeof hora !== "string" || !hora.includes(":")) return 0;
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

export const duracion = (actividad) => Math.max(0, minutos(actividad.hora_fin) - minutos(actividad.hora_inicio));

export function formatoDuracion(total) {
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return horas ? `${horas}h ${dosDigitos(resto)}m` : `${resto}m`;
}

export function esVencida(actividad, ahora = Date.now()) {
  if (!actividad?.estado || actividad.estado.es_cierre) return false;
  const fin = new Date(`${actividad.fecha}T${actividad.hora_fin}`).getTime();
  return Number.isFinite(fin) && fin < ahora;
}

const fmtCorta = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short" });
const fmtLarga = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function formatearFecha(iso) {
  const fecha = fechaLocal(iso);
  return fecha ? fmtCorta.format(fecha) : iso || "";
}

export function formatearFechaLarga(iso) {
  const fecha = fechaLocal(iso);
  if (!fecha) return iso || "";
  const texto = fmtLarga.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatearFechaHora(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fmtFechaHora.format(fecha);
}

export function fechaRelativa(iso) {
  const hoy = hoyIso();
  if (iso === hoy) return "Hoy";
  if (iso === desplazarDia(hoy, 1)) return "Mañana";
  if (iso === desplazarDia(hoy, -1)) return "Ayer";
  return formatearFecha(iso);
}

export function iniciales(nombre = "") {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return partes.map((parte) => parte[0].toUpperCase()).join("") || "?";
}

let secuencia = 0;
export const nuevaClave = () => `tmp-${Date.now().toString(36)}-${(secuencia += 1).toString(36)}`;

const COLOR_COLUMNA = {
  completado: "#94c11f",
  en_progreso: "#f07d00",
  en_espera: "#f59e0b",
  por_hacer: "#7f7f7e",
};
export const colorEstado = (estado) => COLOR_COLUMNA[estado?.columna] ?? "#7f7f7e";

export const CLASE_PRIORIDAD = { Alta: "prioridad-alta", Media: "prioridad-media", Baja: "prioridad-baja" };

export function coincideEstado(actividad, filtro) {
  if (!filtro) return true;
  if (filtro === ESTADO_PENDIENTES) return actividad.estado?.columna === "por_hacer" || actividad.estado?.columna === "en_espera";
  if (filtro === ESTADO_ABIERTAS) return !actividad.estado?.es_cierre;
  return actividad.estado?.id === Number(filtro);
}

export function coincidePersona(actividad, filtro) {
  if (!filtro) return true;
  if (filtro === PERSONA_SIN_ASIGNAR) return !actividad.asignado_a;
  return actividad.asignado_a?.id === Number(filtro);
}

export function ordenarActividades(lista) {
  return [...lista].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio) || a.posicion - b.posicion
  );
}

export function calcularResumen(visibles, catalogo, vencidaIds) {
  const total = visibles.length;
  let cerradas = 0;
  let progreso = 0;
  let pendientes = 0;
  let prioritarias = 0;
  let vencidas = 0;
  const conteoEstado = new Map();
  const conteoCategoria = new Map();
  const conteoPersona = new Map();
  const atencion = [];

  for (const actividad of visibles) {
    const cierre = actividad.estado.es_cierre;
    const columna = actividad.estado.columna;
    const vencida = vencidaIds.has(actividad.id);
    if (cierre) cerradas += 1;
    if (columna === "en_progreso") progreso += 1;
    if (columna === "por_hacer" || columna === "en_espera") pendientes += 1;
    if (actividad.prioridad.nombre === "Alta" && !cierre) prioritarias += 1;
    if (vencida) vencidas += 1;
    if (vencida || columna === "en_espera") atencion.push(actividad);
    conteoEstado.set(actividad.estado.id, (conteoEstado.get(actividad.estado.id) || 0) + 1);
    conteoCategoria.set(actividad.categoria.id, (conteoCategoria.get(actividad.categoria.id) || 0) + 1);
    if (actividad.asignado_a) {
      const previo = conteoPersona.get(actividad.asignado_a.id) || { total: 0, listas: 0 };
      conteoPersona.set(actividad.asignado_a.id, { total: previo.total + 1, listas: previo.listas + (cierre ? 1 : 0) });
    }
  }

  // Proporción exacta (sin redondeo) para que los arcos de la dona sumen 100.
  const fraccion = (cantidad) => (total ? (cantidad * 100) / total : 0);

  const porEstado = (catalogo?.estados || []).map((estado) => {
    const cantidad = conteoEstado.get(estado.id) || 0;
    return { ...estado, cantidad, fraccion: fraccion(cantidad), color: colorEstado(estado) };
  });

  const porCategoria = (catalogo?.categorias || [])
    .map((categoria) => {
      const cantidad = conteoCategoria.get(categoria.id) || 0;
      return { ...categoria, cantidad, fraccion: fraccion(cantidad) };
    })
    .filter((categoria) => categoria.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  const porPersona = (catalogo?.usuarios || []).map((usuario) => {
    const datos = conteoPersona.get(usuario.id) || { total: 0, listas: 0 };
    return { usuario, ...datos, porcentaje: datos.total ? Math.round((datos.listas * 100) / datos.total) : 0 };
  });

  atencion.sort(
    (a, b) =>
      Number(vencidaIds.has(b.id)) - Number(vencidaIds.has(a.id)) ||
      a.fecha.localeCompare(b.fecha) ||
      a.hora_fin.localeCompare(b.hora_fin)
  );

  return {
    total,
    cerradas,
    progreso,
    pendientes,
    prioritarias,
    vencidas,
    cumplimiento: total ? Math.round((cerradas * 100) / total) : 0,
    porEstado,
    porCategoria,
    porPersona,
    atencion,
  };
}

export function aFormulario(actividad, catalogo, usuarioActual) {
  if (!actividad) {
    return {
      titulo: "",
      descripcion: "",
      observaciones: "",
      categoria_id: catalogo.categorias[0]?.id ?? "",
      prioridad_id: catalogo.prioridades.find((item) => item.nombre === "Media")?.id ?? catalogo.prioridades[0]?.id ?? "",
      estado_id: catalogo.estados[0]?.id ?? "",
      fecha: hoyIso(),
      hora_inicio: "08:30",
      hora_fin: "09:30",
      reportado_por: usuarioActual?.id || catalogo.usuarios[0]?.id || "",
      asignado_a: "",
      checklist: [],
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
    checklist: actividad.checklist.map((item) => ({ ...item, _key: `id-${item.id}` })),
  };
}

export function aPayload(form) {
  return {
    titulo: form.titulo.trim(),
    descripcion: form.descripcion.trim(),
    observaciones: form.observaciones.trim(),
    categoria_id: Number(form.categoria_id),
    prioridad_id: Number(form.prioridad_id),
    estado_id: Number(form.estado_id),
    fecha: form.fecha,
    hora_inicio: form.hora_inicio,
    hora_fin: form.hora_fin,
    reportado_por: Number(form.reportado_por),
    asignado_a: form.asignado_a ? Number(form.asignado_a) : null,
    checklist: form.checklist
      // eslint-disable-next-line no-unused-vars
      .map(({ _key, ...item }) => ({ ...item, texto: item.texto.trim() }))
      .filter((item) => item.texto)
      .map((item, indice) => ({ ...item, orden: indice + 1 })),
  };
}
