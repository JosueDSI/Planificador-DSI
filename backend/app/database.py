import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _resolver_database_url() -> str:
    env_url = os.getenv("DATABASE_URL", "").strip()
    if env_url:
        if env_url.startswith("postgres://"):
            return env_url.replace("postgres://", "postgresql://", 1)
        return env_url

    if os.getenv("VERCEL"):
        import logging
        logging.getLogger("uvicorn.error").critical(
            "CRÍTICO C5: Ejecutando en Vercel sin DATABASE_URL. "
            "SQLite en /tmp es efímero y se reiniciará en cada arranque en frío. "
            "Configure DATABASE_URL (PostgreSQL) en Vercel."
        )
        if os.getenv("ENFORCE_PROD_DB", "0") == "1":
            raise RuntimeError(
                "CRÍTICO C5: DATABASE_URL no está configurada en Vercel y ENFORCE_PROD_DB=1 está activo. "
                "Conecte PostgreSQL para persistencia permanente."
            )
        data_dir = Path("/tmp")
    else:
        data_dir = Path(__file__).resolve().parent.parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)

    return f"sqlite:///{(data_dir / 'planificador.db').as_posix()}"


DATABASE_URL = _resolver_database_url()
ES_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if ES_SQLITE else {},
    pool_pre_ping=True,
    pool_recycle=300 if not ES_SQLITE else -1,
)

if ES_SQLITE:
    @event.listens_for(engine, "connect")
    def configurar_sqlite(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        try:
            cursor.execute("PRAGMA table_info(usuario)")
            cols = [col[1] for col in cursor.fetchall()]
            if cols and "debe_cambiar_clave" not in cols:
                cursor.execute("ALTER TABLE usuario ADD COLUMN debe_cambiar_clave BOOLEAN DEFAULT 0")
        except Exception:
            pass
        cursor.close()


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
