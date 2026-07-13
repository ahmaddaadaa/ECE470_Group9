# ECE 470 Group 9 — Python GA API image
#
# Why Docker:
#   - same Python + NumPy on any machine
#   - no local pip setup for a demo
#   - runs api_server.py (HTTP front for ga.py)
#
# Build/run:
#   docker compose up --build
#   curl http://127.0.0.1:8000/api/health
#
# Refs: https://docs.docker.com/  https://hub.docker.com/_/python

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# GA modules + HTTP server
COPY chromosome.py fitness.py ga.py model.py scenarios.py run_ga.py api_server.py ./
RUN mkdir -p /app/public/data

# 0.0.0.0 = accept connections from outside the container
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATA_DIR=/app/public/data

EXPOSE 8000
CMD ["python", "api_server.py"]
