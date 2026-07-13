#!/usr/bin/env python3
# Local API: python3 api_server.py  ->  http://127.0.0.1:8000

from __future__ import annotations

import json
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from run_ga import build_results_payload, project_paths
from scenarios import generate_disturbed_dataset
from ga import run_ga_for_scenario

HOST = "127.0.0.1"
PORT = 8000

STATE = {
    "dataset": None,
}


def _json_response(handler: BaseHTTPRequestHandler, code: int, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[api] {self.address_string()} {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/api/health", "/health"):
            _json_response(
                self,
                200,
                {
                    "ok": True,
                    "service": "ga-api",
                    "hasDataset": STATE["dataset"] is not None,
                },
            )
            return
        if path == "/api/dataset":
            if STATE["dataset"] is None:
                _json_response(self, 404, {"error": "No dataset. Apply disturbance first."})
                return
            _json_response(self, 200, STATE["dataset"])
            return
        _json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = _read_json(self)

            if path == "/api/apply-disturbance":
                D = float(data.get("disturbanceScale", data.get("D", 1.0)))
                n = int(data.get("numScenarios", 20))
                seed = int(data.get("seed", 42))
                dataset = generate_disturbed_dataset(
                    num_scenarios=n,
                    disturbance_scale=D,
                    seed=seed,
                )
                STATE["dataset"] = dataset
                paths = project_paths()
                with open(paths["dataset"], "w", encoding="utf-8") as f:
                    json.dump(dataset, f, indent=2)
                _json_response(self, 200, dataset)
                return

            if path == "/api/run-ga":
                dataset = data.get("dataset") or STATE["dataset"]
                if dataset is None:
                    _json_response(
                        self,
                        400,
                        {"error": "No dataset. Call /api/apply-disturbance first."},
                    )
                    return

                sid = data.get("scenarioId", "sc_000")
                scenario = next(
                    (s for s in dataset["scenarios"] if s["id"] == sid),
                    None,
                )
                if scenario is None:
                    _json_response(self, 404, {"error": f"Scenario {sid} not found"})
                    return

                if "disturbanceScale" not in scenario:
                    scenario = {
                        **scenario,
                        "disturbanceScale": dataset.get("disturbanceScale", 1.0),
                    }

                pop = int(data.get("population", 70))
                gens = int(data.get("generations", 100))
                seed = int(data.get("seed", 7))

                print(f"GA start: {sid} pop={pop} gens={gens}")
                ga_result = run_ga_for_scenario(
                    scenario,
                    population_size=pop,
                    generations=gens,
                    seed=seed,
                    progress_every=25,
                )
                payload = build_results_payload(scenario, ga_result, dataset)
                paths = project_paths()
                with open(paths["results"], "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
                print(f"GA done: fitness={payload['fitness']['aggregate']}")
                _json_response(self, 200, payload)
                return

            _json_response(self, 404, {"error": "Not found"})
        except Exception as e:
            traceback.print_exc()
            _json_response(self, 500, {"error": str(e)})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Hybrid GA API listening on http://{HOST}:{PORT}")
    print("  POST /api/apply-disturbance")
    print("  POST /api/run-ga")
    print("  GET  /api/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
