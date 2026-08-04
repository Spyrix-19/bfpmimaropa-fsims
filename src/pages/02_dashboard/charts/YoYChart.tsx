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

type YoYChartProps = {
  data: Array<Record<string, string | number>>;
  prevYear: string | number;
  currentYear: string | number;
  colors: { warning: string; primary: string };
};

export function YoYChart({ data, prevYear, currentYear, colors }: YoYChartProps) {
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
          dataKey={String(prevYear)}
          stroke={colors.warning}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey={String(currentYear)}
          stroke={colors.primary}
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
