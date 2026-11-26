-- ========================================================
-- PLANIFICADOR DSI - SCRIPT DE CREACION Y DATOS PARA MSSQL
-- Generado automaticamente: 2026-11-26 16:33:42
-- Compatible con Microsoft SQL Server 2016, 2019, 2022 y Azure SQL
-- ========================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'planificador_dsi')
BEGIN
    CREATE DATABASE [planificador_dsi];
END
GO

USE [planificador_dsi];
GO

-- 1. CREACION DE TABLAS

-- TABLA: area
IF OBJECT_ID(N'dbo.area', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.area (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(160) NOT NULL,
        clave NVARCHAR(20) NOT NULL UNIQUE,
        jornada_inicio TIME NOT NULL,
        jornada_fin TIME NOT NULL,
        siguiente_numero INT NOT NULL DEFAULT 1,
        activa BIT NOT NULL DEFAULT 1
    );
END
GO

-- TABLA: puesto
IF OBJECT_ID(N'dbo.puesto', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.puesto (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(80) NOT NULL UNIQUE,
        activo BIT NOT NULL DEFAULT 1
    );
END
GO

-- TABLA: usuario
IF OBJECT_ID(N'dbo.usuario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.usuario (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),
        puesto_id INT NULL FOREIGN KEY REFERENCES dbo.puesto(id),
        nombre NVARCHAR(120) NOT NULL,
        usuario_acceso NVARCHAR(60) NOT NULL UNIQUE,
        email NVARCHAR(160) NOT NULL UNIQUE,
        hash_clave NVARCHAR(255) NOT NULL,
        es_admin BIT NOT NULL DEFAULT 0,
        debe_cambiar_clave BIT NOT NULL DEFAULT 0,
        activo BIT NOT NULL DEFAULT 1,
        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

-- TABLA: categoria
IF OBJECT_ID(N'dbo.categoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categoria (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),
        nombre NVARCHAR(80) NOT NULL,
        color NVARCHAR(7) NOT NULL DEFAULT '#64748b',
        activa BIT NOT NULL DEFAULT 1
    );
END
GO

-- TABLA: prioridad
IF OBJECT_ID(N'dbo.prioridad', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.prioridad (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(40) NOT NULL UNIQUE,
        orden INT NOT NULL,
        activa BIT NOT NULL DEFAULT 1
    );
END
GO

-- TABLA: estado
IF OBJECT_ID(N'dbo.estado', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.estado (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(40) NOT NULL UNIQUE,
        columna NVARCHAR(20) NOT NULL,
        orden INT NOT NULL,
        es_cierre BIT NOT NULL DEFAULT 0
    );
END
GO

-- TABLA: actividad
IF OBJECT_ID(N'dbo.actividad', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.actividad (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        area_id INT NOT NULL FOREIGN KEY REFERENCES dbo.area(id),
        numero INT NOT NULL,
        titulo NVARCHAR(180) NOT NULL,
        descripcion NVARCHAR(1000) NOT NULL DEFAULT '',
        observaciones NVARCHAR(1000) NOT NULL DEFAULT '',
        categoria_id INT NOT NULL FOREIGN KEY REFERENCES dbo.categoria(id),
        prioridad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.prioridad(id),
        estado_id INT NOT NULL FOREIGN KEY REFERENCES dbo.estado(id),
        fecha DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        reportado_por INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id),
        asignado_a INT NULL FOREIGN KEY REFERENCES dbo.usuario(id),
        posicion INT NOT NULL DEFAULT 0,
        creado_en DATETIME2 NOT NULL DEFAULT GETDATE(),
        actualizado_en DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_actividad_numero UNIQUE (area_id, numero)
    );
END
GO

-- TABLA: checklist
IF OBJECT_ID(N'dbo.checklist', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.checklist (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,
        texto NVARCHAR(200) NOT NULL,
        hecho BIT NOT NULL DEFAULT 0,
        orden INT NOT NULL DEFAULT 0
    );
END
GO

-- TABLA: comentario
IF OBJECT_ID(N'dbo.comentario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.comentario (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,
        autor_id INT NOT NULL FOREIGN KEY REFERENCES dbo.usuario(id),
        cuerpo NVARCHAR(1000) NOT NULL,
        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

-- TABLA: historial
IF OBJECT_ID(N'dbo.historial', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.historial (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        actividad_id INT NOT NULL FOREIGN KEY REFERENCES dbo.actividad(id) ON DELETE CASCADE,
        autor_id INT NULL FOREIGN KEY REFERENCES dbo.usuario(id),
        campo NVARCHAR(40) NOT NULL,
        valor_anterior NVARCHAR(200) NOT NULL DEFAULT '',
        valor_nuevo NVARCHAR(200) NOT NULL DEFAULT '',
        creado_en DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 2. INSERCION DE DATOS ACTUALES

-- Datos para la tabla: area (1 registros)
SET IDENTITY_INSERT dbo.[area] ON;
GO
INSERT INTO dbo.[area] ([id], [nombre], [clave], [jornada_inicio], [jornada_fin], [siguiente_numero], [activa]) VALUES (1, N'Departamento de Sistemas e Informática', N'DSI', '08:30:00', '18:30:00', 2, 1);
SET IDENTITY_INSERT dbo.[area] OFF;
GO

-- Datos para la tabla: puesto (5 registros)
SET IDENTITY_INSERT dbo.[puesto] ON;
GO
INSERT INTO dbo.[puesto] ([id], [nombre], [activo]) VALUES (1, N'Administrador DSI', 1);
INSERT INTO dbo.[puesto] ([id], [nombre], [activo]) VALUES (2, N'Gerente de Sistemas e Informática', 1);
INSERT INTO dbo.[puesto] ([id], [nombre], [activo]) VALUES (3, N'Desarrollador, Analista y Soporte', 1);
INSERT INTO dbo.[puesto] ([id], [nombre], [activo]) VALUES (4, N'Analista de Sistemas', 1);
INSERT INTO dbo.[puesto] ([id], [nombre], [activo]) VALUES (5, N'Soporte Técnico', 1);
SET IDENTITY_INSERT dbo.[puesto] OFF;
GO

-- Datos para la tabla: usuario (4 registros)
SET IDENTITY_INSERT dbo.[usuario] ON;
GO
INSERT INTO dbo.[usuario] ([id], [area_id], [puesto_id], [nombre], [usuario_acceso], [email], [hash_clave], [es_admin], [debe_cambiar_clave], [activo], [creado_en]) VALUES (1, 1, 1, N'Administrador', N'admin@amphos21.com', N'admin@amphos21.com', N'20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', 1, 0, 1, '2026-11-24T18:24:35.127143');
INSERT INTO dbo.[usuario] ([id], [area_id], [puesto_id], [nombre], [usuario_acceso], [email], [hash_clave], [es_admin], [debe_cambiar_clave], [activo], [creado_en]) VALUES (2, 1, 3, N'Guissepi Rodriguez', N'guissepi.rodriguez@amphos21.com', N'guissepi.rodriguez@amphos21.com', N'20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', 0, 0, 1, '2026-11-24T18:24:35.127143');
INSERT INTO dbo.[usuario] ([id], [area_id], [puesto_id], [nombre], [usuario_acceso], [email], [hash_clave], [es_admin], [debe_cambiar_clave], [activo], [creado_en]) VALUES (3, 1, 3, N'Josué Albornoz', N'josue.albornoz@amphos21.com', N'josue.albornoz@amphos21.com', N'20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', 1, 0, 1, '2026-11-24T18:24:35.127143');
INSERT INTO dbo.[usuario] ([id], [area_id], [puesto_id], [nombre], [usuario_acceso], [email], [hash_clave], [es_admin], [debe_cambiar_clave], [activo], [creado_en]) VALUES (4, 1, 2, N'Miguel Mendoza', N'mmendoza.licapa@amphos21.com', N'mmendoza.licapa@amphos21.com', N'20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', 1, 0, 1, '2026-11-24T18:24:35.127143');
SET IDENTITY_INSERT dbo.[usuario] OFF;
GO

-- Datos para la tabla: categoria (7 registros)
SET IDENTITY_INSERT dbo.[categoria] ON;
GO
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (1, 1, N'Desarrollo', N'#3b82f6', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (2, 1, N'Infraestructura', N'#f97316', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (3, 1, N'Seguridad', N'#e11d48', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (4, 1, N'Datos', N'#8b5cf6', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (5, 1, N'Redes', N'#06b6d4', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (6, 1, N'Proyectos', N'#f59e0b', 1);
INSERT INTO dbo.[categoria] ([id], [area_id], [nombre], [color], [activa]) VALUES (7, 1, N'Mantenimiento', N'#10b981', 1);
SET IDENTITY_INSERT dbo.[categoria] OFF;
GO

-- Datos para la tabla: prioridad (3 registros)
SET IDENTITY_INSERT dbo.[prioridad] ON;
GO
INSERT INTO dbo.[prioridad] ([id], [nombre], [orden], [activa]) VALUES (1, N'Alta', 1, 1);
INSERT INTO dbo.[prioridad] ([id], [nombre], [orden], [activa]) VALUES (2, N'Media', 2, 1);
INSERT INTO dbo.[prioridad] ([id], [nombre], [orden], [activa]) VALUES (3, N'Baja', 3, 1);
SET IDENTITY_INSERT dbo.[prioridad] OFF;
GO

-- Datos para la tabla: estado (4 registros)
SET IDENTITY_INSERT dbo.[estado] ON;
GO
INSERT INTO dbo.[estado] ([id], [nombre], [columna], [orden], [es_cierre]) VALUES (1, N'Por hacer', N'por_hacer', 1, 0);
INSERT INTO dbo.[estado] ([id], [nombre], [columna], [orden], [es_cierre]) VALUES (2, N'En progreso', N'en_progreso', 2, 0);
INSERT INTO dbo.[estado] ([id], [nombre], [columna], [orden], [es_cierre]) VALUES (3, N'En espera', N'en_espera', 3, 0);
INSERT INTO dbo.[estado] ([id], [nombre], [columna], [orden], [es_cierre]) VALUES (4, N'Completado', N'completado', 4, 1);
SET IDENTITY_INSERT dbo.[estado] OFF;
GO
