from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .auth_utils import hashear_clave, verificar_clave
from .database import get_db
from .models import Actividad, Area, Categoria, Checklist, Comentario, Estado, Historial, Prioridad, Puesto, Usuario
from .schemas import ActividadIn, ComentarioIn, EstadoIn, LoginIn, RecuperarClaveIn, UsuarioCrearIn

router = APIRouter(prefix="/api")


def hhmm(valor: time) -> str:
    return valor.strftime("%H:%M")


def etiqueta_rol(usuario: Usuario) -> str | None:
    if usuario.puesto is None:
        return None
    return f"{usuario.puesto.nombre} ({usuario.area.clave})"


def usuario_json(usuario: Usuario) -> dict:
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "usuario_acceso": usuario.usuario_acceso,
        "email": usuario.email,
        "es_admin": bool(usuario.es_admin),
        "puesto_id": usuario.puesto_id,
        "puesto_nombre": usuario.puesto.nombre if usuario.puesto else None,
        "etiqueta_rol": etiqueta_rol(usuario),
    }


def actividad_json(actividad: Actividad) -> dict:
    area = actividad.area
    return {
        "id": actividad.id,
        "clave": f"{area.clave}-{actividad.numero}",
        "numero": actividad.numero,
        "titulo": actividad.titulo,
        "descripcion": actividad.descripcion,
        "observaciones": actividad.observaciones,
        "categoria": {"id": actividad.categoria.id, "nombre": actividad.categoria.nombre, "color": actividad.categoria.color},
        "prioridad": {"id": actividad.prioridad.id, "nombre": actividad.prioridad.nombre, "orden": actividad.prioridad.orden},
        "estado": {
            "id": actividad.estado.id,
            "nombre": actividad.estado.nombre,
            "columna": actividad.estado.columna,
            "orden": actividad.estado.orden,
            "es_cierre": actividad.estado.es_cierre,
        },
        "fecha": actividad.fecha.isoformat(),
        "hora_inicio": hhmm(actividad.hora_inicio),
        "hora_fin": hhmm(actividad.hora_fin),
        "reportado_por": usuario_json(actividad.solicitante),
        "asignado_a": usuario_json(actividad.responsable) if actividad.responsable else None,
        "posicion": actividad.posicion,
        "checklist": [
            {"id": item.id, "texto": item.texto, "hecho": item.hecho, "orden": item.orden}
            for item in actividad.checklist
        ],
        "comentarios": [
            {
                "id": nota.id,
                "cuerpo": nota.cuerpo,
                "creado_en": nota.creado_en.isoformat(timespec="minutes"),
                "autor": usuario_json(nota.autor),
            }
            for nota in actividad.comentarios
        ],
    }


def cargar_actividad(db: Session, actividad_id: int) -> Actividad:
    actividad = db.scalar(
        select(Actividad)
        .where(Actividad.id == actividad_id)
        .options(
            selectinload(Actividad.area),
            selectinload(Actividad.categoria),
            selectinload(Actividad.prioridad),
            selectinload(Actividad.estado),
            selectinload(Actividad.solicitante).selectinload(Usuario.puesto),
            selectinload(Actividad.solicitante).selectinload(Usuario.area),
            selectinload(Actividad.responsable).selectinload(Usuario.puesto),
            selectinload(Actividad.responsable).selectinload(Usuario.area),
            selectinload(Actividad.checklist),
            selectinload(Actividad.comentarios).selectinload(Comentario.autor).selectinload(Usuario.puesto),
            selectinload(Actividad.comentarios).selectinload(Comentario.autor).selectinload(Usuario.area),
        )
    )
    if actividad is None:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return actividad


def validar_horario(inicio: time, fin: time) -> None:
    if fin <= inicio:
        raise HTTPException(status_code=400, detail="La hora de fin debe ser posterior a la hora de inicio")


def area_activa(db: Session) -> Area:
    area = db.scalar(select(Area).where(Area.activa.is_(True)).limit(1))
    if area is None:
        raise HTTPException(status_code=404, detail="No hay un área configurada")
    return area


