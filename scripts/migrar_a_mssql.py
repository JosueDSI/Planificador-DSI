"""Script de migración e integración de SQLite (planificador.db) a Microsoft SQL Server (MSSQL).

Uso:
    python scripts/migrar_a_mssql.py "<MSSQL_URL>"

Ejemplos de cadenas de conexión:
    - Autenticación SQL (usuario y contraseña):
      mssql+pymssql://sa:TuPassword123@localhost:1433/planificador_dsi

    - Autenticación Windows integrada:
      mssql+pyodbc://localhost/planificador_dsi?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes

También lee la variable de entorno DATABASE_URL_MSSQL o DATABASE_URL si no se pasa argumento.
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

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

MODELOS_ORDENADOS = [
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


def asegurar_base_de_datos(mssql_url: str) -> None:
    """Si la base de datos no existe en SQL Server, se conecta a 'master' y la crea."""
    try:
        # Extraer nombre de la base de datos
        partes = mssql_url.split("/")
        nombre_bd = partes[-1].split("?")[0]
        if not nombre_bd or nombre_bd == "master":
            return

        url_master = "/".join(partes[:-1]) + "/master"
        if "?" in partes[-1]:
            url_master += "?" + partes[-1].split("?")[1]

        engine_master = create_engine(url_master, isolation_level="AUTOCOMMIT")
        with engine_master.connect() as conn:
            existe = conn.execute(
                text(f"SELECT database_id FROM sys.databases WHERE name = '{nombre_bd}'")
            ).scalar()
            if not existe:
                print(f"-> Creando base de datos [{nombre_bd}] en SQL Server...")
                conn.execute(text(f"CREATE DATABASE [{nombre_bd}]"))
                print(f"-> Base de datos [{nombre_bd}] creada exitosamente.")
            else:
                print(f"-> Base de datos [{nombre_bd}] ya existe en SQL Server.")
    except Exception as e:
        print(f"Nota: No se pudo verificar/crear la BD en master automáticamente ({e}). Se asume que ya existe.")


def migrar_a_mssql(mssql_url: str) -> None:
    sqlite_path = Path(__file__).resolve().parent.parent / "backend" / "data" / "planificador.db"
    if not sqlite_path.exists():
        print(f"Error: No se encontró la base SQLite en {sqlite_path}")
        sys.exit(1)

    print(f"1. Verificando/Creando base de datos destino...")
    asegurar_base_de_datos(mssql_url)

    print(f"2. Conectando a SQLite origen: {sqlite_path}")
    engine_sqlite = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    print(f"3. Conectando a Microsoft SQL Server...")
    engine_mssql = create_engine(mssql_url, pool_pre_ping=True)

    print("4. Creando estructura de tablas en SQL Server...")
    Base.metadata.create_all(engine_mssql)

    print("5. Migrando datos respetando claves foráneas...")
    with Session(engine_sqlite) as sesion_sqlite, engine_mssql.begin() as conn_mssql:
        for modelo in MODELOS_ORDENADOS:
            tabla = modelo.__tablename__
            registros = sesion_sqlite.scalars(select(modelo)).all()
            print(f"   -> Migrando {tabla}: {len(registros)} registros...")

            if not registros:
                continue

            # Habilitar IDENTITY_INSERT
            try:
                conn_mssql.execute(text(f"SET IDENTITY_INSERT dbo.[{tabla}] ON;"))
            except Exception:
                pass

            cols = [c.name for c in modelo.__table__.columns]
            cols_sql = ", ".join([f"[{c}]" for c in cols])
            params_sql = ", ".join([f":{c}" for c in cols])
            insert_stmt = text(f"INSERT INTO dbo.[{tabla}] ({cols_sql}) VALUES ({params_sql});")

            for item in registros:
                datos = {col: getattr(item, col) for col in cols}
                # Verificar si ya existe por ID
                check_stmt = text(f"SELECT id FROM dbo.[{tabla}] WHERE id = :id")
                existe = conn_mssql.execute(check_stmt, {"id": datos["id"]}).scalar()
                if not existe:
                    conn_mssql.execute(insert_stmt, datos)

            # Deshabilitar IDENTITY_INSERT
            try:
                conn_mssql.execute(text(f"SET IDENTITY_INSERT dbo.[{tabla}] OFF;"))
            except Exception:
                pass

    print("\n" + "=" * 50)
    print("¡Migración e integración con SQL Server completada con éxito!")
    print("Para que el sistema use SQL Server permanentemente:")
    print("1. En tu archivo .env agrega:")
    print(f"   DATABASE_URL={mssql_url}")
    print("2. Reinicia el servicio uvicorn.")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATABASE_URL_MSSQL", os.getenv("DATABASE_URL", ""))
    if not url:
        print("Uso: python scripts/migrar_a_mssql.py <MSSQL_URL>")
        print("Ejemplo: python scripts/migrar_a_mssql.py \"mssql+pymssql://sa:TuPassword@localhost:1433/planificador_dsi\"")
        sys.exit(1)

    migrar_a_mssql(url)
