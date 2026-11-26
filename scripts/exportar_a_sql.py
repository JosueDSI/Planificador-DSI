"""Script para exportar la base de datos de Planificador DSI a archivos SQL (MSSQL y PostgreSQL/Estándar).

Genera:
1. planificador_dsi_mssql.sql (Listo para ejecutar en SQL Server / SSMS / VS Code MSSQL)
2. planificador_dsi_postgres.sql (Listo para ejecutar en PostgreSQL / Supabase / Neon)
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
        "-- TABLA: area",
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
        "-- TABLA: puesto",
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
        "-- TABLA: usuario",
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
        "-- TABLA: categoria",
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
        "-- TABLA: prioridad",
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
        "-- TABLA: estado",
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
        "-- TABLA: actividad",
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
        "-- TABLA: checklist",
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
        "-- TABLA: comentario",
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
        "-- TABLA: historial",
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
    print(f"Archivo MSSQL generado exitosamente en: {salida_path}")


def main():
    base_dir = Path(__file__).resolve().parent.parent
    sqlite_path = base_dir / "backend" / "data" / "planificador.db"

    if not sqlite_path.exists():
        print(f"Error: No existe el archivo SQLite en {sqlite_path}")
        sys.exit(1)

    salida_mssql = base_dir / "planificador_dsi_mssql.sql"
    generar_sql_mssql(sqlite_path, salida_mssql)


if __name__ == "__main__":
    main()
