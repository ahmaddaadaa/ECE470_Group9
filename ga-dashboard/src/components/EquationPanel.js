import "../styles/EquationPanel.css";

function EquationPanel() {
  return (
    <div className="equation-panel">

      <h2>System Model</h2>

      <div className="equation-box">
        ΔT = Nutrients + Heat − Cooling − Mixing + Noise
      </div>

      <p>
        This simplified model is used to represent how different control
        actions influence reactor temperature.
      </p>

      <p>
        Cooling and mixing help remove heat, while nutrients and heating
        contribute to temperature increases.
      </p>

    </div>
  );
}

export default EquationPanel;
