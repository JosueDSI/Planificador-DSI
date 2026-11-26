-- ========================================================
-- PLANIFICADOR DSI - SCRIPT DE CREACION Y DATOS PARA POSTGRESQL
-- Generado automaticamente: 2026-11-26 17:16:33
-- Compatible con PostgreSQL 13, 14, 15, 16, Supabase, Neon, Railway
-- ========================================================

-- 1. CREACION DE TABLAS

CREATE TABLE IF NOT EXISTS area (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    clave VARCHAR(20) NOT NULL UNIQUE,
    jornada_inicio TIME NOT NULL,
    jornada_fin TIME NOT NULL,
    siguiente_numero INTEGER NOT NULL DEFAULT 1,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS puesto (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES area(id),
    puesto_id INTEGER REFERENCES puesto(id),
    nombre VARCHAR(120) NOT NULL,
    usuario_acceso VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(160) NOT NULL UNIQUE,
    hash_clave VARCHAR(255) NOT NULL,
    es_admin BOOLEAN NOT NULL DEFAULT FALSE,
    debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categoria (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES area(id),
    nombre VARCHAR(80) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#64748b',
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS prioridad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE,
    orden INTEGER NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS estado (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE,
    columna VARCHAR(20) NOT NULL,
    orden INTEGER NOT NULL,
    es_cierre BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS actividad (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES area(id),
    numero INTEGER NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL DEFAULT '',
    observaciones VARCHAR(1000) NOT NULL DEFAULT '',
    categoria_id INTEGER NOT NULL REFERENCES categoria(id),
    prioridad_id INTEGER NOT NULL REFERENCES prioridad(id),
    estado_id INTEGER NOT NULL REFERENCES estado(id),
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    reportado_por INTEGER NOT NULL REFERENCES usuario(id),
    asignado_a INTEGER REFERENCES usuario(id),
    posicion INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_actividad_numero UNIQUE (area_id, numero)
);

CREATE TABLE IF NOT EXISTS checklist (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,
    texto VARCHAR(200) NOT NULL,
    hecho BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comentario (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,
    autor_id INTEGER NOT NULL REFERENCES usuario(id),
    cuerpo VARCHAR(1000) NOT NULL,
    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historial (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,
    autor_id INTEGER REFERENCES usuario(id),
    campo VARCHAR(40) NOT NULL,
    valor_anterior VARCHAR(200) NOT NULL DEFAULT '',
    valor_nuevo VARCHAR(200) NOT NULL DEFAULT '',
    creado_en TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. INSERCION DE DATOS ACTUALES

-- Datos para la tabla: area (1 registros)
INSERT INTO "area" ("id", "nombre", "clave", "jornada_inicio", "jornada_fin", "siguiente_numero", "activa") VALUES (1, 'Departamento de Sistemas e Informática', 'DSI', '08:30:00', '18:30:00', 2, TRUE) ON CONFLICT DO NOTHING;

-- Datos para la tabla: puesto (5 registros)
INSERT INTO "puesto" ("id", "nombre", "activo") VALUES (1, 'Administrador DSI', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "puesto" ("id", "nombre", "activo") VALUES (2, 'Gerente de Sistemas e Informática', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "puesto" ("id", "nombre", "activo") VALUES (3, 'Desarrollador, Analista y Soporte', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "puesto" ("id", "nombre", "activo") VALUES (4, 'Analista de Sistemas', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "puesto" ("id", "nombre", "activo") VALUES (5, 'Soporte Técnico', TRUE) ON CONFLICT DO NOTHING;

-- Datos para la tabla: usuario (4 registros)
INSERT INTO "usuario" ("id", "area_id", "puesto_id", "nombre", "usuario_acceso", "email", "hash_clave", "es_admin", "debe_cambiar_clave", "activo", "creado_en") VALUES (1, 1, 1, 'Administrador', 'admin@amphos21.com', 'admin@amphos21.com', '20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', TRUE, FALSE, TRUE, '2026-11-24T18:24:35.127143') ON CONFLICT DO NOTHING;
INSERT INTO "usuario" ("id", "area_id", "puesto_id", "nombre", "usuario_acceso", "email", "hash_clave", "es_admin", "debe_cambiar_clave", "activo", "creado_en") VALUES (2, 1, 3, 'Guissepi Rodriguez', 'guissepi.rodriguez@amphos21.com', 'guissepi.rodriguez@amphos21.com', '20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', FALSE, FALSE, TRUE, '2026-11-24T18:24:35.127143') ON CONFLICT DO NOTHING;
INSERT INTO "usuario" ("id", "area_id", "puesto_id", "nombre", "usuario_acceso", "email", "hash_clave", "es_admin", "debe_cambiar_clave", "activo", "creado_en") VALUES (3, 1, 3, 'Josué Albornoz', 'josue.albornoz@amphos21.com', 'josue.albornoz@amphos21.com', '20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', TRUE, FALSE, TRUE, '2026-11-24T18:24:35.127143') ON CONFLICT DO NOTHING;
INSERT INTO "usuario" ("id", "area_id", "puesto_id", "nombre", "usuario_acceso", "email", "hash_clave", "es_admin", "debe_cambiar_clave", "activo", "creado_en") VALUES (4, 1, 2, 'Miguel Mendoza', 'mmendoza.licapa@amphos21.com', 'mmendoza.licapa@amphos21.com', '20b778d0fdcedd3e8109a22c029f3f75$ca3c97a5e12ac1d0d5847422dc589545f6ed7f90fe5b142b4d5e989fdb37d24f', TRUE, FALSE, TRUE, '2026-11-24T18:24:35.127143') ON CONFLICT DO NOTHING;

-- Datos para la tabla: categoria (7 registros)
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (1, 1, 'Desarrollo', '#3b82f6', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (2, 1, 'Infraestructura', '#f97316', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (3, 1, 'Seguridad', '#e11d48', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (4, 1, 'Datos', '#8b5cf6', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (5, 1, 'Redes', '#06b6d4', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (6, 1, 'Proyectos', '#f59e0b', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "categoria" ("id", "area_id", "nombre", "color", "activa") VALUES (7, 1, 'Mantenimiento', '#10b981', TRUE) ON CONFLICT DO NOTHING;

-- Datos para la tabla: prioridad (3 registros)
INSERT INTO "prioridad" ("id", "nombre", "orden", "activa") VALUES (1, 'Alta', 1, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "prioridad" ("id", "nombre", "orden", "activa") VALUES (2, 'Media', 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "prioridad" ("id", "nombre", "orden", "activa") VALUES (3, 'Baja', 3, TRUE) ON CONFLICT DO NOTHING;

-- Datos para la tabla: estado (4 registros)
INSERT INTO "estado" ("id", "nombre", "columna", "orden", "es_cierre") VALUES (1, 'Por hacer', 'por_hacer', 1, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO "estado" ("id", "nombre", "columna", "orden", "es_cierre") VALUES (2, 'En progreso', 'en_progreso', 2, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO "estado" ("id", "nombre", "columna", "orden", "es_cierre") VALUES (3, 'En espera', 'en_espera', 3, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO "estado" ("id", "nombre", "columna", "orden", "es_cierre") VALUES (4, 'Completado', 'completado', 4, TRUE) ON CONFLICT DO NOTHING;

-- 3. ACTUALIZAR SECUENCIAS AUTO-INCREMENTALES
SELECT setval(pg_get_serial_sequence('area', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM area;
SELECT setval(pg_get_serial_sequence('puesto', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM puesto;
SELECT setval(pg_get_serial_sequence('usuario', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM usuario;
SELECT setval(pg_get_serial_sequence('categoria', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM categoria;
SELECT setval(pg_get_serial_sequence('prioridad', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM prioridad;
SELECT setval(pg_get_serial_sequence('estado', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM estado;
SELECT setval(pg_get_serial_sequence('actividad', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM actividad;
SELECT setval(pg_get_serial_sequence('checklist', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM checklist;
SELECT setval(pg_get_serial_sequence('comentario', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM comentario;
SELECT setval(pg_get_serial_sequence('historial', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM historial;