// Colored bit chips for N / M / C / H (each 3 bits)

function levelToBits(level) {
  const v = Math.max(0, Math.min(7, Number(level) | 0));
  return v.toString(2).padStart(3, "0");
}

function parseFromString(bitsStr) {
  if (!bitsStr || typeof bitsStr !== "string") return null;
  // Accept "[000 001 010 011]" or "000 001 010 011" or "000001010011"
  const cleaned = bitsStr.replace(/[[\],]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 4 && parts.every((p) => /^[01]{3}$/.test(p))) {
    return {
      n: parseInt(parts[0], 2),
      m: parseInt(parts[1], 2),
      c: parseInt(parts[2], 2),
      h: parseInt(parts[3], 2)
    };
  }
  const digits = cleaned.replace(/\s/g, "");
  if (/^[01]{12}$/.test(digits)) {
    return {
      n: parseInt(digits.slice(0, 3), 2),
      m: parseInt(digits.slice(3, 6), 2),
      c: parseInt(digits.slice(6, 9), 2),
      h: parseInt(digits.slice(9, 12), 2)
    };
  }
  return null;
}

const GENES = [
  { key: "n", label: "N", cls: "gene-n", title: "Nutrients (raises T)" },
  { key: "m", label: "M", cls: "gene-m", title: "Mixing (lowers T)" },
  { key: "c", label: "C", cls: "gene-c", title: "Cooling (lowers T)" },
  { key: "h", label: "H", cls: "gene-h", title: "Heating (raises T)" }
];

/**
 * props:
 *  - n,m,c,h levels OR bits string
 *  - showLabels: show N/M/C/H labels above chips
 *  - compact: smaller chips for tables
 */
export default function ChromosomeBits({
  n,
  m,
  c,
  h,
  bits,
  showLabels = false,
  compact = false
}) {
  let levels = { n, m, c, h };
  if (
    (n == null || m == null || c == null || h == null) &&
    bits != null
  ) {
    const parsed = parseFromString(bits);
    if (parsed) levels = parsed;
  }

  if (
    levels.n == null ||
    levels.m == null ||
    levels.c == null ||
    levels.h == null
  ) {
    return <span className="chromo-missing">—</span>;
  }

  return (
    <span
      className={`chromo ${compact ? "chromo-compact" : ""}`}
      title="Chromosome: [N M C H] each 3 bits, levels 0–7"
    >
      {GENES.map((g) => {
        const level = levels[g.key];
        const bitStr = levelToBits(level);
        return (
          <span key={g.key} className={`gene ${g.cls}`} title={`${g.title}: level ${level} = ${bitStr}`}>
            {showLabels && <span className="gene-label">{g.label}</span>}
            <span className="gene-bits">
              {bitStr.split("").map((b, i) => (
                <span
                  key={i}
                  className={`bit bit-${b === "1" ? "one" : "zero"}`}
                >
                  {b}
                </span>
              ))}
            </span>
            <span className="gene-level">{level}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Small legend for the page */
export function ChromosomeLegend({ compact = false }) {
  return (
    <div className={`chromo-legend ${compact ? "chromo-legend-compact" : ""}`}>
      <span className="legend-title">Bits:</span>
      <span className="gene gene-n legend-item">
        <span className="gene-label">N</span>
        {compact ? "↑" : " nutrients (↑T)"}
      </span>
      <span className="gene gene-m legend-item">
        <span className="gene-label">M</span>
        {compact ? "↓" : " mixing (↓T)"}
      </span>
      <span className="gene gene-c legend-item">
        <span className="gene-label">C</span>
        {compact ? "↓" : " cooling (↓T)"}
      </span>
      <span className="gene gene-h legend-item">
        <span className="gene-label">H</span>
        {compact ? "↑" : " heating (↑T)"}
      </span>
      {!compact && (
        <span className="legend-note">
          Light chip = 0 · Dark chip = 1 · number = level 0–7
        </span>
      )}
    </div>
  );
}
