// --- Chart helpers ---

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const shortModel = (m: string): string => m.split('/')[1] ?? m;

const avg = (nums: number[]): number => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const barChart = (params: {
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  maxValue?: number;
  valueFormat?: (v: number) => string;
  width?: number;
}): string => {
  const { title, labels, series, valueFormat = (v) => v.toFixed(2) } = params;
  const maxVal = params.maxValue ?? Math.max(...series.flatMap((s) => s.values), 0.01);
  const chartWidth = params.width ?? 600;
  const barGroupWidth = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.min(barGroupWidth / (series.length + 1), 40);
  const chartHeight = 250;
  const margin = { top: 40, right: 20, bottom: 90, left: 50 };
  const width = chartWidth + margin.left + margin.right;
  const height = chartHeight + margin.top + margin.bottom;

  const bars = labels
    .flatMap((_, li) =>
      series.map((s, si) => {
        const val = s.values[li] ?? 0;
        const clampedVal = Math.max(val, 0);
        const barH = (clampedVal / maxVal) * chartHeight;
        const x = margin.left + li * barGroupWidth + si * barWidth + (barGroupWidth - series.length * barWidth) / 2;
        const y = margin.top + chartHeight - barH;
        const color = COLORS[si % COLORS.length] as string;
        return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barH}" fill="${color}" rx="2">
        <title>${s.name}: ${valueFormat(val)}</title>
      </rect>
      <text x="${x + barWidth / 2 - 1}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#666">${valueFormat(val)}</text>`;
      }),
    )
    .join('\n');

  const xLabels = labels
    .map((l, i) => {
      const x = margin.left + i * barGroupWidth + barGroupWidth / 2;
      const display = l.length > 18 ? l.slice(0, 16) + '..' : l;
      return `<text x="${x}" y="${margin.top + chartHeight + 16}" text-anchor="middle" font-size="10" fill="#333" transform="rotate(-20 ${x} ${margin.top + chartHeight + 16})">${display}</text>`;
    })
    .join('\n');

  const legend = series
    .map((s, i) => {
      const x = margin.left + i * 120;
      const color = COLORS[i % COLORS.length] as string;
      return `<rect x="${x}" y="${height - 18}" width="10" height="10" fill="${color}" rx="2"/>
        <text x="${x + 14}" y="${height - 9}" font-size="10" fill="#333">${s.name}</text>`;
    })
    .join('\n');

  const gridSteps = maxVal <= 1 ? [0.25, 0.5, 0.75, 1.0] : Array.from({ length: 4 }, (_, i) => ((i + 1) / 4) * maxVal);
  const gridLines = gridSteps
    .filter((v) => v <= maxVal * 1.05)
    .map((v) => {
      const y = margin.top + chartHeight - (v / maxVal) * chartHeight;
      return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4"/>
        <text x="${margin.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#999">${valueFormat(v)}</text>`;
    })
    .join('\n');

  return `<div class="chart">
    <h3>${title}</h3>
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#d1d5db"/>
      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#d1d5db"/>
      ${bars}
      ${xLabels}
      ${legend}
    </svg>
  </div>`;
};

// --- Exports ---

export { barChart, shortModel, avg };
