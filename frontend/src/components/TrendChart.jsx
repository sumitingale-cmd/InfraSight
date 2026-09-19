import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const barColor = (score) => {
  if (score < 25) return "#2e7d32";
  if (score < 50) return "#f9a825";
  if (score < 75) return "#ef6c00";
  return "#c62828";
};

export default function TrendChart({ data, xKey = "district" }) {
  // data: [{ district: "Pune", avgRisk: 62 }, ...] or [{ state: "...", avgRisk: ... }]
  if (!data.length) return <p>No prediction data yet — run some risk predictions first.</p>;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} angle={-30} textAnchor="end" height={80} interval={0} />
        <YAxis label={{ value: "Avg. Risk Score (%)", angle: -90, position: "insideLeft" }} domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="avgRisk">
          {data.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.avgRisk)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}