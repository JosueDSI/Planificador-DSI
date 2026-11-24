from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Area(Base):
    __tablename__ = "area"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    clave: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    jornada_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    jornada_fin: Mapped[time] = mapped_column(Time, nullable=False)
    siguiente_numero: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="area")
    categorias: Mapped[list["Categoria"]] = relationship(back_populates="area")
    actividades: Mapped[list["Actividad"]] = relationship(back_populates="area")


class Puesto(Base):
    __tablename__ = "puesto"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="puesto")


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("area.id"), nullable=False)
    puesto_id: Mapped[int | None] = mapped_column(ForeignKey("puesto.id"))
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    usuario_acceso: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    hash_clave: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    area: Mapped[Area] = relationship(back_populates="usuarios")
    puesto: Mapped[Puesto | None] = relationship(back_populates="usuarios")


class Categoria(Base):
    __tablename__ = "categoria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("area.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#64748b")
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    area: Mapped[Area] = relationship(back_populates="categorias")


class Prioridad(Base):
    __tablename__ = "prioridad"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Estado(Base):
    __tablename__ = "estado"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    columna: Mapped[str] = mapped_column(String(20), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    es_cierre: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Actividad(Base):
    __tablename__ = "actividad"
    __table_args__ = (UniqueConstraint("area_id", "numero", name="uq_actividad_numero"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("area.id"), nullable=False)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str] = mapped_column(String(180), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    observaciones: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categoria.id"), nullable=False)
    prioridad_id: Mapped[int] = mapped_column(ForeignKey("prioridad.id"), nullable=False)
    estado_id: Mapped[int] = mapped_column(ForeignKey("estado.id"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    reportado_por: Mapped[int] = mapped_column(ForeignKey("usuario.id"), nullable=False)
    asignado_a: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))
    posicion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    area: Mapped[Area] = relationship(back_populates="actividades")
    categoria: Mapped[Categoria] = relationship()
    prioridad: Mapped[Prioridad] = relationship()
    estado: Mapped[Estado] = relationship()
    solicitante: Mapped[Usuario] = relationship(foreign_keys=[reportado_por])
    responsable: Mapped[Usuario | None] = relationship(foreign_keys=[asignado_a])
    checklist: Mapped[list["Checklist"]] = relationship(back_populates="actividad", cascade="all, delete-orphan", order_by="Checklist.orden")
    comentarios: Mapped[list["Comentario"]] = relationship(back_populates="actividad", cascade="all, delete-orphan", order_by="Comentario.creado_en")
    historial: Mapped[list["Historial"]] = relationship(back_populates="actividad", cascade="all, delete-orphan", order_by="Historial.creado_en")


class Checklist(Base):
    __tablename__ = "checklist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actividad_id: Mapped[int] = mapped_column(ForeignKey("actividad.id"), nullable=False)
    texto: Mapped[str] = mapped_column(String(200), nullable=False)
    hecho: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    actividad: Mapped[Actividad] = relationship(back_populates="checklist")


class Comentario(Base):
    __tablename__ = "comentario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actividad_id: Mapped[int] = mapped_column(ForeignKey("actividad.id"), nullable=False)
    autor_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"), nullable=False)
    cuerpo: Mapped[str] = mapped_column(String(1000), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    actividad: Mapped[Actividad] = relationship(back_populates="comentarios")
    autor: Mapped[Usuario] = relationship()


class Historial(Base):
    __tablename__ = "historial"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actividad_id: Mapped[int] = mapped_column(ForeignKey("actividad.id"), nullable=False)
    autor_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"))
    campo: Mapped[str] = mapped_column(String(40), nullable=False)
    valor_anterior: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    valor_nuevo: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    actividad: Mapped[Actividad] = relationship(back_populates="historial")
    autor: Mapped[Usuario | None] = relationship()
