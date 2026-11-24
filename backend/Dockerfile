ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

USER root
WORKDIR /app

COPY requirements-db.txt requirements-backend.txt ./
RUN python -m pip install --no-cache-dir -r requirements-backend.txt

COPY database/*.py ./database/
COPY backend/ ./backend/

USER 10001:10001

CMD ["sh", "-c", "exec python -m uvicorn backend.main:app --host 0.0.0.0 --port \"$PORT\""]
