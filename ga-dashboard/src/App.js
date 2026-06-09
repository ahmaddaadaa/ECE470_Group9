import { useState } from "react";

import "./styles/App.css";

import Header from "./components/Header";
import TemperatureChart from "./components/TemperatureChart";
import EquationPanel from "./components/EquationPanel";
import ControlPanel from "./components/ControlPanel";
import FitnessPanel from "./components/FitnessPanel";
import ChromosomePanel from "./components/ChromosomePanel";
import StatisticsPanel from "./components/StatisticsPanel";

function App() {

  const unsafeData = [
    { time: 0, temperature: 37 },
    { time: 1, temperature: 38 },
    { time: 2, temperature: 40 },
    { time: 3, temperature: 42 },
    { time: 4, temperature: 43 },
    { time: 5, temperature: 44 },
    { time: 6, temperature: 43 },
    { time: 7, temperature: 42 }
  ];

  const optimizedData = [
    { time: 0, temperature: 37 },
    { time: 1, temperature: 37.5 },
    { time: 2, temperature: 37.8 },
    { time: 3, temperature: 37.2 },
    { time: 4, temperature: 37.0 },
    { time: 5, temperature: 36.9 },
    { time: 6, temperature: 37.1 },
    { time: 7, temperature: 37.0 }
  ];

  const [chartData, setChartData] =
    useState(unsafeData);

  const [optimized, setOptimized] =
    useState(false);

  const runOptimization = () => {
    setChartData(optimizedData);
    setOptimized(true);
  };

  const resetScenario = () => {
    setChartData(unsafeData);
    setOptimized(false);
  };

  return (
    <div className="app">

      <Header />

      <TemperatureChart data={chartData} />

          <div className="button-section">

        <button
          onClick={runOptimization}
          className="run-button"
        >
          Run Optimization
        </button>

        <button
          onClick={resetScenario}
          className="reset-button"
        >
          Reset Scenario
        </button>

      </div>

      <div className="status-banner">

        {optimized
          ? "Optimization Complete (Example Data)"
          : "Unsafe Operating Condition (Example Data)"}
          <div>{"\n"}</div>

      </div>

      <EquationPanel />

      <div className="dashboard-grid">

        <ControlPanel />

        <FitnessPanel />

        <ChromosomePanel />

        <StatisticsPanel />

      </div>


    </div>
  );
}

export default App;
