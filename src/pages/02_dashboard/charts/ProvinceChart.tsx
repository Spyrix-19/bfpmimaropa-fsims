import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, tooltipStyle } from "./shared";

type ProvinceChartProps = {
  data: Array<{ name: string; target: number; actual: number }>;
  colors: { warning: string; primary: string };
};

export function ProvinceChart({ data, colors }: ProvinceChartProps) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="target" fill={colors.warning} radius={[4, 4, 0, 0]} name="Target" />
        <Bar dataKey="actual" fill={colors.primary} radius={[4, 4, 0, 0]} name="Actual" />
      </BarChart>
    </ResponsiveContainer>
  );
}
