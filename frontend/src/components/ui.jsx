import Icono from "./Icono";
import { iniciales } from "../utils";

// Botón que bloquea el doble envío y muestra un spinner mientras la acción está en curso.
export function BotonCarga({ cargando = false, textoCargando, children, disabled, className = "btn btn-primary", type = "button", ...resto }) {
  return (
    <button type={type} className={className} {...resto} disabled={disabled || cargando} aria-busy={cargando || undefined}>
      {cargando && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  );
}

export function EstadoVacio({ icono = "inbox", titulo, texto, children, compacto = false }) {
  return (
    <div className={`estado-vacio ${compacto ? "compacto" : ""}`}>
      <span className="estado-vacio-icono">
        <Icono nombre={icono} tam={compacto ? 18 : 26} />
      </span>
      {titulo && <p className="estado-vacio-titulo">{titulo}</p>}
      {texto && <p className="estado-vacio-texto">{texto}</p>}
      {children}
    </div>
  );
}

export function Avatar({ nombre, tam = "md" }) {
  return (
    <span className={`avatar avatar-${tam}`} title={nombre} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}

export function CampoClave({ id, value, onChange, visible, onAlternar, invalido = false, ...resto }) {
  return (
    <div className="input-group">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={`form-control ${invalido ? "is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        aria-invalid={invalido || undefined}
        {...resto}
      />
      <button
        type="button"
        className="btn btn-outline-secondary btn-ojo"
        onClick={onAlternar}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        <Icono nombre={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

export function PilaAvisos({ avisos, onCerrar }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id} className={`toast-item toast-${aviso.tipo}`}>
          <Icono nombre={aviso.tipo === "error" ? "alert" : "check"} tam={18} />
          <span className="flex-grow-1">{aviso.texto}</span>
          <button type="button" className="btn-cerrar-toast" aria-label="Cerrar aviso" onClick={() => onCerrar(aviso.id)}>
            <Icono nombre="x" tam={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
