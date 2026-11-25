import base64
import hashlib
import hmac
import json
import os
import re
import time

ESPECIALES = re.compile(r"[\W_]")
SECRET_KEY = os.getenv("SECRET_KEY", "amphos21-planificador-dsi-token-secret-key-2026")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding and padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def crear_token_acceso(datos: dict, expira_minutos: int = 60 * 24 * 7) -> str:
    ahora = int(time.time())
    expira = ahora + (expira_minutos * 60)
    payload = {**datos, "iat": ahora, "exp": expira}

    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

    firma_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    firma = hmac.new(SECRET_KEY.encode("utf-8"), firma_input, hashlib.sha256).digest()
    firma_b64 = _b64url_encode(firma)

    return f"{header_b64}.{payload_b64}.{firma_b64}"


def decodificar_token_acceso(token: str) -> dict | None:
    try:
        partes = token.strip().split(".")
        if len(partes) != 3:
            return None
        header_b64, payload_b64, firma_b64 = partes
        firma_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        firma_esperada = hmac.new(SECRET_KEY.encode("utf-8"), firma_input, hashlib.sha256).digest()
        firma_recibida = _b64url_decode(firma_b64)
        if not hmac.compare_digest(firma_esperada, firma_recibida):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = payload.get("exp")
        if exp and int(time.time()) > exp:
            return None
        return payload
    except Exception:
        return None


def hashear_clave(clave: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${h}"


def verificar_clave(clave: str, hash_almacenado: str) -> bool:
    if not hash_almacenado or "$" not in hash_almacenado:
        return False
    salt, h = hash_almacenado.split("$", 1)
    calculado = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return hmac.compare_digest(h, calculado)


def validar_clave_robusta(clave: str) -> None:
    if not clave or len(clave.strip()) < 1:
        raise ValueError("La contraseña no puede estar vacía.")


def validar_email_corporativo(email: str) -> str:
    email = email.strip().lower()
    patron = r"^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}$"
    if not re.match(patron, email):
        raise ValueError("Ingrese un correo corporativo válido (ej. usuario@amphos21.com).")
    return email
