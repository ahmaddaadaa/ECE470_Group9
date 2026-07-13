# Simple student workflow

## 1. Generate results (Python, once)

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py
```

This writes:

- `../public/data/ga_results.json`  ← used by the dashboard
- `../public/data/dataset.json`

## 2. View dashboard (React)

```bash
cd ga-dashboard
npm start
```

Open the URL shown (often `http://localhost:3000/ECE470_Group9`).

## What the UI does

1. Loads `ga_results.json`
2. **Show Disturbed Data** — red curve (no control)
3. **Run Optimization** — green curve (GA schedule) + panels

No API server is required for the demo.
