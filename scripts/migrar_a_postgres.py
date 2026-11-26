"""Script de migración de SQLite (planificador.db) a PostgreSQL.

Uso:
    python scripts/migrar_a_postgres.py <POSTGRES_URL>
    O definir la variable de entorno DATABASE_URL_POSTGRES / DATABASE_URL.
"""

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

# Asegurar importación del backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database import Base
from backend.app.models import (
    Actividad,
    Area,
    Categoria,
    Checklist,
    Comentario,
    Estado,
    Historial,
    Prioridad,
    Puesto,
    Usuario,
)


def asegurar_base_de_datos_postgres(postgres_url: str) -> None:
    """Si la base de datos no existe en PostgreSQL, se conecta a 'postgres' y la crea."""
    try:
        partes = postgres_url.split("/")
        nombre_bd = partes[-1].split("?")[0]
        if not nombre_bd or nombre_bd == "postgres":
            return

        url_mantenimiento = "/".join(partes[:-1]) + "/postgres"
        if "?" in partes[-1]:
            url_mantenimiento += "?" + partes[-1].split("?")[1]

        engine_maint = create_engine(url_mantenimiento, isolation_level="AUTOCOMMIT")
        with engine_maint.connect() as conn:
            existe = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :nombre"),
                {"nombre": nombre_bd},
            ).scalar()
            if not existe:
                print(f"-> Creando base de datos [{nombre_bd}] en PostgreSQL...")
                conn.execute(text(f'CREATE DATABASE "{nombre_bd}"'))
                print(f"-> Base de datos [{nombre_bd}] creada exitosamente.")
            else:
                print(f"-> Base de datos [{nombre_bd}] ya existe en PostgreSQL.")
    except Exception as e:
        print(f"Nota: Verificación automática de base de datos ({e}). Se intentará conexión directa.")


def migrar(postgres_url: str) -> None:
    if postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)

    sqlite_path = Path(__file__).resolve().parent.parent / "backend" / "data" / "planificador.db"
    if not sqlite_path.exists():
        print(f"Error: No se encontró la base SQLite en {sqlite_path}")
        sys.exit(1)

    print(f"1. Verificando/Creando base de datos en PostgreSQL...")
    asegurar_base_de_datos_postgres(postgres_url)

    print(f"2. Conectando a SQLite: {sqlite_path}")
    engine_sqlite = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    print(f"3. Conectando a PostgreSQL...")
    engine_pg = create_engine(postgres_url, pool_pre_ping=True)

    print("4. Creando tablas en PostgreSQL si no existen...")
    Base.metadata.create_all(engine_pg)

    # Orden de migración respetando claves foráneas
    modelos = [
        Area,
        Puesto,
        Usuario,
        Categoria,
        Prioridad,
        Estado,
        Actividad,
        Checklist,
        Comentario,
        Historial,
    ]

    with Session(engine_sqlite) as sesion_sqlite, Session(engine_pg) as sesion_pg:
        for modelo in modelos:
            tabla = modelo.__tablename__
            registros = sesion_sqlite.scalars(select(modelo)).all()
            print(f"   -> Migrando {tabla}: {len(registros)} registros encontrados...")

            for item in registros:
                datos = {
                    col.name: getattr(item, col.name)
                    for col in item.__table__.columns
                }
                existente = sesion_pg.get(modelo, datos["id"])
                if not existente:
                    nuevo = modelo(**datos)
                    sesion_pg.add(nuevo)

            sesion_pg.commit()

        print("5. Actualizando secuencias de IDs en PostgreSQL...")
        for modelo in modelos:
            tabla = modelo.__tablename__
            try:
                sql = text(f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {tabla};")
                sesion_pg.execute(sql)
                sesion_pg.commit()
            except Exception:
                pass

    print("\n" + "=" * 50)
    print("¡Migración a PostgreSQL completada con éxito!")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATABASE_URL_POSTGRES", os.getenv("DATABASE_URL", ""))
    if not url:
        print("Uso: python scripts/migrar_a_postgres.py <POSTGRES_URL>")
        sys.exit(1)

    migrar(url)
