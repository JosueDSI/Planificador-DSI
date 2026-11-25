import { useState } from "react";
import { api } from "../api";
import Icono from "./Icono";
import Modal from "./Modal";
import { BotonCarga, CampoClave } from "./ui";

const MIN_CLAVE = 8;
const USUARIO_VACIO = { nombre: "", email: "", puesto_id: "", clave: "", es_admin: false };

function Mensajes({ error, exito }) {
  return (
    <>
      {error && (
        <div className="alert alert-danger py-2 small d-flex gap-2" role="alert">
          <Icono nombre="alert" className="mt-1" />
          <span>{error}</span>
        </div>
      )}
      {exito && (
        <div className="alert alert-success py-2 small d-flex gap-2" role="status">
          <Icono nombre="check" className="mt-1" />
          <span>{exito}</span>
        </div>
      )}
    </>
  );
}

export function CrearUsuarioModal({ puestos, onCerrar, onCreado }) {
  const [datos, setDatos] = useState(USUARIO_VACIO);
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const sinPuestos = !puestos?.length;
  const claveCorta = datos.clave.length > 0 && datos.clave.length < MIN_CLAVE;

  const actualizar = (campo) => (evento) => {
    const valor = evento.target.type === "checkbox" ? evento.target.checked : evento.target.value;
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setExito("");
  };

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando || sinPuestos || claveCorta) return;
    setEnviando(true);
    setError("");
    setExito("");
    try {
      const email = datos.email.trim().toLowerCase();
      const creado = await api.crearUsuario({
        nombre: datos.nombre.trim(),
        email,
        usuario_acceso: email,
        puesto_id: datos.puesto_id ? Number(datos.puesto_id) : null,
        clave: datos.clave,
        es_admin: datos.es_admin,
      });
      setExito(`Usuario ${creado?.nombre || datos.nombre.trim()} creado. Ya puede iniciar sesión con ${email}.`);
      setDatos(USUARIO_VACIO);
      onCreado?.(creado);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Crear usuario"
      subtitulo="Da de alta a una persona del área"
      onCerrar={() => !enviando && onCerrar()}
      onSubmit={enviar}
      ancho={520}
      pie={
        <div className="d-flex justify-content-end gap-2 w-100">
          <button type="button" className="btn btn-light btn-sm" onClick={onCerrar} disabled={enviando}>
            Cerrar
          </button>
          <BotonCarga type="submit" className="btn btn-primary btn-sm px-3" cargando={enviando} textoCargando="Creando…" disabled={sinPuestos || claveCorta}>
            Crear usuario
          </BotonCarga>
        </div>
      }
    >
      <Mensajes error={error} exito={exito} />
      {sinPuestos && (
        <div className="alert alert-warning py-2 small" role="alert">
          No se pudieron cargar los puestos. Recarga la página antes de crear usuarios.
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="nu-nombre" className="form-label small">
          Nombre y apellido *
        </label>
        <input id="nu-nombre" className="form-control" required minLength={2} maxLength={120} autoComplete="off" placeholder="Ej. Ana Martínez" value={datos.nombre} onChange={actualizar("nombre")} />
      </div>
      <div className="mb-3">
        <label htmlFor="nu-email" className="form-label small">
          Correo corporativo *
        </label>
        <input
          id="nu-email"
          type="email"
          className="form-control"
          required
          maxLength={160}
          autoComplete="off"
          placeholder="usuario@amphos21.com"
          value={datos.email}
          onChange={actualizar("email")}
          aria-describedby="nu-email-ayuda"
        />
        <div id="nu-email-ayuda" className="form-text mini-texto">
          Será su identificador para iniciar sesión.
        </div>
      </div>
      <div className="mb-3">
        <label htmlFor="nu-puesto" className="form-label small">
          Puesto / Cargo *
        </label>
        <select id="nu-puesto" className="form-select" required disabled={sinPuestos} value={datos.puesto_id} onChange={actualizar("puesto_id")}>
          <option value="">Selecciona un puesto…</option>
          {(puestos || []).map((puesto) => (
            <option key={puesto.id} value={puesto.id}>
              {puesto.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="nu-clave" className="form-label small">
          Contraseña inicial *
        </label>
        <CampoClave
          id="nu-clave"
          required
          minLength={MIN_CLAVE}
          autoComplete="new-password"
          placeholder="••••••••"
          value={datos.clave}
          visible={verClave}
          invalido={claveCorta}
          onAlternar={() => setVerClave((v) => !v)}
          onChange={actualizar("clave")}
          aria-describedby="nu-clave-ayuda"
        />
        <div id="nu-clave-ayuda" className={`form-text mini-texto ${claveCorta ? "text-danger" : ""}`}>
          Mínimo {MIN_CLAVE} caracteres. Compártela por un canal seguro.
        </div>
      </div>
      <div className="form-check">
        <input type="checkbox" className="form-check-input" id="nu-admin" checked={datos.es_admin} onChange={actualizar("es_admin")} />
        <label className="form-check-label small" htmlFor="nu-admin">
          Privilegios de administrador (gestión de usuarios y asignaciones)
        </label>
      </div>
    </Modal>
  );
}

export function RestablecerClaveModal({ usuarios, onCerrar }) {
  const [datos, setDatos] = useState({ usuario_id: "", nueva_clave: "", confirmar: "" });
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const claveCorta = datos.nueva_clave.length > 0 && datos.nueva_clave.length < MIN_CLAVE;
  const noCoincide = datos.confirmar.length > 0 && datos.confirmar !== datos.nueva_clave;

  const actualizar = (campo) => (evento) => {
    setDatos((previo) => ({ ...previo, [campo]: evento.target.value }));
    setExito("");
  };

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando || claveCorta || noCoincide || !datos.confirmar) return;
    setEnviando(true);
    setError("");
    setExito("");
    try {
      const respuesta = await api.recuperarClave(Number(datos.usuario_id), datos.nueva_clave);
      setExito(respuesta?.mensaje || "Contraseña restablecida con éxito");
      setDatos({ usuario_id: "", nueva_clave: "", confirmar: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Restablecer contraseña"
      subtitulo="Asigna una nueva contraseña a una persona del área"
      onCerrar={() => !enviando && onCerrar()}
      onSubmit={enviar}
      ancho={500}
      pie={
        <div className="d-flex justify-content-end gap-2 w-100">
          <button type="button" className="btn btn-light btn-sm" onClick={onCerrar} disabled={enviando}>
            Cerrar
          </button>
          <BotonCarga type="submit" className="btn btn-primary btn-sm px-3" cargando={enviando} textoCargando="Guardando…" disabled={claveCorta || noCoincide}>
            Guardar contraseña
          </BotonCarga>
        </div>
      }
    >
      <Mensajes error={error} exito={exito} />
      <div className="mb-3">
        <label htmlFor="rc-usuario" className="form-label small">
          Persona *
        </label>
        <select id="rc-usuario" className="form-select" required value={datos.usuario_id} onChange={actualizar("usuario_id")}>
          <option value="">Selecciona una persona…</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre} ({usuario.email || usuario.usuario_acceso})
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="rc-clave" className="form-label small">
          Nueva contraseña *
        </label>
        <CampoClave
          id="rc-clave"
          required
          minLength={MIN_CLAVE}
          autoComplete="new-password"
          placeholder="••••••••"
          value={datos.nueva_clave}
          visible={verClave}
          invalido={claveCorta}
          onAlternar={() => setVerClave((v) => !v)}
          onChange={actualizar("nueva_clave")}
          aria-describedby="rc-clave-ayuda"
        />
        <div id="rc-clave-ayuda" className={`form-text mini-texto ${claveCorta ? "text-danger" : ""}`}>
          Mínimo {MIN_CLAVE} caracteres.
        </div>
      </div>
      <div className="mb-1">
        <label htmlFor="rc-confirmar" className="form-label small">
          Confirmar contraseña *
        </label>
        <input
          id="rc-confirmar"
          type={verClave ? "text" : "password"}
          className={`form-control ${noCoincide ? "is-invalid" : ""}`}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={datos.confirmar}
          onChange={actualizar("confirmar")}
          aria-invalid={noCoincide || undefined}
        />
        {noCoincide && <div className="invalid-feedback">Las contraseñas no coinciden.</div>}
      </div>
    </Modal>
  );
}
