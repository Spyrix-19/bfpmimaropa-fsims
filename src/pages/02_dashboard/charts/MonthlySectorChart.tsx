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

type MonthlySectorChartProps = {
  data: Array<Record<string, string | number>>;
  sectors: string[];
  colors: Record<string, string>;
};

export function MonthlySectorChart({ data, sectors, colors }: MonthlySectorChartProps) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {sectors.map((s) => (
          <Line
            key={s}
            type="monotone"
            dataKey={s}
            stroke={colors[s]}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
