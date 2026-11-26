"""Script para exportar la base de datos de Planificador DSI a archivos SQL (MSSQL y PostgreSQL).

Genera:
1. planificador_dsi_mssql.sql (Microsoft SQL Server / T-SQL)
2. planificador_dsi_postgres.sql (PostgreSQL / Neon / Supabase / pgAdmin)
"""

import os
import sys
from datetime import date, datetime, time
from pathlib import Path

# Agregar raíz del proyecto al sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

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


def formatear_valor_sql(val, dialect="mssql"):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        if dialect == "mssql":
            return "1" if val else "0"
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (datetime, date, time)):
        return f"'{val.isoformat()}'"
    # String
    cadena = str(val).replace("'", "''")
    if dialect == "mssql":
        return f"N'{cadena}'"
    return f"'{cadena}'"


def generar_sql_mssql(sqlite_path: Path, salida_path: Path) -> None:
    engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    lineas = [
        "-- ========================================================",
        "-- PLANIFICADOR DSI - SCRIPT DE CREACION Y DATOS PARA MSSQL",
        f"-- Generado automaticamente: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "-- Compatible con Microsoft SQL Server 2016, 2019, 2022 y Azure SQL",
        "-- ========================================================",
        "",
        "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'planificador_dsi')",
        "BEGIN",
        "    CREATE DATABASE [planificador_dsi];",
        "END",
        "GO",
        "",
        "USE [planificador_dsi];",
        "GO",
        "",
        "-- 1. CREACION DE TABLAS",
        "",
        "IF OBJECT_ID(N'dbo.area', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.area (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        nombre NVARCHAR(160) NOT NULL,",
        "        clave NVARCHAR(20) NOT NULL UNIQUE,",
        "        jornada_inicio TIME NOT NULL,",
        "        jornada_fin TIME NOT NULL,",
        "        siguiente_numero INT NOT NULL DEFAULT 1,",
        "        activa BIT NOT NULL DEFAULT 1",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.puesto', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.puesto (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        nombre NVARCHAR(80) NOT NULL UNIQUE,",
        "        activo BIT NOT NULL DEFAULT 1",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.usuario', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.usuario (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),",
        "        puesto_id INT NULL FOREIGN KEY REFERENCES dbo.puesto(id),",
        "        nombre NVARCHAR(120) NOT NULL,",
        "        usuario_acceso NVARCHAR(60) NOT NULL UNIQUE,",
        "        email NVARCHAR(160) NOT NULL UNIQUE,",
        "        hash_clave NVARCHAR(255) NOT NULL,",
        "        es_admin BIT NOT NULL DEFAULT 0,",
        "        debe_cambiar_clave BIT NOT NULL DEFAULT 0,",
        "        activo BIT NOT NULL DEFAULT 1,",
        "        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.categoria', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.categoria (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),",
        "        nombre NVARCHAR(80) NOT NULL,",
        "        color NVARCHAR(7) NOT NULL DEFAULT '#64748b',",
        "        activa BIT NOT NULL DEFAULT 1",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.prioridad', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.prioridad (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        nombre NVARCHAR(40) NOT NULL UNIQUE,",
        "        orden INT NOT NULL,",
        "        activa BIT NOT NULL DEFAULT 1",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.estado', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.estado (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        nombre NVARCHAR(40) NOT NULL UNIQUE,",
        "        columna NVARCHAR(20) NOT NULL,",
        "        orden INT NOT NULL,",
        "        es_cierre BIT NOT NULL DEFAULT 0",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.actividad', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.actividad (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),",
        "        numero INT NOT NULL,",
        "        titulo NVARCHAR(180) NOT NULL,",
        "        descripcion NVARCHAR(1000) NOT NULL DEFAULT '',",
        "        observaciones NVARCHAR(1000) NOT NULL DEFAULT '',",
        "        categoria_id INT NOT NULL FOREIGN KEY REFERENCES dbo.categoria(id),",
        "        prioridad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.prioridad(id),",
        "        estado_id INT NOT NULL FOREIGN KEY REFERENCES dbo.estado(id),",
        "        fecha DATE NOT NULL,",
        "        hora_inicio TIME NOT NULL,",
        "        hora_fin TIME NOT NULL,",
        "        reportado_por INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id),",
        "        asignado_a INT NULL FOREIGN KEY REFERENCES dbo.usuario(id),",
        "        posicion INT NOT NULL DEFAULT 0,",
        "        creado_en DATETIME2 NOT NULL DEFAULT GETDATE(),",
        "        actualizado_en DATETIME2 NOT NULL DEFAULT GETDATE(),",
        "        CONSTRAINT uq_actividad_numero UNIQUE (area_id, numero)",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.checklist', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.checklist (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,",
        "        texto NVARCHAR(200) NOT NULL,",
        "        hecho BIT NOT NULL DEFAULT 0,",
        "        orden INT NOT NULL DEFAULT 0",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.comentario', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.comentario (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,",
        "        autor_id INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id),",
        "        cuerpo NVARCHAR(1000) NOT NULL,",
        "        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()",
        "    );",
        "END",
        "GO",
        "",
        "IF OBJECT_ID(N'dbo.historial', N'U') IS NULL",
        "BEGIN",
        "    CREATE TABLE dbo.historial (",
        "        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,",
        "        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,",
        "        autor_id INT NULL FOREIGN KEY REFERENCES dbo.usuario(id),",
        "        campo NVARCHAR(40) NOT NULL,",
        "        valor_anterior NVARCHAR(200) NOT NULL DEFAULT '',",
        "        valor_nuevo NVARCHAR(200) NOT NULL DEFAULT '',",
        "        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()",
        "    );",
        "END",
        "GO",
        "",
        "-- 2. INSERCION DE DATOS ACTUALES",
        "",
    ]

    with Session(engine) as sesion:
        for modelo in MODELOS_ORDENADOS:
            tabla = modelo.__tablename__
            columnas = [c.name for c in modelo.__table__.columns]
            cols_str = ", ".join([f"[{c}]" for c in columnas])
            registros = sesion.scalars(select(modelo)).all()

            if not registros:
                continue

            lineas.append(f"-- Datos para la tabla: {tabla} ({len(registros)} registros)")
            lineas.append(f"SET IDENTITY_INSERT dbo.[{tabla}] ON;")
            lineas.append("GO")

            for item in registros:
                valores = [formatear_valor_sql(getattr(item, col), dialect="mssql") for col in columnas]
                vals_str = ", ".join(valores)
                lineas.append(f"INSERT INTO dbo.[{tabla}] ({cols_str}) VALUES ({vals_str});")

            lineas.append(f"SET IDENTITY_INSERT dbo.[{tabla}] OFF;")
            lineas.append("GO")
            lineas.append("")

    salida_path.write_text("\n".join(lineas), encoding="utf-8")
    print(f"Archivo MSSQL generado: {salida_path}")


