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


def migrar(postgres_url: str) -> None:
    if postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)

    sqlite_path = Path(__file__).resolve().parent.parent / "backend" / "data" / "planificador.db"
    if not sqlite_path.exists():
        print(f"Error: No se encontró la base SQLite en {sqlite_path}")
        sys.exit(1)

    print(f"1. Conectando a SQLite: {sqlite_path}")
    engine_sqlite = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    print(f"2. Conectando a PostgreSQL...")
    engine_pg = create_engine(postgres_url, pool_pre_ping=True)

    print("3. Creando tablas en PostgreSQL si no existen...")
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
                # Extraer atributos como diccionario
                datos = {
                    col.name: getattr(item, col.name)
                    for col in item.__table__.columns
                }
                # Verificar si ya existe por ID para evitar duplicados
                existente = sesion_pg.get(modelo, datos["id"])
                if not existente:
                    nuevo = modelo(**datos)
                    sesion_pg.add(nuevo)

            sesion_pg.commit()

        print("4. Actualizando secuencias de IDs en PostgreSQL...")
        for modelo in modelos:
            tabla = modelo.__tablename__
            try:
                sql = text(f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {tabla};")
                sesion_pg.execute(sql)
                sesion_pg.commit()
            except Exception as e:
                # Si no usa secuencia serial estándar
                pass

    print("\n¡Migración a PostgreSQL completada con éxito!")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATABASE_URL_POSTGRES", os.getenv("DATABASE_URL", ""))
    if not url or "sqlite" in url:
        print("Uso: python scripts/migrar_a_postgres.py postgresql://usuario:password@host:5432/nombre_bd")
        print("O exporte DATABASE_URL_POSTGRES con la cadena de conexión de Neon, Supabase, Vercel Postgres, etc.")
        sys.exit(1)

    migrar(url)
