# Python offline GA

Optional. The React dashboard already runs the GA in the browser.

```bash
cd ga-dashboard/python
pip install -r requirements.txt
python3 run_ga.py --disturbance 1.0 --population 70 --generations 100
```

Writes JSON under `../public/data/`.

Optional local API:

```bash
python3 api_server.py
# http://127.0.0.1:8000
```
