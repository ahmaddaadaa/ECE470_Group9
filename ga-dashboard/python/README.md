# Python GA

Offline genetic algorithm (96-bit schedule: 8 steps × N/M/C/H).

## Run in terminal

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py --disturbance 1.0 --population 40 --generations 40
```

Prints generation progress. Writes:

- `../public/data/dataset.json`
- `../public/data/ga_results.json`

```bash
python3 run_ga.py --help
```

## Docker container

### Why we use Docker

The Python GA needs a fixed stack (Python 3 + NumPy). Putting it in a **container** means:

1. **Same environment everywhere** — classmates / lab machines do not need to match your local Python install.
2. **One command to start the API** — `docker compose up --build` builds the image and runs `api_server.py` on port 8000.
3. **Isolation** — dependencies stay inside the container; they do not pollute the host.
4. **Optional HTTP front** — the dashboard can stay pure JS; Docker is for people who want the **Python** GA as a small web service (`/api/health`, `/api/apply-disturbance`, `/api/run-ga`).

Docker is **not** required for the course demo. Terminal `run_ga.py` is enough to show the algorithm. The container is a packaging option for the same code.

### What the image does

| Piece | Role |
|-------|------|
| `Dockerfile` | copy GA modules, install `requirements.txt`, start API |
| `docker-compose.yml` | map host port 8000 → container, set `HOST` / `PORT` / `DATA_DIR` |
| Base image | `python:3.12-slim` from Docker Hub |
| Process | `python api_server.py` (listens on `0.0.0.0:8000` inside the container) |

### Commands

```bash
docker compose up --build
curl http://127.0.0.1:8000/api/health
docker compose down
```

Example GA call:

```bash
curl -s -X POST http://127.0.0.1:8000/api/apply-disturbance \
  -H "Content-Type: application/json" \
  -d '{"disturbanceScale":1.0,"numScenarios":5,"seed":7}'

curl -s -X POST http://127.0.0.1:8000/api/run-ga \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"sc_000","population":40,"generations":40,"seed":7}'
```

Needs [Docker Desktop](https://docs.docker.com/get-docker/) (or Docker Engine) installed.

### Docker references

- Docker overview: https://docs.docker.com/get-started/docker-overview/  
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/  
- Compose file: https://docs.docker.com/compose/  
- Official Python image: https://hub.docker.com/_/python  

## Local API without Docker

```bash
python3 api_server.py
# http://127.0.0.1:8000
```

## Files

| File | What it does |
|------|----------------|
| `chromosome.py` | 96-bit encoding |
| `model.py` | plant + cost |
| `fitness.py` | score trajectory |
| `ga.py` | selection, crossover, mutation |
| `scenarios.py` | heat disturbances |
| `run_ga.py` | CLI |
| `api_server.py` | HTTP API (used by Docker) |
| `Dockerfile` | container image build |
| `docker-compose.yml` | local container run |