def generar_sql_postgres(sqlite_path: Path, salida_path: Path) -> None:
    engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    lineas = [
        "-- ========================================================",
        "-- PLANIFICADOR DSI - SCRIPT DE CREACION Y DATOS PARA POSTGRESQL",
        f"-- Generado automaticamente: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "-- Compatible con PostgreSQL 13, 14, 15, 16, Supabase, Neon, Railway",
        "-- ========================================================",
        "",
        "-- 1. CREACION DE TABLAS",
        "",
        "CREATE TABLE IF NOT EXISTS area (",
        "    id SERIAL PRIMARY KEY,",
        "    nombre VARCHAR(160) NOT NULL,",
        "    clave VARCHAR(20) NOT NULL UNIQUE,",
        "    jornada_inicio TIME NOT NULL,",
        "    jornada_fin TIME NOT NULL,",
        "    siguiente_numero INTEGER NOT NULL DEFAULT 1,",
        "    activa BOOLEAN NOT NULL DEFAULT TRUE",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS puesto (",
        "    id SERIAL PRIMARY KEY,",
        "    nombre VARCHAR(80) NOT NULL UNIQUE,",
        "    activo BOOLEAN NOT NULL DEFAULT TRUE",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS usuario (",
        "    id SERIAL PRIMARY KEY,",
        "    area_id INTEGER NOT NULL REFERENCES area(id),",
        "    puesto_id INTEGER REFERENCES puesto(id),",
        "    nombre VARCHAR(120) NOT NULL,",
        "    usuario_acceso VARCHAR(60) NOT NULL UNIQUE,",
        "    email VARCHAR(160) NOT NULL UNIQUE,",
        "    hash_clave VARCHAR(255) NOT NULL,",
        "    es_admin BOOLEAN NOT NULL DEFAULT FALSE,",
        "    debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE,",
        "    activo BOOLEAN NOT NULL DEFAULT TRUE,",
        "    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS categoria (",
        "    id SERIAL PRIMARY KEY,",
        "    area_id INTEGER NOT NULL REFERENCES area(id),",
        "    nombre VARCHAR(80) NOT NULL,",
        "    color VARCHAR(7) NOT NULL DEFAULT '#64748b',",
        "    activa BOOLEAN NOT NULL DEFAULT TRUE",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS prioridad (",
        "    id SERIAL PRIMARY KEY,",
        "    nombre VARCHAR(40) NOT NULL UNIQUE,",
        "    orden INTEGER NOT NULL,",
        "    activa BOOLEAN NOT NULL DEFAULT TRUE",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS estado (",
        "    id SERIAL PRIMARY KEY,",
        "    nombre VARCHAR(40) NOT NULL UNIQUE,",
        "    columna VARCHAR(20) NOT NULL,",
        "    orden INTEGER NOT NULL,",
        "    es_cierre BOOLEAN NOT NULL DEFAULT FALSE",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS actividad (",
        "    id SERIAL PRIMARY KEY,",
        "    area_id INTEGER NOT NULL REFERENCES area(id),",
        "    numero INTEGER NOT NULL,",
        "    titulo VARCHAR(180) NOT NULL,",
        "    descripcion VARCHAR(1000) NOT NULL DEFAULT '',",
        "    observaciones VARCHAR(1000) NOT NULL DEFAULT '',",
        "    categoria_id INTEGER NOT NULL REFERENCES categoria(id),",
        "    prioridad_id INTEGER NOT NULL REFERENCES prioridad(id),",
        "    estado_id INTEGER NOT NULL REFERENCES estado(id),",
        "    fecha DATE NOT NULL,",
        "    hora_inicio TIME NOT NULL,",
        "    hora_fin TIME NOT NULL,",
        "    reportado_por INTEGER NOT NULL REFERENCES usuario(id),",
        "    asignado_a INTEGER REFERENCES usuario(id),",
        "    posicion INTEGER NOT NULL DEFAULT 0,",
        "    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),",
        "    actualizado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),",
        "    CONSTRAINT uq_actividad_numero UNIQUE (area_id, numero)",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS checklist (",
        "    id SERIAL PRIMARY KEY,",
        "    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,",
        "    texto VARCHAR(200) NOT NULL,",
        "    hecho BOOLEAN NOT NULL DEFAULT FALSE,",
        "    orden INTEGER NOT NULL DEFAULT 0",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS comentario (",
        "    id SERIAL PRIMARY KEY,",
        "    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,",
        "    autor_id INTEGER NOT NULL REFERENCES usuario(id),",
        "    cuerpo VARCHAR(1000) NOT NULL,",
        "    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS historial (",
        "    id SERIAL PRIMARY KEY,",
        "    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,",
        "    autor_id INTEGER REFERENCES usuario(id),",
        "    campo VARCHAR(40) NOT NULL,",
        "    valor_anterior VARCHAR(200) NOT NULL DEFAULT '',",
        "    valor_nuevo VARCHAR(200) NOT NULL DEFAULT '',",
        "    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()",
        ");",
        "",
        "-- 2. INSERCION DE DATOS ACTUALES",
        "",
    ]

    with Session(engine) as sesion:
        for modelo in MODELOS_ORDENADOS:
            tabla = modelo.__tablename__
            columnas = [c.name for c in modelo.__table__.columns]
            cols_str = ", ".join([f'"{c}"' for c in columnas])
            registros = sesion.scalars(select(modelo)).all()

            if not registros:
                continue

            lineas.append(f"-- Datos para la tabla: {tabla} ({len(registros)} registros)")
            for item in registros:
                valores = [formatear_valor_sql(getattr(item, col), dialect="postgres") for col in columnas]
                vals_str = ", ".join(valores)
                lineas.append(f'INSERT INTO "{tabla}" ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;')

            lineas.append("")

        # Actualizar secuencias
        lineas.append("-- 3. ACTUALIZAR SECUENCIAS AUTO-INCREMENTALES")
        for modelo in MODELOS_ORDENADOS:
            tabla = modelo.__tablename__
            lineas.append(
                f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {tabla};"
            )

    salida_path.write_text("\n".join(lineas), encoding="utf-8")
    print(f"Archivo PostgreSQL generado: {salida_path}")


def main():
    base_dir = Path(__file__).resolve().parent.parent
    sqlite_path = base_dir / "backend" / "data" / "planificador.db"

    if not sqlite_path.exists():
        print(f"Error: No existe el archivo SQLite en {sqlite_path}")
        sys.exit(1)

    salida_mssql = base_dir / "planificador_dsi_mssql.sql"
    generar_sql_mssql(sqlite_path, salida_mssql)

    salida_pg = base_dir / "planificador_dsi_postgres.sql"
    generar_sql_postgres(sqlite_path, salida_pg)


if __name__ == "__main__":
    main()
