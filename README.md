# Planificador DSI

Revisión de actividades del Departamento de Sistemas e Informática. El jefe del área ve el avance, el tablero y la agenda. Los puestos quedan vacíos hasta que se carguen; cuando existan, el cargo se muestra como `Gerente (DSI)`.

## Herramientas

- React 18 y Vite, para las pantallas.
- Bootstrap 5, para el tablero interno.
- FastAPI, para la API en Python.
- SQLite y SQLAlchemy, para la base local. Las tablas sirven igual cuando se pase a PostgreSQL.
- El inicio de sesión queda pendiente. Mientras tanto, la pantalla pide quién registra el cambio.

## Arranque local

Hacen falta Python 3.11+ y Node.js 20 o superior.

```powershell
cd D:\Proyectos\planificador-dsi\backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

En otra terminal:

```powershell
cd D:\Proyectos\planificador-dsi\frontend
npm install
npm run dev
```

La pantalla abre en `http://localhost:5173` y la API en `http://127.0.0.1:8000/docs`.

## Despliegue en Vercel

El repositorio incluye `vercel.json`, `api/index.py` y `requirements.txt` en la raíz para desplegar frontend (Vite) y backend (FastAPI) desde el mismo proyecto en Vercel:

1. Importa el repositorio desde GitHub en Vercel (dejando **Root Directory** vacío / raíz del repo).
2. De forma predeterminada en Vercel usa SQLite temporal en `/tmp/planificador.db` (los datos se reinician en cold starts).
3. Para persistencia en producción, configura la variable de entorno `DATABASE_URL` con una base PostgreSQL (por ejemplo Neon o Supabase) y agrega `psycopg2-binary` a `requirements.txt`.
