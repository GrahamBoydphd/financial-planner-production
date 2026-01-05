'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SimulationResult, MonthlyData } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- Helper: Generate Diagonal Hatch Pattern ---
function createDiagonalPattern(color: string) {
  if (typeof document === 'undefined') return color;

  const shape = document.createElement('canvas');
  shape.width = 10;
  shape.height = 10;
  const c = shape.getContext('2d');
  if (!c) return color;

  c.strokeStyle = color;
  c.lineWidth = 2; 
  c.beginPath();
  c.moveTo(0, 10);
  c.lineTo(10, 0);
  c.stroke();
  
  return c.createPattern(shape, 'repeat') || color;
}

interface Props {
  data: SimulationResult;
  isLog?: boolean;
  mode: 'single' | 'monte_carlo' | 'standard';
  creditLimit?: number;
  currencySymbol?: string; 
}

export default function CashFlowChart({ data, isLog = false, mode, creditLimit = 0, currencySymbol = '$' }: Props) {
  const labels = data.labels;
  const datasets = [];

  // --- 0. DETERMINE SOURCE DATA ---
  // We use single_run_data if available (even in MC mode, it now holds the median run)
  let sourceData: MonthlyData[] = data.deterministic_data;
  if ((mode === 'single' || mode === 'monte_carlo') && data.single_run_data) {
    sourceData = data.single_run_data;
  }

  // --- 1. The "Red Line" (Cumulative Investment) ---
  // Clamp negative values in Log mode to avoid breaks
  const investmentData = data.deterministic_data.map(d => {
      const val = Number(d.cumulative_external_capital);
      return (isLog && val <= 100) ? 100 : val;
  });

  datasets.push({
    label: 'Cumulative Investment',
    data: investmentData,
    borderColor: 'rgb(220, 38, 38)', // Red-600
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
    pointStyle: 'line', 
    fill: false,
    order: 1, 
  });

  // --- 2. Deterministic / Single Run Mode ---
  if (mode === 'standard' || mode === 'single') {
    
    // A. Net Value (Blue Solid)
    const valueData = sourceData.map(d => {
        const val = Number(d.total_value);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Net Value (Cash+Divs)',
      data: valueData,
      borderColor: 'rgb(37, 99, 235)', // Blue-600
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 2,
    });

    // B. Cash on Hand (Teal Solid)
    const cashData = sourceData.map(d => {
        const val = Number(d.cash_balance);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cash on Hand',
      data: cashData,
      borderColor: 'rgb(20, 184, 166)', // Teal-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 3,
    });

    // C. Cumulative Dividends (Gold Solid)
    const divData = sourceData.map(d => {
        const val = Number(d.cumulative_dividends);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cum. Dividends',
      data: divData,
      borderColor: 'rgb(234, 179, 8)', // Yellow-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 4,
    });

    // D. Monthly Revenue (Green Dashed)
    const revData = sourceData.map(d => {
        const val = Number(d.revenue);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Revenue',
      data: revData,
      borderColor: 'rgb(34, 197, 94)', // Green-500
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 5,
    });

    // E. Monthly Costs (Red Dashed)
    const costData = sourceData.map(d => {
        const val = Number(d.cogs) + Number(d.opex) + Number(d.interest_expense);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Costs',
      data: costData,
      borderColor: 'rgb(239, 68, 68)', // Red-500
      borderDash: [2, 2],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 6,
    });

    // F. DEBT VISUALIZATION (Stacked Area Logic)
    const rawDebtData = sourceData.map(d => {
        const cash = Number(d.cash_balance);
        return cash < 0 ? Math.abs(cash) : 0;
    });

    // 1. Covered Overdraft (Solid Purple)
    const debtCovered = rawDebtData.map(debt => Math.min(debt, creditLimit));

    datasets.push({
      label: 'Covered Overdraft',
      data: debtCovered.map(v => (isLog && v <= 100) ? 100 : v),
      borderColor: 'transparent',
      backgroundColor: 'rgba(147, 51, 234, 0.3)', // Solid Purple
      borderWidth: 0,
      pointRadius: 0,
      tension: 0,
      pointStyle: 'rect', 
      fill: 'origin', 
      order: 30, 
    });

    // 2. Fantasy Debt (Hatched Purple)
    const debtFantasy = rawDebtData.map(debt => debt); 

    datasets.push({
      label: 'Fantasy Debt (Excess)',
      data: debtFantasy.map(v => (isLog && v <= 100) ? 100 : v),
      borderColor: 'transparent', 
      backgroundColor: createDiagonalPattern('rgba(147, 51, 234, 0.6)'), 
      borderWidth: 0,
      pointRadius: 0,
      tension: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 31, 
    });
  }

  // --- 3. Monte Carlo Mode ---
  if (mode === 'monte_carlo' && data.p50_value) {
    
    // CALCULATE CLAMPING FLOORS
    // Linear Floor: 2x lower than P50 min
    const p50Vals = data.p50_value.map(v => Number(v));
    const minP50 = Math.min(...p50Vals);
    // If minP50 is positive, floor is 0? If negative, floor is 2 * minP50?
    const linearFloor = minP50 >= 0 ? 0 : minP50 * 2.0;
    const logFloor = 100;

    const clamp = (vals: (number | string)[] | undefined) => {
        if (!vals) return [];
        return vals.map(v => {
            const num = Number(v);
            if (isLog) {
                return num < logFloor ? logFloor : num;
            } else {
                return num < linearFloor ? linearFloor : num;
            }
        });
    };

    // LAYER 1: P100 (Max)
    datasets.push({
      label: 'Max (Top Edge)',
      data: clamp(data.p100_value),
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      order: 50,
    });
    // LAYER 2: P90
    datasets.push({
      label: 'Top 10% (P90-Max)',
      data: clamp(data.p90_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 51,
    });
    // LAYER 3: P75
    datasets.push({
      label: 'Upper 15% (P75-P90)',
      data: clamp(data.p75_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 52,
    });
    // LAYER 4: P25
    datasets.push({
      label: 'Typical 50% (P25-P75)',
      data: clamp(data.p25_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(147, 197, 253, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 53,
    });
    // LAYER 5: P10
    datasets.push({
      label: 'Lower 15% (P10-P25)',
      data: clamp(data.p10_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 54,
    });
    // LAYER 6: P0
    datasets.push({
      label: 'Bottom 10% (Min-P10)',
      data: clamp(data.p0_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 55,
    });
    // LAYER 7: Median
    datasets.push({
      label: 'Median (P50)',
      data: clamp(data.p50_value),
      borderColor: 'rgb(37, 99, 235)', 
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      pointStyle: 'line', 
      order: 40, 
    });
  }

  // --- 4. Accumulated Pool (Shared Logic) ---
  // We check sourceData (which is now populated with median run in MC mode)
  const poolData = sourceData.map(d => {
      const val = Number(d.cumulative_pool_received || 0);
      return (isLog && val <= 100) ? 100 : val;
  });
  
  // Only render if there is non-zero data (or if we are in MC mode and expect it, but checking data is safer)
  const hasPool = poolData.some(v => v > (isLog ? 101 : 1));

  if (hasPool) {
      datasets.push({
          label: 'Accumulated Pool',
          data: poolData,
          borderColor: 'rgb(245, 158, 11)', // Amber-500
          borderDash: [5, 5], // Dotted
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          pointStyle: 'line',
          fill: false,
          order: 7, // Layer above revenue/costs but below main lines
      });
  }

  // --- SCALING LOGIC: "Snap-to-Grid" Cap ---
  let yAxisMax: number | undefined = undefined;
  if (mode === 'monte_carlo' && data.p90_value) {
    const maxP90 = Math.max(...data.p90_value.map(v => Number(v)));
    
    if (maxP90 > 0) {
      // INCREASE PADDING (Original was 2.0, adding 50% more -> 3.0)
      const rawTarget = maxP90 * 3.0;
      
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawTarget)));
      const niceStep = magnitude / 2; 
      yAxisMax = Math.round(rawTarget / niceStep) * niceStep;
    }
  }

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      y: {
        type: isLog ? 'logarithmic' as const : 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { 
          display: true, 
          text: `Value (${currencySymbol})${isLog ? ' - Log Scale' : ''}` 
        },
        min: isLog ? 100 : undefined,
        max: yAxisMax, 
      },
    },
    plugins: {
      legend: { 
        display: true,
        labels: {
          usePointStyle: true,
          filter: function(item: any) {
            return !item.text.includes('Top Edge') && !item.text.includes('Fantasy Debt');
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label.includes('Top Edge')) return null;
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += currencySymbol + Number(context.parsed.y).toLocaleString(undefined, { maximumSignificantDigits: 3 });
            }
            return label;
          }
        }
      }
    },
  };

  return <Line options={options} data={chartData} />;
}
