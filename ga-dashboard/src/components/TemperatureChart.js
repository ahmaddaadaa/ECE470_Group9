import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { SAFE_LOW, SAFE_HIGH, TARGET } from "../ga/model";

const RED = "#c62828";
const GREEN = "#2e7d32";

function inBand(t) {
  return typeof t === "number" && t >= SAFE_LOW && t <= SAFE_HIGH;
}

function buildData({ baseline, optimized, dualLive, data, single }) {
  if (dualLive && data?.length) {
    return data.map((p) => ({
      time: p.time,
      baseline: p.baseline,
      optimized: p.optimized ?? p.temperature
    }));
  }

  if (
    data?.length &&
    data.some(
      (p) => p.baseline != null && (p.optimized != null || p.temperature != null)
    )
  ) {
    return data.map((p) => ({
      time: p.time,
      baseline: p.baseline,
      optimized: p.optimized ?? p.temperature
    }));
  }

  if (baseline?.length && optimized?.length) {
    const n = Math.max(baseline.length, optimized.length);
    return Array.from({ length: n }, (_, i) => ({
      time: baseline[i]?.time ?? optimized[i]?.time ?? i,
      baseline: baseline[i]?.temperature ?? baseline[i]?.baseline,
      optimized: optimized[i]?.temperature ?? optimized[i]?.optimized
    }));
  }

  if (baseline?.length) {
    return baseline.map((p) => ({
      time: p.time,
      baseline: p.temperature ?? p.baseline
    }));
  }

  if (single?.length || optimized?.length) {
    const src = single || optimized;
    return src.map((p) => ({
      time: p.time,
      optimized: p.temperature ?? p.optimized
    }));
  }

  return [];
}

function OriginalDot(props) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.baseline == null) return null;
  const out = !inBand(payload.baseline);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={out ? 4.5 : 3}
      fill={out ? RED : "#ef9a9a"}
      stroke="#fff"
      strokeWidth={1}
    />
  );
}

function SimpleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="chart-tooltip">
      <div className="tt-title">t = {label}</div>
      {row.baseline != null && (
        <div className="tt-row red">
          Original: <strong>{Number(row.baseline).toFixed(2)} C</strong>
        </div>
      )}
      {row.optimized != null && (
        <div className="tt-row green">
          Optimized: <strong>{Number(row.optimized).toFixed(2)} C</strong>
        </div>
      )}
    </div>
  );
}

export default function TemperatureChart({
  baseline,
  optimized,
  data,
  single,
  showBoth,
  dualLive,
  mode
}) {
  const chartData = buildData({
    baseline,
    optimized,
    dualLive: dualLive || showBoth,
    data,
    single
  });

  const vals = chartData.flatMap((p) =>
    [p.baseline, p.optimized].filter((v) => typeof v === "number")
  );
  const rawMin = vals.length ? Math.min(...vals) : 35;
  const rawMax = vals.length ? Math.max(...vals) : 40;
  const pad = Math.max(0.35, (rawMax - rawMin) * 0.1);
  let yMin = Math.floor((rawMin - pad) * 2) / 2;
  let yMax = Math.ceil((rawMax + pad) * 2) / 2;
  yMin = Math.min(yMin, SAFE_LOW - 0.2);
  yMax = Math.max(yMax, SAFE_HIGH + 0.2);
  if (yMax - yMin < 2.5) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - 1.25;
    yMax = mid + 1.25;
  }

  const hasOriginal = chartData.some((p) => p.baseline != null);
  const hasOptimized = chartData.some((p) => p.optimized != null);

  const title =
    mode === "base" || (hasOriginal && !hasOptimized)
      ? "Temperature (no control)"
      : "Temperature";

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="card-tag">
          Target 37 C, safe {SAFE_LOW} to {SAFE_HIGH} C
        </span>
      </div>

      {!chartData.length ? (
        <p className="empty">Apply a disturbance to plot temperature.</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 10, left: 0, bottom: 2 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickCount={Math.min(16, Math.max(4, chartData.length))}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11 }}
                width={36}
                tickCount={6}
              />
              <Tooltip content={<SimpleTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <ReferenceArea
                y1={SAFE_LOW}
                y2={SAFE_HIGH}
                fill="#c8e6c9"
                fillOpacity={0.25}
              />
              <ReferenceLine
                y={TARGET}
                stroke="#66bb6a"
                strokeDasharray="4 3"
                strokeWidth={1}
              />

              {hasOriginal && (
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Original"
                  stroke={RED}
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  dot={<OriginalDot />}
                  activeDot={{ r: 5, fill: RED }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}

              {hasOptimized && (
                <Line
                  type="monotone"
                  dataKey="optimized"
                  name="Optimized"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: GREEN, stroke: "#fff", strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: GREEN }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
