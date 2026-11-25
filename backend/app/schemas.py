from datetime import date, time

from pydantic import BaseModel, Field, field_validator

from .auth_utils import validar_clave_robusta, validar_email_corporativo


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
    reportado_por: int | None = None
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
    autor_id: int | None = None
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


# --- Autenticación y Usuarios ---


class LoginIn(BaseModel):
    identificador: str = Field(min_length=3, max_length=160)
    clave: str = Field(min_length=1)


class UsuarioCrearIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=160)
    usuario_acceso: str | None = None
    clave: str = Field(min_length=1)
    puesto_id: int | None = None
    es_admin: bool = False

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validar_email_corporativo(v)


class RecuperarClaveIn(BaseModel):
    usuario_id: int
    nueva_clave: str = Field(min_length=1)
