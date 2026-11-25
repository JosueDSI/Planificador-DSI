import { useEffect, useId, useRef } from "react";

const SELECTOR_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sinEnvio = (evento) => evento.preventDefault();

/**
 * Diálogo accesible: role="dialog", aria-modal, cierre con Escape, foco inicial,
 * foco atrapado con Tab, bloqueo del scroll del fondo y devolución del foco al cerrar.
 * `onCerrar` lo decide el padre (p. ej. para confirmar si hay cambios sin guardar).
 */
export default function Modal({ titulo, subtitulo, onCerrar, onSubmit = sinEnvio, pie, children, ancho = 560 }) {
  const idTitulo = useId();
  const dialogo = useRef(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    const previo = document.activeElement;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const nodo = dialogo.current;
    const inicial =
      nodo?.querySelector("[data-autofocus]") ||
      [...(nodo?.querySelectorAll(SELECTOR_FOCO) || [])].find((el) => !el.closest(".modal-header"));
    inicial?.focus();

    function alPresionar(evento) {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        cerrarRef.current?.();
        return;
      }
      if (evento.key !== "Tab" || !nodo) return;
      const focos = [...nodo.querySelectorAll(SELECTOR_FOCO)].filter((el) => el.offsetParent !== null);
      if (!focos.length) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alPresionar);
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowPrevio;
      if (previo && typeof previo.focus === "function" && previo.isConnected) previo.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop-custom"
      // mousedown (no click) evita cerrar al soltar fuera una selección de texto iniciada dentro.
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrarRef.current?.();
      }}
    >
      <div ref={dialogo} className="dialogo" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <form className="modal-solido" onSubmit={onSubmit}>
          <div className="modal-header d-flex justify-content-between align-items-start gap-3 p-3 px-4">
            <div className="min-w-0">
              <h2 id={idTitulo} className="modal-title h5 fw-bold mb-0 text-dark">
                {titulo}
              </h2>
              {subtitulo && <div className="small text-secondary mt-1">{subtitulo}</div>}
            </div>
            <button type="button" className="btn-close mt-1" aria-label="Cerrar" onClick={() => cerrarRef.current?.()} />
          </div>
          <div className="modal-body p-4">{children}</div>
          {pie && <div className="modal-footer p-3 px-4">{pie}</div>}
        </form>
      </div>
    </div>
  );
}