@router.get("/health")
def estado_salud():
    return {"status": "ok"}


@router.get("/area")
def obtener_area(db: Session = Depends(get_db)):
    area = area_activa(db)
    return {
        "id": area.id,
        "nombre": area.nombre,
        "clave": area.clave,
        "jornada_inicio": hhmm(area.jornada_inicio),
        "jornada_fin": hhmm(area.jornada_fin),
    }


@router.get("/puestos")
def listar_puestos(db: Session = Depends(get_db)):
    puestos = db.scalars(select(Puesto).where(Puesto.activo.is_(True)).order_by(Puesto.nombre)).all()
    return [{"id": puesto.id, "nombre": puesto.nombre} for puesto in puestos]


@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.scalars(
        select(Usuario)
        .where(Usuario.activo.is_(True))
        .options(selectinload(Usuario.puesto), selectinload(Usuario.area))
        .order_by(Usuario.nombre)
    ).all()
    return [usuario_json(usuario) for usuario in usuarios]


@router.post("/login")
def login(datos: LoginIn, db: Session = Depends(get_db)):
    ident = datos.identificador.strip().lower()
    usuario = db.scalar(
        select(Usuario)
        .where((Usuario.usuario_acceso == ident) | (Usuario.email == ident))
        .options(selectinload(Usuario.puesto), selectinload(Usuario.area))
    )
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not verificar_clave(datos.clave, usuario.hash_clave):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    return {
        "ok": True,
        "usuario": usuario_json(usuario),
    }


