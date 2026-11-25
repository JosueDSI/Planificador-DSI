from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth_utils import hashear_clave
from .models import Actividad, Area, Categoria, Checklist, Comentario, Estado, Historial, Prioridad, Puesto, Usuario


def cargar_demo(db: Session) -> None:
    area_existente = db.scalar(select(Area).limit(1))
    if area_existente:
        if area_existente.jornada_inicio != time(8, 30) or area_existente.jornada_fin != time(18, 30):
            area_existente.jornada_inicio = time(8, 30)
            area_existente.jornada_fin = time(18, 30)
            db.commit()
        # Limpieza de actividades de muestra en entornos existentes (Vercel)
        demo_titulos = ["Revisar los respaldos de la semana", "Documentar los cambios de la red local", "Avanzar el portal interno"]
        acts_demo = db.scalars(select(Actividad).where(Actividad.titulo.in_(demo_titulos))).all()
        if acts_demo:
            db.query(Checklist).delete()
            db.query(Comentario).delete()
            db.query(Historial).delete()
            db.query(Actividad).delete()
            area_existente.siguiente_numero = 1
            db.commit()
        return

    area = Area(
        nombre="Departamento de Sistemas e Informática",
        clave="DSI",
        jornada_inicio=time(8, 30),
        jornada_fin=time(18, 30),
        siguiente_numero=1,
    )
    db.add(area)
    db.flush()

    categorias = {
        nombre: Categoria(area_id=area.id, nombre=nombre, color=color)
        for nombre, color in [
            ("Desarrollo", "#3b82f6"),
            ("Infraestructura", "#f97316"),
            ("Seguridad", "#e11d48"),
            ("Datos", "#8b5cf6"),
            ("Redes", "#06b6d4"),
            ("Proyectos", "#f59e0b"),
            ("Mantenimiento", "#10b981"),
        ]
    }
    db.add_all(categorias.values())

    prioridades = {
        nombre: Prioridad(nombre=nombre, orden=orden)
        for nombre, orden in [("Alta", 1), ("Media", 2), ("Baja", 3)]
    }
    db.add_all(prioridades.values())

    estados = {
        columna: Estado(nombre=nombre, columna=columna, orden=orden, es_cierre=cierre)
        for columna, nombre, orden, cierre in [
            ("por_hacer", "Por hacer", 1, False),
            ("en_progreso", "En progreso", 2, False),
            ("en_espera", "En espera", 3, False),
            ("completado", "Completado", 4, True),
        ]
    }
    db.add_all(estados.values())
    db.flush()

    puesto_admin = Puesto(nombre="Administrador DSI")
    puesto_gerente = Puesto(nombre="Gerente de Sistemas e Informática")
    puesto_dev = Puesto(nombre="Desarrollador, Analista y Soporte")
    puesto_analista = Puesto(nombre="Analista de Sistemas")
    puesto_soporte = Puesto(nombre="Soporte Técnico")
    db.add_all([puesto_admin, puesto_gerente, puesto_dev, puesto_analista, puesto_soporte])
    db.flush()

    import os

    # Clave inicial configurable por entorno (C3)
    clave_plana = os.getenv("INITIAL_USER_PASSWORD", "Amphos21*Dsi#2026")
    clave_inicial = hashear_clave(clave_plana)

    personas = [
        ("Administrador", "admin@amphos21.com", "admin@amphos21.com", puesto_admin.id, True),
        ("Guissepi Rodriguez", "guissepi.rodriguez@amphos21.com", "guissepi.rodriguez@amphos21.com", puesto_dev.id, False),
        ("Josué Albornoz", "josue.albornoz@amphos21.com", "josue.albornoz@amphos21.com", puesto_dev.id, True),
        ("Miguel Mendoza", "mmendoza.licapa@amphos21.com", "mmendoza.licapa@amphos21.com", puesto_gerente.id, True),
    ]
    usuarios = {}
    for nombre, acceso, email, p_id, es_adm in personas:
        usuario = Usuario(
            area_id=area.id,
            nombre=nombre,
            usuario_acceso=acceso,
            email=email,
            hash_clave=clave_inicial,
            puesto_id=p_id,
            es_admin=es_adm,
            debe_cambiar_clave=True,
        )
        db.add(usuario)
        usuarios[acceso] = usuario
    db.commit()
