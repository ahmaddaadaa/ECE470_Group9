# ECE 470 – Group 9
## Reactor temperature control with a genetic algorithm

Course project. Simulated reactor near **37 °C** (safe band **35–39 °C**). After a heat disturbance, a **genetic algorithm** chooses control actions.

Code is under `ga-dashboard/`.

## Idea

Red curve = no control. Green curve = GA control back toward 37 °C.

Each step uses four levels **0–7** (3 bits each):

| Gene | Name | Effect on T |
|------|------|-------------|
| N | Nutrients | raises |
| M | Mixing | lowers |
| C | Cooling | lowers |
| H | Heating | raises |

Dashboard chromosome (one step) = **12 bits**:

```text
[ N | M | C | H ]   each 3 bits
```

- **React app** — browser GA, chart, tables, optional Arduino BLE  
- **Python** — offline GA (96-bit full schedule), run in terminal or Docker  

For a basic demo, `npm start` is enough. Use Python when you want to show the algorithm in the terminal.

## Dashboard

```bash
cd ga-dashboard
npm install
npm start
```

Typical flow: set disturbance → Apply Disturbance → Run Optimization → Watch Live.  
Optional: connect MKR WIFI 1010 in Chrome (BLE).

## Arduino (optional)

BLE with **ArduinoBLE**, board name **`ECE470-MKR1010`**. Sketch is local under `arduino/` (not always on git). Sends levels `N,M,C,H`.

## Python GA (terminal)

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py --disturbance 1.0 --population 40 --generations 40
```

You should see lines like `gen 0: best=... avg=...`.

Results go to:

- `public/data/dataset.json`
- `public/data/ga_results.json`

| File | Role |
|------|------|
| `python/chromosome.py` | 96-bit schedule |
| `python/model.py` | plant + cost |
| `python/fitness.py` | fitness |
| `python/ga.py` | GA loop |
| `python/run_ga.py` | CLI |

```bash
python3 run_ga.py --help
```

Optional API: `python3 api_server.py` → `http://127.0.0.1:8000`

### Docker container (optional)

We also package the Python GA as a **Docker container** so the algorithm can run the same way on any machine that has Docker (same Python version, same dependencies). That avoids “it works on my laptop” install issues for a demo or lab PC.

The container runs `api_server.py` and exposes an HTTP API on port **8000**. The React / GitHub Pages UI does **not** need Docker; it uses the browser GA. Docker is only for the **Python** path.

**Why use a container here**

| Reason | Detail |
|--------|--------|
| Reproducible | Image pins Python + NumPy; no manual `pip` fights |
| Isolated | GA API does not mess with the rest of the system |
| Portable | Same `docker compose up` on Mac, Windows, or lab Linux |
| Optional service | Other tools can call `/api/run-ga` over HTTP |

**Run it**

```bash
cd ga-dashboard/python
docker compose up --build
curl http://127.0.0.1:8000/api/health
```

| File | Role |
|------|------|
| `python/Dockerfile` | how the image is built |
| `python/docker-compose.yml` | one-command start on port 8000 |
| `python/api_server.py` | GA HTTP API inside the container |

Stop with `docker compose down`. More notes: `python/README.md`.

## Plant model (dashboard)

```text
dT = wN*N + wH*H - wC*C - wM*M + heat
T_next = T + dT
```

| Weight | Value |
|--------|-------|
| wN | 0.20 |
| wM | 0.28 |
| wC | 0.65 |
| wH | 0.55 |

## Folder layout

```text
ga-dashboard/
  src/          React UI + browser GA
  ble/          Web Bluetooth
  python/       offline GA
  arduino/      MKR sketch (local)
  public/data/  sample JSON
```

## References

1. D. E. Goldberg, *Genetic Algorithms in Search, Optimization, and Machine Learning*. Addison-Wesley, 1989.  
2. M. Mitchell, *An Introduction to Genetic Algorithms*. MIT Press, 1996.  
3. [DEAP](https://github.com/DEAP/deap)  
4. [PyGAD](https://github.com/ahmedfgad/GeneticAlgorithmPython)  
5. K. J. Åström and T. Hägglund, *PID Controllers: Theory, Design, and Tuning*, 2nd ed. ISA, 1995.  
6. [Arduino PID Library](https://github.com/br3ttb/Arduino-PID-Library)  
7. [ArduinoBLE](https://github.com/arduino-libraries/ArduinoBLE)  
8. [MKR WIFI 1010 docs](https://docs.arduino.cc/hardware/mkr-wifi-1010)  
9. [MDN Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)  
10. [Chrome Web Bluetooth samples](https://googlechrome.github.io/samples/web-bluetooth/)  
11. [React](https://github.com/facebook/react)  
12. [Create React App](https://github.com/facebook/create-react-app)  
13. [Recharts](https://github.com/recharts/recharts)  
14. [NumPy](https://github.com/numpy/numpy)  
15. [Docker docs](https://docs.docker.com/) — containers and images  
16. [Docker Compose](https://docs.docker.com/compose/) — multi-service / one-command local run  
17. [python Docker official image](https://hub.docker.com/_/python) — base image we use (`python:3.12-slim`)

## Group

ECE 470 Group 9.