@router.post("/usuarios", status_code=201)
def crear_usuario(datos: UsuarioCrearIn, db: Session = Depends(get_db)):
    area = area_activa(db)
    user_email = datos.email.strip().lower()
    user_acc = (datos.usuario_acceso or user_email).strip().lower()

    if db.scalar(select(Usuario.id).where((Usuario.usuario_acceso == user_acc) | (Usuario.email == user_email))):
        raise HTTPException(status_code=400, detail="El correo o usuario ya está registrado")

    if datos.puesto_id is not None and db.get(Puesto, datos.puesto_id) is None:
        raise HTTPException(status_code=400, detail="Puesto seleccionado no existe")

    nuevo = Usuario(
        area_id=area.id,
        nombre=datos.nombre.strip(),
        usuario_acceso=user_acc,
        email=user_email,
        hash_clave=hashear_clave(datos.clave),
        puesto_id=datos.puesto_id,
        es_admin=datos.es_admin,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    creado = db.scalar(
        select(Usuario)
        .where(Usuario.id == nuevo.id)
        .options(selectinload(Usuario.puesto), selectinload(Usuario.area))
    )
    return usuario_json(creado)


@router.post("/usuarios/recuperar-clave")
def recuperar_clave(datos: RecuperarClaveIn, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, datos.usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.hash_clave = hashear_clave(datos.nueva_clave)
    db.commit()
    return {"ok": True, "mensaje": f"Contraseña actualizada para {usuario.nombre}"}


@router.get("/categorias")
def listar_categorias(db: Session = Depends(get_db)):
    categorias = db.scalars(select(Categoria).where(Categoria.activa.is_(True)).order_by(Categoria.nombre)).all()
    return [{"id": item.id, "nombre": item.nombre, "color": item.color} for item in categorias]


@router.get("/prioridades")
def listar_prioridades(db: Session = Depends(get_db)):
    prioridades = db.scalars(select(Prioridad).where(Prioridad.activa.is_(True)).order_by(Prioridad.orden)).all()
    return [{"id": item.id, "nombre": item.nombre, "orden": item.orden} for item in prioridades]


@router.get("/estados")
def listar_estados(db: Session = Depends(get_db)):
    estados = db.scalars(select(Estado).order_by(Estado.orden)).all()
    return [
        {"id": item.id, "nombre": item.nombre, "columna": item.columna, "orden": item.orden, "es_cierre": item.es_cierre}
        for item in estados
    ]


@router.get("/actividades")
def listar_actividades(db: Session = Depends(get_db)):
    actividades = db.scalars(
        select(Actividad)
        .options(
            selectinload(Actividad.area),
            selectinload(Actividad.categoria),
            selectinload(Actividad.prioridad),
            selectinload(Actividad.estado),
            selectinload(Actividad.solicitante).selectinload(Usuario.puesto),
            selectinload(Actividad.solicitante).selectinload(Usuario.area),
            selectinload(Actividad.responsable).selectinload(Usuario.puesto),
            selectinload(Actividad.responsable).selectinload(Usuario.area),
            selectinload(Actividad.checklist),
            selectinload(Actividad.comentarios).selectinload(Comentario.autor).selectinload(Usuario.puesto),
            selectinload(Actividad.comentarios).selectinload(Comentario.autor).selectinload(Usuario.area),
        )
        .order_by(Actividad.fecha, Actividad.hora_inicio, Actividad.posicion)
    ).all()
    return [actividad_json(actividad) for actividad in actividades]


@router.get("/historial")
def listar_historial(db: Session = Depends(get_db)):
    filas = db.scalars(
        select(Historial)
        .options(
            selectinload(Historial.autor),
            selectinload(Historial.actividad).selectinload(Actividad.area),
        )
        .order_by(Historial.creado_en.desc())
        .limit(8)
    ).all()
    return [
        {
            "id": fila.id,
            "campo": fila.campo,
            "valor_anterior": fila.valor_anterior,
            "valor_nuevo": fila.valor_nuevo,
            "creado_en": fila.creado_en.isoformat(timespec="minutes"),
            "autor": fila.autor.nombre if fila.autor else "",
            "clave": f"{fila.actividad.area.clave}-{fila.actividad.numero}",
            "titulo": fila.actividad.titulo,
        }
        for fila in filas
    ]


def exigir_usuario(db: Session, usuario_id: int, area_id: int) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.area_id != area_id:
        raise HTTPException(status_code=400, detail="La persona no pertenece al área")
    return usuario


@router.post("/actividades", status_code=201)
def crear_actividad(datos: ActividadIn, db: Session = Depends(get_db)):
    validar_horario(datos.hora_inicio, datos.hora_fin)
    area = area_activa(db)
    exigir_usuario(db, datos.reportado_por, area.id)
    if datos.asignado_a is not None:
        exigir_usuario(db, datos.asignado_a, area.id)
    if db.get(Categoria, datos.categoria_id) is None or db.get(Prioridad, datos.prioridad_id) is None or db.get(Estado, datos.estado_id) is None:
        raise HTTPException(status_code=400, detail="Categoría, prioridad o estado no válidos")

    actividad = Actividad(
        area_id=area.id,
        numero=area.siguiente_numero,
        titulo=datos.titulo.strip(),
        descripcion=datos.descripcion.strip(),
        observaciones=datos.observaciones.strip(),
        categoria_id=datos.categoria_id,
        prioridad_id=datos.prioridad_id,
        estado_id=datos.estado_id,
        fecha=datos.fecha,
        hora_inicio=datos.hora_inicio,
        hora_fin=datos.hora_fin,
        reportado_por=datos.reportado_por,
        asignado_a=datos.asignado_a,
        posicion=area.siguiente_numero,
    )
    area.siguiente_numero += 1
    for indice, item in enumerate(datos.checklist, start=1):
        actividad.checklist.append(Checklist(texto=item.texto.strip(), hecho=item.hecho, orden=indice))
    actividad.historial.append(Historial(autor_id=datos.reportado_por, campo="alta", valor_nuevo=actividad.titulo))
    db.add(actividad)
    db.commit()
    return actividad_json(cargar_actividad(db, actividad.id))


@router.put("/actividades/{actividad_id}")
def actualizar_actividad(actividad_id: int, datos: ActividadIn, db: Session = Depends(get_db)):
    validar_horario(datos.hora_inicio, datos.hora_fin)
    actividad = db.get(Actividad, actividad_id)
    if actividad is None:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    area = area_activa(db)
    exigir_usuario(db, datos.reportado_por, area.id)
    if datos.asignado_a is not None:
        exigir_usuario(db, datos.asignado_a, area.id)
    if db.get(Categoria, datos.categoria_id) is None or db.get(Prioridad, datos.prioridad_id) is None or db.get(Estado, datos.estado_id) is None:
        raise HTTPException(status_code=400, detail="Categoría, prioridad o estado no válidos")

    cambios = []
    if actividad.estado_id != datos.estado_id:
        anterior = db.get(Estado, actividad.estado_id)
        nuevo = db.get(Estado, datos.estado_id)
        cambios.append(("estado", anterior.nombre if anterior else "", nuevo.nombre))
    if actividad.asignado_a != datos.asignado_a:
        anterior = db.get(Usuario, actividad.asignado_a) if actividad.asignado_a else None
        nuevo = db.get(Usuario, datos.asignado_a) if datos.asignado_a else None
        cambios.append(("responsable", anterior.nombre if anterior else "Sin asignar", nuevo.nombre if nuevo else "Sin asignar"))

    actividad.titulo = datos.titulo.strip()
    actividad.descripcion = datos.descripcion.strip()
    actividad.observaciones = datos.observaciones.strip()
    actividad.categoria_id = datos.categoria_id
    actividad.prioridad_id = datos.prioridad_id
    actividad.estado_id = datos.estado_id
    actividad.fecha = datos.fecha
    actividad.hora_inicio = datos.hora_inicio
    actividad.hora_fin = datos.hora_fin
    actividad.reportado_por = datos.reportado_por
    actividad.asignado_a = datos.asignado_a
    actividad.actualizado_en = datetime.now()
    actividad.checklist.clear()
    db.flush()
    for indice, item in enumerate(datos.checklist, start=1):
        actividad.checklist.append(Checklist(texto=item.texto.strip(), hecho=item.hecho, orden=indice))
    for campo, anterior, nuevo in cambios:
        actividad.historial.append(Historial(autor_id=datos.reportado_por, campo=campo, valor_anterior=anterior, valor_nuevo=nuevo))
    db.commit()
    return actividad_json(cargar_actividad(db, actividad.id))


@router.patch("/actividades/{actividad_id}/estado")
def mover_actividad(actividad_id: int, datos: EstadoIn, db: Session = Depends(get_db)):
    actividad = db.get(Actividad, actividad_id)
    nuevo = db.get(Estado, datos.estado_id)
    if actividad is None or nuevo is None:
        raise HTTPException(status_code=404, detail="Actividad o estado no encontrado")
    if datos.autor_id is not None:
        exigir_usuario(db, datos.autor_id, actividad.area_id)
    anterior = db.get(Estado, actividad.estado_id)
    if actividad.estado_id != nuevo.id:
        actividad.estado_id = nuevo.id
        actividad.actualizado_en = datetime.now()
        actividad.historial.append(
            Historial(
                autor_id=datos.autor_id,
                campo="estado",
                valor_anterior=anterior.nombre if anterior else "",
                valor_nuevo=nuevo.nombre,
            )
        )
        db.commit()
    return actividad_json(cargar_actividad(db, actividad.id))


@router.post("/actividades/{actividad_id}/comentarios", status_code=201)
def comentar(actividad_id: int, datos: ComentarioIn, db: Session = Depends(get_db)):
    actividad = db.get(Actividad, actividad_id)
    if actividad is None:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    exigir_usuario(db, datos.autor_id, actividad.area_id)
    db.add(Comentario(actividad_id=actividad.id, autor_id=datos.autor_id, cuerpo=datos.cuerpo.strip()))
    db.commit()
    return actividad_json(cargar_actividad(db, actividad.id))


@router.delete("/actividades/{actividad_id}", status_code=204)
def eliminar_actividad(actividad_id: int, db: Session = Depends(get_db)):
    actividad = db.get(Actividad, actividad_id)
    if actividad is None:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    db.delete(actividad)
    db.commit()
