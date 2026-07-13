# ECE 470 – Group 9  
# Genetic Algorithm for Reactor Temperature Control

**Course:** ECE 470  

This write-up is the design story for our `ga-dashboard` project: what the system is, how the chromosome works, how fitness is scored, and how the Arduino BLE piece fits in. The interactive demo runs in the browser. Python under `python/` is the offline twin for batch runs and JSON export.

---

## 1. What we are trying to do

Imagine a small reactor that should sit near **37 °C**. Safe band is **35–39 °C**. A heat disturbance can push temperature up. If we do nothing, we leave the band. If we control well, we come back.

Our controller is a **genetic algorithm**, not a single “tweak the last answer” hill climb. We keep a **population** of chromosomes, score them, keep the good ones, cross them, and mutate them.

On the screen you get:

- **Red** = original path with the same heat and **no** control  
- **Green** = path with GA control  
- A **step table** (one temperature value per step for red and green)  
- **Top 12** chromosomes ranked by fitness, then cost  
- Optional **live** mode (one second per step)  
- Optional **Arduino MKR WIFI 1010** over BLE to apply N/M/C/H on real pins  

---

## 2. Plant model

One time step:

```text
ΔT = wN·N + wH·H − wC·C − wM·M + heat
T_next = T + ΔT
```

| Symbol | Meaning |
|--------|---------|
| N, M, C, H | levels **0–7** |
| wN … wH | how many °C each level moves temperature |
| heat | disturbance scale × pulse shape + small noise |

### 2.1 Weights used in the browser (`src/ga/model.js`)

| Weight | Value (°C / level) | Effect |
|--------|--------------------|--------|
| wN | 0.20 | nutrients raise T |
| wM | 0.28 | mixing lowers T |
| wC | 0.65 | cooling lowers T (main recovery) |
| wH | 0.55 | heating raises T |

These are strong enough that green can climb back into the band after a clear heat spike, without looking like an instant teleport.

**Target:** 37 °C  
**Safe band:** 35–39 °C  

### 2.2 Control cost (one step)

```text
cost = 0.3·N + 0.2·M + 0.7·C + 0.65·H + 1.0·min(C, H)
```

Cooling and heating are expensive. Using both at once gets an extra overlap penalty so the GA does not “fight itself.”

### 2.3 Disturbance

When you click **Apply Disturbance**, we pick a starting T near 37 °C and a heat pulse that rises then falls over the horizon. The slider multiplies how hard that pulse hits. Red shows “what if we never controlled.” Green shows “what if we apply the GA each step.”

---

## 3. Chromosome design

### 3.1 Dashboard (what the live UI optimizes)

One chromosome = **one control decision** = **12 bits**:

```text
[ Nutrients 3 | Mixing 3 | Cooling 3 | Heating 3 ]
```

Every field is a level **0–7** (`000` … `111`).  
At each step we run the GA once, take **rank #1**, apply it, then move on. So improvement is step-by-step, not one frozen 8-step open-loop only.

### 3.2 Levels

| Bits | Level | Meaning |
|------|-------|---------|
| 000 | 0 | off |
| 001 | 1 | very low |
| 010 | 2 | low |
| 011 | 3 | low–medium |
| 100 | 4 | medium |
| 101 | 5 | medium–high |
| 110 | 6 | high |
| 111 | 7 | max |

Example: `010 100 101 000` → N=2, M=4, C=5, H=0.

We seed and mutate so the population still sees the full 0–7 range, not only “mild cooling.”

### 3.3 Python offline package

Python still uses an **8-step × 12-bit = 96-bit** schedule chromosome (full open-loop plan with slew limits). Same gene idea (N/M/C/H, 0–7), longer individual. That is useful for CLI demos and JSON dumps even though the live UI focuses on one decision per step.

---

## 4. Fitness (browser)

For one candidate at the current temperature and heat:

```text
fitness = quality + improvement + toward − costPen − unsafe
```

Roughly:

| Piece | Idea |
|-------|------|
| quality | reward being in 35–39, penalize \|T−37\| and out-of-band distance |
| improvement | beat “do nothing this step” (T + heat only) |
| toward | reward moving closer to 37 than you were |
| costPen | penalize expensive actuators (lighter when you still need recovery) |
| unsafe | hard hit if T is extreme (below ~31 or above ~46) |

**Higher fitness is better.**  
When two chromosomes score the same, **lower step cost** wins.

That is why the side panel shows:

- **Latest fitness / latest step cost** — this step’s winner (same idea as top-ranked for that step)  
- **Plan cost Σ** — sum of step costs so far  

They are not the same number on purpose.

---

## 5. Fitness (Python offline)

Trajectory score (simplified form of `python/fitness.py`):

```text
f = 30·(fraction in 35–39)
  − 10·mean|T−37|
  − 50·(mean out-of-band²)
  − 0.15·control cost
  − 100·(unsafe steps outside 34–42)
  + 12 if nearly perfect
```

Multi-scenario averages exist for harder offline tests.

---

## 6. Genetic algorithm loop

Typical browser settings (order of magnitude):

| Parameter | About |
|-----------|--------|
| Population | 40–70 |
| Generations | 30–50 per step |
| Selection | tournament |
| Crossover | swap whole 3-bit genes |
| Mutation | rewrite a gene to any 0–7, plus occasional bit flips |
| Elitism | keep a couple of best individuals |

Python’s `ga.py` is the same story with tournament, two-point crossover on bit strings, mutation, and elitism, usually on the 96-bit schedule.

We do **not** use hill climbing as the main search. The population can explore different cool/heat/mix/nutrient mixes.

---

## 7. Dashboard behaviour

