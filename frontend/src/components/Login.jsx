import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Icono from "./Icono";
import { CampoClave } from "./ui";

export default function Login({ onLogin, avisoConexion, onReintentarConexion }) {
  const [datos, setDatos] = useState({ identificador: "", clave: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const intervalo = useRef(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      clearInterval(intervalo.current);
    };
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    if (cargando) return;
    setError("");
    setCargando(true);
    setProgreso(12);

    // Física de fluido que va llenando el logo en base a la duración de la carga
    clearInterval(intervalo.current);
    intervalo.current = setInterval(() => {
      setProgreso((previo) => (previo >= 86 ? previo : Math.min(86, previo + Math.max(1, Math.floor((88 - previo) * 0.16)))));
    }, 70);

    try {
      const respuesta = await api.login(datos.identificador.trim(), datos.clave);
      clearInterval(intervalo.current);
      setProgreso(100);
      // Breve pausa para apreciar el llenado total del logo
      await new Promise((resolver) => setTimeout(resolver, 450));
      if (montado.current) onLogin(respuesta.usuario);
    } catch (err) {
      clearInterval(intervalo.current);
      if (!montado.current) return;
      setProgreso(0);
      setCargando(false);
      setDatos((previo) => ({ ...previo, clave: "" }));
      setError(err.message || "No se pudo iniciar sesión");
    }
  }

  const detectarMayusculas = (evento) => setMayusculas(Boolean(evento.getModifierState?.("CapsLock")));

  return (
    <main className="login-fondo">
      <div className="login-tarjeta">
        {cargando ? (
          <div className="py-4 d-flex flex-column align-items-center justify-content-center" role="status" aria-live="polite">
            <div className="liquid-symbol-stage slosh-physics">
              {/* Silueta base del isotipo como recipiente de cristal */}
              <img src="/static/amphos21-symbol.png" alt="" className="symbol-ghost" />
              {/* Contenedor con máscara exacta a la silueta del isotipo A21 */}
              <div
                className="symbol-liquid-mask"
                style={{ WebkitMaskImage: "url(/static/amphos21-symbol.png)", maskImage: "url(/static/amphos21-symbol.png)" }}
              >
                {/* Nivel de líquido ascendente con física */}
                <div className="liquid-water-reservoir" style={{ height: `${progreso}%` }}>
                  <div className="liquid-wave-surface">
                    <svg className="liquid-wave wave-back" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0,25 C150,90 350,-20 500,45 C650,110 900,10 1200,35 L1200,120 L0,120 Z" />
                    </svg>
                    <svg className="liquid-wave wave-front" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0,40 C200,105 450,-15 700,55 C900,110 1050,20 1200,45 L1200,120 L0,120 Z" />
                    </svg>
                  </div>
                  <div className="liquid-bubble" style={{ width: 8, height: 8, left: "26%", animationDelay: "0s" }} />
                  <div className="liquid-bubble" style={{ width: 11, height: 11, left: "52%", animationDelay: "0.6s" }} />
                  <div className="liquid-bubble" style={{ width: 7, height: 7, left: "74%", animationDelay: "1.1s" }} />
                </div>
              </div>
            </div>
            <p className="small text-secondary mb-0 mt-2">Verificando credenciales…</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <img src="/static/amphos21-logo.png" alt="Amphos 21 - an RSK company" className="mb-3 login-logo" />
              <h1 className="h4 fw-bold mb-1 text-dark">Planificador DSI</h1>
              <p className="text-secondary small mb-0">Departamento de Sistemas e Informática</p>
            </div>

            {avisoConexion && (
              <div className="alert alert-warning py-2 small d-flex align-items-start gap-2" role="alert">
                <Icono nombre="alert" className="mt-1" />
                <div className="flex-grow-1">
                  {avisoConexion}
                  {onReintentarConexion && (
                    <button type="button" className="btn btn-link btn-sm p-0 ms-1 align-baseline" onClick={onReintentarConexion}>
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="alert alert-danger py-2 small d-flex align-items-start gap-2" role="alert">
                <Icono nombre="alert" className="mt-1" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={enviar}>
              <div className="mb-3">
                <label htmlFor="login-usuario" className="form-label small fw-semibold text-secondary">
                  Correo corporativo o usuario
                </label>
                <input
                  id="login-usuario"
                  className="form-control"
                  required
                  autoFocus
                  autoComplete="username"
                  inputMode="email"
                  placeholder="usuario@amphos21.com"
                  value={datos.identificador}
                  onChange={(evento) => setDatos((previo) => ({ ...previo, identificador: evento.target.value }))}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="login-clave" className="form-label small fw-semibold text-secondary">
                  Contraseña
                </label>
                <CampoClave
                  id="login-clave"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={datos.clave}
                  visible={verClave}
                  onAlternar={() => setVerClave((v) => !v)}
                  onChange={(evento) => setDatos((previo) => ({ ...previo, clave: evento.target.value }))}
                  onKeyDown={detectarMayusculas}
                  onKeyUp={detectarMayusculas}
                  aria-describedby={mayusculas ? "login-mayus" : undefined}
                />
                {mayusculas && (
                  <div id="login-mayus" className="form-text text-warning-emphasis d-flex align-items-center gap-1">
                    <Icono nombre="alert" tam={13} /> Bloq Mayús está activado
                  </div>
                )}
              </div>
              <button className="btn btn-primary w-100 py-2" type="submit" disabled={!datos.identificador.trim() || !datos.clave}>
                Iniciar sesión
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
