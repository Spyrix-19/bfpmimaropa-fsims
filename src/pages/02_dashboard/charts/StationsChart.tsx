import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, tooltipStyle } from "./shared";

type StationsChartProps = {
  data: Array<{ name: string; actual: number }>;
  color: string;
};

export function StationsChart({ data, color }: StationsChartProps) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="name" {...axisProps} width={140} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="actual" fill={color} radius={[0, 4, 4, 0]} name="Actual" />
      </BarChart>
    </ResponsiveContainer>
  );
}
