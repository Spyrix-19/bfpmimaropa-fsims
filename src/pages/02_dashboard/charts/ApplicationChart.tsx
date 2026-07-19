import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, tooltipStyle } from "./shared";

type ApplicationChartProps = {
  data: Array<{ name: string; value: number }>;
  color: string;
};

export function ApplicationChart({ data, color }: ApplicationChartProps) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Actual" fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}
