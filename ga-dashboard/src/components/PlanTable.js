import ChromosomeBits, { ChromosomeLegend } from "./ChromosomeBits";

function fmtT(v) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return `${Number(v).toFixed(2)} C`;
}

function fmtD(v) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export default function PlanTable({
  actions,
  ranked,
  rankingStep,
  newestFirst = true
}) {
  if (!actions?.length && !ranked?.length) return null;

  const rows = newestFirst
    ? [...(actions || [])].sort((a, b) => Number(b.t) - Number(a.t))
    : [...(actions || [])];

  const top12 = [...(ranked || [])]
    .sort((a, b) => {
      const df = Number(b.fitness) - Number(a.fitness);
      if (df !== 0) return df;
      return Number(a.cost) - Number(b.cost);
    })
    .slice(0, 12)
    .map((r, i) => ({ ...r, rank: i + 1, isBest: i === 0 }));

  const rankLabelStep =
    rankingStep != null ? rankingStep : rows.length > 0 ? rows[0].t : null;

  return (
    <div className="tables-row">
      {rows.length > 0 && (
        <section className="card table-card">
          <div className="card-head">
            <h3>Step decisions</h3>
            <span className="card-tag">newest first · {rows.length} steps</span>
          </div>
          <ChromosomeLegend compact />
          <div className="table-scroll">
            <table className="data-table dense">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Original T</th>
                  <th>Optimized T</th>
                  <th>Chromosome</th>
                  <th>N</th>
                  <th>M</th>
                  <th>C</th>
                  <th>H</th>
                  <th>ΔT ctrl</th>
                  <th>Heat</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const n = row.applied?.nutrients ?? row.command?.nutrients;
                  const m = row.applied?.mixing ?? row.command?.mixing;
                  const c = row.applied?.cooling ?? row.command?.cooling;
                  const h = row.applied?.heating ?? row.command?.heating;
                  const isLatest = idx === 0;
                  const Topt = row.optimizedT ?? row.temperature;
                  const Torig = row.originalT;
                  const heatShow =
                    row.injectedDisturbance != null &&
                    Number(row.injectedDisturbance) !== 0
                      ? `${Number(row.injectedDisturbance) > 0 ? "+" : ""}${Number(
                          row.injectedDisturbance
                        ).toFixed(1)}`
                      : row.heat != null
                        ? fmtD(row.heat)
                        : "-";
                  return (
                    <tr
                      key={`step-${row.t}`}
                      className={isLatest ? "latest-row" : undefined}
                    >
                      <td>
                        {isLatest ? (
                          <span className="latest-badge">{row.t}</span>
                        ) : (
                          row.t
                        )}
                      </td>
                      <td className="temp-orig">{fmtT(Torig)}</td>
                      <td className="temp-fixed">{fmtT(Topt)}</td>
                      <td className="chromo-cell">
                        <ChromosomeBits
                          n={n}
                          m={m}
                          c={c}
                          h={h}
                          bits={row.command?.bits}
                          compact
                        />
                      </td>
                      <td>{n ?? "-"}</td>
                      <td>{m ?? "-"}</td>
                      <td>{c ?? "-"}</td>
                      <td>{h ?? "-"}</td>
                      <td>{fmtD(row.controlDelta)}</td>
                      <td>{heatShow}</td>
                      <td>{Number(row.stepCost || 0).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {top12.length > 0 && (
        <section className="card table-card rank-card">
          <div className="card-head">
            <h3>Top 12 by fitness, then step cost</h3>
            <span className="card-tag">
              {rankLabelStep != null
                ? `one step (#${rankLabelStep}) · levels 0–7`
                : "one step · levels 0–7"}
            </span>
          </div>
          <div className="table-scroll rank-scroll">
            <table className="data-table dense rank-table">
              <thead>
                <tr>
                  <th>Rk</th>
                  <th>Fit</th>
                  <th title="Cost of this single 12-bit chromosome only">
                    Step cost
                  </th>
                  <th>Chromosome (000–111)</th>
                  <th>N</th>
                  <th>M</th>
                  <th>C</th>
                  <th>H</th>
                  <th>ΔT</th>
                  <th>Temp</th>
                </tr>
              </thead>
              <tbody>
                {top12.map((r) => (
                  <tr
                    key={`rank-${r.rank}-${r.bits}-${r.n}-${r.m}-${r.c}-${r.h}`}
                    className={r.isBest ? "winner" : undefined}
                  >
                    <td className="rank-num">
                      {r.isBest ? (
                        <span className="rank-badge best">#{r.rank}</span>
                      ) : (
                        <span className="rank-badge">#{r.rank}</span>
                      )}
                    </td>
                    <td className="fit-cell">{Number(r.fitness).toFixed(1)}</td>
                    <td className="cost-cell">{Number(r.cost).toFixed(1)}</td>
                    <td className="chromo-cell">
                      <ChromosomeBits
                        n={r.n}
                        m={r.m}
                        c={r.c}
                        h={r.h}
                        bits={r.bits}
                        compact
                      />
                    </td>
                    <td>{r.n}</td>
                    <td>{r.m}</td>
                    <td>{r.c}</td>
                    <td>{r.h}</td>
                    <td>{fmtD(r.controlDelta)}</td>
                    <td className="temp-fixed">
                      {fmtT(r.temperature ?? r.nextT)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
