from datetime import date, time

from pydantic import BaseModel, Field, field_validator


class ChecklistIn(BaseModel):
    id: int | None = None
    texto: str = Field(min_length=1, max_length=200)
    hecho: bool = False
    orden: int = 0

    @field_validator("texto")
    @classmethod
    def validar_texto(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El texto de la subtarea no puede estar vacío")
        return limpio


class ActividadIn(BaseModel):
    titulo: str = Field(min_length=1, max_length=180)
    descripcion: str = Field(default="", max_length=1000)
    observaciones: str = Field(default="", max_length=1000)
    categoria_id: int
    prioridad_id: int
    estado_id: int
    fecha: date
    hora_inicio: time
    hora_fin: time
    reportado_por: int
    asignado_a: int | None = None
    checklist: list[ChecklistIn] = []

    @field_validator("titulo")
    @classmethod
    def validar_titulo(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El nombre de la actividad no puede estar vacío")
        return limpio


class ComentarioIn(BaseModel):
    autor_id: int
    cuerpo: str = Field(min_length=1, max_length=1000)

    @field_validator("cuerpo")
    @classmethod
    def validar_cuerpo(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El comentario no puede estar vacío")
        return limpio


class EstadoIn(BaseModel):
    estado_id: int
    autor_id: int | None = None
