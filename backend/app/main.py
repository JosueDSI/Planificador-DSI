import os
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routes import router
from .seed import cargar_demo

_init_lock = Lock()
_inicializado = False


def inicializar_bd() -> None:
    global _inicializado
    if _inicializado:
        return
    with _init_lock:
        if _inicializado:
            return
        Base.metadata.create_all(engine)
        db = SessionLocal()
        try:
            cargar_demo(db)
        finally:
            db.close()
        _inicializado = True


@asynccontextmanager
async def vida(_app: FastAPI):
    inicializar_bd()
    yield


def _origenes_cors() -> list[str]:
    crudo = os.getenv("CORS_ORIGINS", "").strip()
    if crudo:
        return [origen.strip() for origen in crudo.split(",") if origen.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


app = FastAPI(title="Planificador DSI", lifespan=vida)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes_cors(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def asegurar_bd(request, call_next):
    inicializar_bd()
    return await call_next(request)


from fastapi.staticfiles import StaticFiles

app.include_router(router)

# Servir archivos estáticos (logo institucional, favicons, etc.)
_dir_estatica = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(_dir_estatica):
    os.makedirs(_dir_estatica, exist_ok=True)
app.mount("/static", StaticFiles(directory=_dir_estatica), name="static")

_dir_assets = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist", "assets"))
if os.path.exists(_dir_assets):
    app.mount("/assets", StaticFiles(directory=_dir_assets), name="assets")

