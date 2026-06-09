import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";

import "../styles/TemperatureChart.css";

function TemperatureChart({ data }) {
  return (
    <div className="chart-panel">

      <div className="chart-header">

        <h2>Temperature Response</h2>

        <p className="chart-description">
          The chart below shows a sample reactor temperature profile before
          and after optimization.
        </p>

        <p className="target-note">
          Optimal Operating Temperature: 37°C
        </p>

        <p className="safe-range">
          Acceptable Operating Range: 35°C - 39°C
        </p>

      </div>

      <div className="chart-container">

        <ResponsiveContainer width="100%" height={450}>
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 10
            }}
          >

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="time"
              label={{
                value: "Time Step",
                position: "insideBottom",
                offset: -5
              }}
            />

            <YAxis
              domain={[30, 45]}
              label={{
                value: "Temperature (°C)",
                angle: -90,
                position: "insideLeft"
              }}
            />

            <Tooltip />

            <Legend />

            {/* Target Temperature */}
            <ReferenceLine
                y={37}
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="6 6"
                label={{
                    value: "Target 37°C",
                    position: "right"
                }}
            />

            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 8 }}
              name="Reactor Temperature"
            />

          </LineChart>
        </ResponsiveContainer>

      </div>

    </div>
  );
}

export default TemperatureChart;
