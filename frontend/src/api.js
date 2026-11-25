const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "dsi_token";

let tokenMemoria = null;

export function setAuthToken(token) {
  tokenMemoria = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage no disponible */
  }
}

export function getAuthToken() {
  if (tokenMemoria) return tokenMemoria;
  try {
    tokenMemoria = localStorage.getItem(TOKEN_KEY);
  } catch {
    tokenMemoria = null;
  }
  return tokenMemoria;
}

export function clearAuthToken() {
  setAuthToken(null);
}

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

const TIEMPO_LIMITE_MS = 15000;

async function pedir(ruta, opciones = {}) {
  const { headers, timeout = TIEMPO_LIMITE_MS, ...resto } = opciones;
  const token = getAuthToken();
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), timeout);

  const cabeceras = { "Content-Type": "application/json", ...headers };
  if (token) {
    cabeceras["Authorization"] = `Bearer ${token}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, {
      headers: cabeceras,
      signal: control.signal,
      ...resto,
    });
  } catch (err) {
    throw new Error(
      err?.name === "AbortError"
        ? "El servidor tardó demasiado en responder. Inténtalo de nuevo."
        : "No se pudo conectar con el servidor. Revisa tu conexión."
    );
  } finally {
    clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && !ruta.includes("/login")) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent("dsi:unauthorized"));
    }
    let detalle = respuesta.status >= 500 ? `Error interno del servidor (${respuesta.status}). Inténtalo de nuevo.` : "No se pudo completar la operación";
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
  me: () => pedir("/api/me"),
  area: () => pedir("/api/area"),
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
  login: async (identificador, clave) => {
    const res = await pedir("/api/login", {
      method: "POST",
      body: JSON.stringify({ identificador, clave }),
    });
    if (res?.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  crearUsuario: (datos) => pedir("/api/usuarios", { method: "POST", body: JSON.stringify(datos) }),
  recuperarClave: (usuarioId, nuevaClave) =>
    pedir("/api/usuarios/recuperar-clave", {
      method: "POST",
      body: JSON.stringify({ usuario_id: usuarioId, nueva_clave: nuevaClave }),
    }),
};
