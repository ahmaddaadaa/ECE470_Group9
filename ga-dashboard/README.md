# ECE 470 – Group 9  
## Reactor temperature control with a genetic algorithm

Course project for **ECE 470**. We built a small demo where a simulated reactor should stay near **37 °C** (safe range **35–39 °C**) after a heat disturbance. A **genetic algorithm** picks control actions instead of a fixed PID-style law.

Everything lives under `ga-dashboard/`.

---

## What we built

Heat hits the plant. If you do nothing, temperature drifts out of the safe band (red curve). The GA tries different chromosomes and applies the best one it finds so temperature comes back toward 37 °C (green curve).

Each control step uses four actions, each as a level **0–7** (three bits, `000` … `111`):

| Gene | Name | What it does to temperature |
|------|------|-----------------------------|
| N | Nutrients | tends to **raise** T |
| M | Mixing | tends to **lower** T |
| C | Cooling | **lowers** T (main recovery tool) |
| H | Heating | **raises** T |

On the dashboard the chromosome for one step is **12 bits**:

```text
[ N 3 bits | M 3 bits | C 3 bits | H 3 bits ]
```

There are two software sides:

1. **React app (main demo)** — runs the GA in the browser, plots red vs green, shows the plan table and top-12 ranking, optional live stepping, optional **Arduino BLE**.
2. **Python package** — offline GA (96-bit full schedule), scenario generation, JSON export, optional local API.

You can finish the lab demo with only `npm start`. Python is there for offline runs and write-ups.

---

## How to run the dashboard

```bash
cd ga-dashboard
npm install
npm start
```

Open the URL the terminal prints (often includes `/ECE470_Group9` for GitHub Pages).

Suggested flow:

1. Set **Disturbance** strength.  
2. **Apply Disturbance** — red path without control.  
3. **Run Optimization** — green recovery + tables.  
4. **Watch Live** — both curves update once per second.  
5. (Optional) **Connect MKR WIFI 1010** if you uploaded the Arduino sketch.

---

## Arduino (MKR WIFI 1010) — optional

The dashboard can send N/M/C/H levels over **BLE** (Chrome Web Bluetooth on localhost).  
Arduino sketch files are kept **local only** (not in this git branch).  
If you have the sketch, upload it to an **MKR WIFI 1010** with **ArduinoBLE**; device name **`ECE470-MKR1010`**.

---

## Python offline GA (optional)

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py --disturbance 1.0 --population 70 --generations 100
```

That writes JSON under `public/data/`. Optional API:

```bash
python3 api_server.py
# http://127.0.0.1:8000
```

---

## Plant model (dashboard)

At each step:

```text
ΔT = wN·N + wH·H − wC·C − wM·M + heat
T_next = T + ΔT
```

Current browser weights (°C per level):

| Weight | Value | Role |
|--------|-------|------|
| wN | 0.20 | nutrients raise T |
| wM | 0.28 | mixing lowers T |
| wC | 0.65 | cooling lowers T |
| wH | 0.55 | heating raises T |

Target **37 °C**, safe band **35–39 °C**. Fitness scores how close you are to the target and the band, how much better you are than doing nothing, and subtracts cost / extreme temperatures.

---

## Folder map

```text
ga-dashboard/
├── src/
│   ├── App.js
│   ├── components/     chart, tables, BLE bar, …
│   ├── ga/             browser GA (model, chromosome, engine, live)
│   ├── ble/            Web Bluetooth client
│   └── styles/
├── arduino/            MKR WIFI 1010 sketch + notes
├── python/             offline GA + API
├── public/data/        sample JSON
├── PROJECT_REPORT.md
└── README.md
```

---

## References

**GA / chromosomes**

- [DEAP](https://github.com/DEAP/deap)  
- [PyGAD](https://github.com/ahmedfgad/GeneticAlgorithmPython)  
- [scikit-opt](https://github.com/guofei9987/scikit-opt)  
- Goldberg — *Genetic Algorithms in Search, Optimization, and Machine Learning*

**React / charts / styling**

- [Create React App](https://github.com/facebook/create-react-app)  
- [React](https://github.com/facebook/react)  
- [Recharts](https://github.com/recharts/recharts)  
- [React styling](https://react.dev/learn/styling-css)

**Arduino BLE**

- [ArduinoBLE library](https://github.com/arduino-libraries/ArduinoBLE)  
- Board docs for **MKR WIFI 1010**

---

## Group

ECE 470 – Group 9.  
Main work is on the chromosome / dashboard branch under this package.

Academic use for the course. Dependencies: `package.json` and `python/requirements.txt`.
