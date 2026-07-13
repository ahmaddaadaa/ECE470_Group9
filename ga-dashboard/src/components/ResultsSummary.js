export default function ResultsSummary({
  latestFitness,
  latestCost,
  planCost,
  stepIndex,
  statistics,
  peakBefore
}) {
  if (
    latestFitness == null &&
    latestCost == null &&
    !statistics &&
    planCost == null
  ) {
    return null;
  }

  const items = [
    {
      label: "Fitness",
      value:
        latestFitness != null && Number.isFinite(Number(latestFitness))
          ? Number(latestFitness).toFixed(1)
          : "-"
    },
    {
      label: "Step cost",
      value:
        latestCost != null && Number.isFinite(Number(latestCost))
          ? Number(latestCost).toFixed(2)
          : "-"
    },
    {
      label: "Plan cost",
      value:
        planCost != null && Number.isFinite(Number(planCost))
          ? Number(planCost).toFixed(2)
          : "-"
    }
  ];

  if (stepIndex != null) {
    items.push({ label: "At step", value: String(stepIndex) });
  }

  if (statistics) {
    items.push({
      label: "In range",
      value: `${(statistics.pctInRange * 100).toFixed(0)}%`
    });
    items.push({
      label: "Max / min T",
      value: `${statistics.maxTemperature} / ${statistics.minTemperature}`
    });
  }

  if (peakBefore != null) {
    items.push({
      label: "Max without control",
      value: Number(peakBefore).toFixed(1)
    });
  }

  return (
    <section className="stats-bar">
      {items.map((it) => (
        <div key={it.label} className="stat-chip">
          <span className="stat-label">{it.label}</span>
          <span className="stat-value">{it.value}</span>
        </div>
      ))}
    </section>
  );
}
