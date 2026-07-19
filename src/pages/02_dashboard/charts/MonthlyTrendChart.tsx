import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, tooltipStyle } from "./shared";

type MonthlyTrendChartProps = {
  data: Array<{ name: string; target: number; actual: number }>;
  colors: { warning: string; primary: string };
};

export function MonthlyTrendChart({ data, colors }: MonthlyTrendChartProps) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="target"
          stroke={colors.warning}
          strokeWidth={2}
          dot={{ r: 2 }}
          name="Target"
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke={colors.primary}
          strokeWidth={3}
          dot={{ r: 3 }}
          name="Actual"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
