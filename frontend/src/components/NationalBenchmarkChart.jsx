import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api/axios";

export default function NationalBenchmarkChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get("/projects/national-benchmark/").then((res) => setData(res.data));
  }, []);

  if (!data.length) return null;

  return (
    <div>
      <h3>National Land Acquisition Cost Trend (NHAI, real data — data.gov.in)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis label={{ value: "₹ Cr / Hectare", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Line type="monotone" dataKey="avg_cost_cr_per_ha" stroke="#0d47a1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}