1. **Apply Disturbance** — new heat case; red baseline.  
2. **Run Optimization** — green recovery plan + tables.  
3. **Watch Live** — red and green step once per second; ranking and latest fitness/cost refresh.  
4. **Queue extra heat** (live) — optional inject ± heat for the next step.  
5. **Arduino BLE** — optional; simulation still runs even if the board is offline.

Chart stays simple: dual curves, safe band, last ~16 points so it is not zoomed out into empty space. Original (red) reads clearly when out of band.

---

## 8. Arduino MKR WIFI 1010

Hardware path is **BLE** with the **ArduinoBLE** library.

Sketch:

```text
arduino/mkr_wifi1010_ble_control/mkr_wifi1010_ble_control.ino
```

The board advertises as **`ECE470-MKR1010`**. The browser (Chrome/Edge on localhost) connects with Web Bluetooth and writes `N,M,C,H`. Pins 2–5 get PWM for the four actions. Temperature is simulated on the board by default so you can demo without sensors; flip a flag in the sketch for a real A0 sensor.

This does **not** replace the GA in the browser. It just applies the same levels the GA already chose.

---

## 9. Main files

### Browser

| File | Role |
|------|------|
| `src/ga/model.js` | weights, cost, step update, heat |
| `src/ga/chromosome.js` | 12-bit encode/decode, seeds, crossover, mutate |
| `src/ga/gaEngine.js` | fitness, one-step GA, full dual-trajectory run |
| `src/ga/scenario.js` | random disturbance cases |
| `src/ga/realtime.js` | live dual sim |
| `src/ble/arduinoBle.js` | Web Bluetooth client |
| `src/components/*` | chart, tables, BLE bar, stats |
| `src/App.js` | buttons and state |

### Python

| File | Role |
|------|------|
| `chromosome.py` | 96-bit schedule |
| `model.py` | plant + slew + cost |
| `fitness.py` | trajectory fitness |
| `ga.py` | GA loop |
| `scenarios.py` | dataset generation |
| `run_ga.py` | CLI → JSON |
| `api_server.py` | optional HTTP API |

---

## 10. Design choices (short)

| Choice | Why |
|--------|-----|
| GA, not only hill climbing | search many schedules, less stuck |
| Full 0–7 on every gene | simple discrete levels, full binary range |
| Stronger cool weight in the UI | green recovery is visible after a heat pulse |
| Dual red/green chart | easy to see the value of control |
| One fixed T per step in tables | easier to read than long “continuous path” strings |
| BLE optional | hardware demo without blocking pure software demos |

---

## 11. How to run

**Dashboard**

```bash
cd ga-dashboard
npm install
npm start
```

**Python**

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py
```

**Docker (optional packaging of the Python API)**

We wrap the same Python GA in a container so anyone with Docker can start the API without installing Python packages by hand:

```bash
cd ga-dashboard/python
docker compose up --build
curl http://127.0.0.1:8000/api/health
```

| Why | Explanation |
|-----|-------------|
| Reproducible environment | Image uses `python:3.12-slim` + `requirements.txt` |
| Easy demo on another PC | No “wrong Python version / missing NumPy” setup |
| Isolated process | API runs only inside the container on port 8000 |
| Same code as CLI | Container just runs `api_server.py`; algorithm is still `ga.py` |

The React dashboard and GitHub Pages site do **not** depend on Docker. They use the browser GA. Docker is only for the Python offline/API path. See `python/Dockerfile` and `python/docker-compose.yml`.

**Arduino**

Upload `arduino/mkr_wifi1010_ble_control/mkr_wifi1010_ble_control.ino` (needs ArduinoBLE). See `arduino/README.md`.

---

## 12. Summary

We use a genetic algorithm to keep a simulated reactor near 37 °C after a heat disturbance. Chromosomes encode nutrients, mixing, cooling, and heating at levels 0–7. Fitness rewards the safe band and beating “do nothing,” and penalizes error, cost, and extreme temperatures. The React app shows red vs green, ranks candidates, and can stream levels to an MKR WIFI 1010 over BLE. Python provides the same GA ideas offline for datasets and reports. Optionally, that Python API can be started inside a Docker container for a portable, reproducible demo environment.

---

## 13. References

[1] D. E. Goldberg, *Genetic Algorithms in Search, Optimization, and Machine Learning*. Addison-Wesley, 1989.  
[2] M. Mitchell, *An Introduction to Genetic Algorithms*. MIT Press, 1996.  
[3] DEAP (Distributed Evolutionary Algorithms in Python): https://github.com/DEAP/deap  
[4] PyGAD: https://github.com/ahmedfgad/GeneticAlgorithmPython  
[5] K. J. Åström and T. Hägglund, *PID Controllers: Theory, Design, and Tuning*, 2nd ed. ISA, 1995.  
[6] Arduino PID Library: https://github.com/br3ttb/Arduino-PID-Library  
[7] ArduinoBLE library: https://github.com/arduino-libraries/ArduinoBLE  
[8] Arduino MKR WIFI 1010 documentation: https://docs.arduino.cc/hardware/mkr-wifi-1010  
[9] MDN Web Bluetooth API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API  
[10] Chrome Web Bluetooth samples: https://googlechrome.github.io/samples/web-bluetooth/  
[11] React: https://github.com/facebook/react  
[12] Create React App: https://github.com/facebook/create-react-app  
[13] Recharts: https://github.com/recharts/recharts  
[14] NumPy: https://github.com/numpy/numpy  
[15] ECE 470 course materials (instructor-provided).  
[16] Project repository: https://github.com/ahmaddaadaa/ECE470_Group9  
[17] Docker documentation: https://docs.docker.com/  
[18] Docker Compose: https://docs.docker.com/compose/  
[19] Official Python Docker image: https://hub.docker.com/_/python  
[20] Docker overview (what containers are for): https://docs.docker.com/get-started/docker-overview/  

---
