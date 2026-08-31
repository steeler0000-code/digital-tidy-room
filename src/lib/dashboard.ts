import dashboardData from '@/data/dashboard.json';

export type DashboardDirection = 'positive' | 'negative' | 'neutral';
export type DashboardStatus = 'favorable' | 'mixed' | 'caution';
export type DashboardMetric = (typeof dashboardData.metrics)[number];

export const dashboard = dashboardData;

export function sparklinePoints(values: number[], width = 112, height = 34) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(`${value}T00:00:00+09:00`));
}
