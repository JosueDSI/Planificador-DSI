import hashlib
import hmac
import os
import re

ESPECIALES = re.compile(r"[\W_]")


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
    if len(clave) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    if not any(c.isupper() for c in clave):
        raise ValueError("La contraseña debe contener al menos una letra mayúscula.")
    if not any(c.islower() for c in clave):
        raise ValueError("La contraseña debe contener al menos una letra minúscula.")
    if not any(c.isdigit() for c in clave):
        raise ValueError("La contraseña debe contener al menos un número.")
    if not ESPECIALES.search(clave):
        raise ValueError("La contraseña debe incluir al menos un caracter especial (ej. !@#$%&*).")


def validar_email_corporativo(email: str) -> str:
    email = email.strip().lower()
    patron = r"^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}$"
    if not re.match(patron, email):
        raise ValueError("Ingrese un correo corporativo válido (ej. usuario@amphos21.com).")
    return email
