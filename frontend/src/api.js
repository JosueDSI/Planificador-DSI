const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function formatearDetalle(detail) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean)
      .join(". ");
  }
  return "";
}

async function pedir(ruta, opciones = {}) {
  const { headers, ...resto } = opciones;
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...resto,
  });
  if (!respuesta.ok) {
    let detalle = "No se pudo completar la operación";
    try {
      const cuerpo = await respuesta.json();
      detalle = formatearDetalle(cuerpo.detail) || detalle;
    } catch {
      /* la respuesta no trae JSON */
    }
    throw new Error(detalle);
  }
  if (respuesta.status === 204) return null;
  return respuesta.json();
}

export const api = {
  inicio: () =>
    Promise.all([
      pedir("/api/area"),
      pedir("/api/usuarios"),
      pedir("/api/categorias"),
      pedir("/api/prioridades"),
      pedir("/api/estados"),
      pedir("/api/actividades"),
      pedir("/api/historial"),
      pedir("/api/puestos").catch(() => []),
    ]).then(([area, usuarios, categorias, prioridades, estados, actividades, historial, puestos]) => ({
      area,
      usuarios,
      categorias,
      prioridades,
      estados,
      actividades,
      historial,
      puestos: puestos || [],
    })),
  crear: (datos) => pedir("/api/actividades", { method: "POST", body: JSON.stringify(datos) }),
  guardar: (id, datos) => pedir(`/api/actividades/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  mover: (id, estadoId, autorId) =>
    pedir(`/api/actividades/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado_id: estadoId, autor_id: autorId }),
    }),
  comentar: (id, autorId, cuerpo) =>
    pedir(`/api/actividades/${id}/comentarios`, {
      method: "POST",
      body: JSON.stringify({ autor_id: autorId, cuerpo }),
    }),
  eliminar: (id) => pedir(`/api/actividades/${id}`, { method: "DELETE" }),
  historial: () => pedir("/api/historial"),
  login: (identificador, clave) => pedir("/api/login", { method: "POST", body: JSON.stringify({ identificador, clave }) }),
  crearUsuario: (datos) => pedir("/api/usuarios", { method: "POST", body: JSON.stringify(datos) }),
  recuperarClave: (usuarioId, nuevaClave) =>
    pedir("/api/usuarios/recuperar-clave", {
      method: "POST",
      body: JSON.stringify({ usuario_id: usuarioId, nueva_clave: nuevaClave }),
    }),
};
