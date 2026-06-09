import "../styles/StatisticsPanel.css";

function StatisticsPanel() {
  return (
    <div className="panel">

      <h2>Simulation Summary</h2>

      <p>Maximum Temperature: 42°C</p>

      <p>Control Cost: 18</p>

      <p>Time Within Range: 82%</p>

    </div>
  );
}

export default StatisticsPanel;
