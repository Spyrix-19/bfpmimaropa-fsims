import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, tooltipStyle } from "./shared";

type SectorCompositionChartProps = {
  data: Array<Record<string, string | number>>;
  sectors: string[];
  colors: Record<string, string>;
};

export function SectorCompositionChart({ data, sectors, colors }: SectorCompositionChartProps) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {sectors.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="sec"
            fill={colors[s]}
            radius={i === sectors.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
