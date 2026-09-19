const BAND_COLORS = { Low: "#2e7d32", Medium: "#f9a825", High: "#ef6c00", Critical: "#c62828" };

export default function RiskGauge({ score, band }) {
  return (
    <div className="risk-gauge">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#e0e0e0" strokeWidth="10" />
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          fill="none"
          stroke={BAND_COLORS[band] || "#1976d2"}
          strokeWidth="10"
          strokeDasharray={`${(score / 100) * 157} 157`}
        />
        <text x="60" y="45" textAnchor="middle" fontSize="18" fontWeight="bold">{score}%</text>
      </svg>
      <p className={`band-label band-${(band || "").toLowerCase()}`}>{band}</p>
    </div>
  );
}