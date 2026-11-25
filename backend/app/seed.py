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

    # Clave inicial para todos los usuarios
    clave_inicial = hashear_clave("DsiPass@2026")

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
        )
        db.add(usuario)
        usuarios[acceso] = usuario
    db.flush()

    def nueva(titulo, descripcion, categoria, prioridad, estado, fecha_dia, inicio, fin, solicita, responsable, observaciones=""):
        actividad = Actividad(
            area_id=area.id,
            numero=area.siguiente_numero,
            titulo=titulo,
            descripcion=descripcion,
            observaciones=observaciones,
            categoria_id=categorias[categoria].id,
            prioridad_id=prioridades[prioridad].id,
            estado_id=estados[estado].id,
            fecha=fecha_dia,
            hora_inicio=time(*inicio),
            hora_fin=time(*fin),
            reportado_por=usuarios[solicita].id,
            asignado_a=usuarios[responsable].id,
            posicion=area.siguiente_numero,
        )
        area.siguiente_numero += 1
        db.add(actividad)
        return actividad

    hoy = date.today()
    manana = hoy + timedelta(days=1)
    jueves = hoy + timedelta(days=2)
    ayer = hoy - timedelta(days=1)

    miguel = "mmendoza.licapa@amphos21.com"
    josue = "josue.albornoz@amphos21.com"
    guissepi = "guissepi.rodriguez@amphos21.com"

    respaldos = nueva(
        "Revisar los respaldos de la semana",
        "Comprobar que las copias de bases y archivos del departamento quedaron completas.",
        "Infraestructura", "Alta", "en_progreso", hoy, (8, 0), (9, 30), miguel, josue,
    )
    nueva(
        "Documentar los cambios de la red local",
        "Dejar por escrito los ajustes hechos en el segmento del área.",
        "Redes", "Media", "por_hacer", hoy, (10, 0), (12, 0), miguel, guissepi,
    )
    portal = nueva(
        "Avanzar el portal interno",
        "Continuar las pantallas acordadas para consulta del equipo.",
        "Desarrollo", "Alta", "en_progreso", hoy, (14, 0), (16, 30), josue, guissepi,
    )
    nueva(
        "Coordinar la ventana con el proveedor de enlaces",
        "Confirmar el horario en que el proveedor puede intervenir el enlace.",
        "Redes", "Baja", "en_espera", hoy, (16, 30), (17, 0), josue, josue,
        "Se espera la confirmación del horario.",
    )
    nueva(
        "Cerrar el inventario de equipos",
        "Conciliar el listado de equipos asignados al departamento.",
        "Datos", "Media", "completado", hoy, (9, 0), (10, 0), miguel, josue,
    )
    nueva(
        "Preparar la capacitación interna",
        "Ordenar los temas de la sesión con el equipo.",
        "Proyectos", "Media", "por_hacer", manana, (9, 0), (11, 0), miguel, josue,
    )
    nueva(
        "Revisar los accesos del trimestre",
        "Verificar altas y bajas de acceso a los sistemas del área.",
        "Seguridad", "Alta", "por_hacer", manana, (11, 0), (13, 0), miguel, guissepi,
    )
    nueva(
        "Mantener los servidores de prueba",
        "Aplicar el mantenimiento programado del ambiente de pruebas.",
        "Mantenimiento", "Media", "por_hacer", jueves, (8, 0), (10, 0), josue, guissepi,
    )
    informe = nueva(
        "Armar el informe de avance del área",
        "Resumir las actividades de la semana para la revisión del jefe.",
        "Proyectos", "Alta", "en_progreso", hoy, (11, 0), (12, 0), miguel, josue,
    )
    nueva(
        "Ordenar los scripts del departamento",
        "Agrupar los scripts que el equipo usa en la operación diaria.",
        "Desarrollo", "Baja", "completado", ayer, (15, 0), (16, 30), josue, guissepi,
    )
    db.flush()

    db.add_all([
        Checklist(actividad_id=portal.id, texto="Pantalla de inicio", hecho=True, orden=1),
        Checklist(actividad_id=portal.id, texto="Ajuste del menú", hecho=False, orden=2),
        Checklist(actividad_id=portal.id, texto="Revisión con el jefe", hecho=False, orden=3),
        Checklist(actividad_id=respaldos.id, texto="Copia de bases", hecho=True, orden=1),
        Checklist(actividad_id=respaldos.id, texto="Copia de archivos", hecho=False, orden=2),
        Comentario(
            actividad_id=informe.id,
            autor_id=usuarios[guissepi].id,
            cuerpo="Falta el apartado de proyectos en curso.",
            creado_en=datetime.combine(hoy, time(11, 20)),
        ),
        Historial(
            actividad_id=informe.id,
            autor_id=usuarios[miguel].id,
            campo="alta",
            valor_nuevo="Armar el informe de avance del área",
            creado_en=datetime.combine(hoy, time(8, 10)),
        ),
        Historial(
            actividad_id=respaldos.id,
            autor_id=usuarios[josue].id,
            campo="estado",
            valor_anterior="Por hacer",
            valor_nuevo="En progreso",
            creado_en=datetime.combine(hoy, time(8, 5)),
        ),
    ])
    db.commit()
