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
  singleRunData?: MonthlyData[];
  isLog?: boolean;
  mode: 'single' | 'monte_carlo' | 'standard';
  creditLimit?: number;
  currencySymbol?: string; 
}

export default function CashFlowChart({ data, singleRunData, isLog = false, mode, creditLimit = 0, currencySymbol = '$' }: Props) {
  const linearFloor = creditLimit > 0 ? -(creditLimit * 1.5) : 0;
  
  const labels = data.labels;
  const datasets: any[] = [];

  // --- 0. DETERMINE SOURCE DATA ---
  // FIX: Strict source selection, default to empty
  let sourceData: MonthlyData[] = [];
  
  if (mode === 'standard') {
      sourceData = data.deterministic_data || [];
  } else if (singleRunData) {
      sourceData = singleRunData;
  } else if (mode === 'monte_carlo' && data.p50_data) {
      sourceData = data.p50_data;
  } else if (mode === 'single' && data.single_run_data) {
      sourceData = data.single_run_data;
  }

  // --- 1. The "Red Line" (Cumulative Investment) ---
  // Always from deterministic_data if available
  if (data.deterministic_data && data.deterministic_data.length > 0) {
      const rawInvestmentData = data.deterministic_data.map(d => Number(d.cumulative_external_capital));
      const investmentData = rawInvestmentData.map(val => {
          return (isLog && val <= 100) ? 100 : val;
      });

      datasets.push({
        label: 'Cumulative Investment',
        data: investmentData,
        rawValues: rawInvestmentData,
        borderColor: 'rgb(220, 38, 38)', // Red-600
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        pointStyle: 'line', 
        fill: false,
        order: 1, 
      });
  }

  // --- 2. Deterministic / Single Run Mode ---
  // Only render if sourceData is present
  if (sourceData.length > 0 && (mode === 'standard' || mode === 'single')) {
    
    // A. Net Value (Blue Solid)
    const rawValueData = sourceData.map(d => Number(d.total_value));
    const valueData = rawValueData.map(val => {
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Net Value (Cash+Divs)',
      data: valueData,
      rawValues: rawValueData,
      borderColor: 'rgb(37, 99, 235)', // Blue-600
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 2,
    });

    // B. Cash on Hand (Teal Solid)
    const rawCashData = sourceData.map(d => Number(d.cash_balance));
    const cashData = rawCashData.map(val => {
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cash on Hand',
      data: cashData,
      rawValues: rawCashData,
      borderColor: 'rgb(20, 184, 166)', // Teal-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 3,
    });

    // C. Cumulative Dividends (Gold Solid)
    const rawDivData = sourceData.map(d => Number(d.cumulative_dividends));
    const divData = rawDivData.map(val => {
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cum. Dividends',
      data: divData,
      rawValues: rawDivData,
      borderColor: 'rgb(234, 179, 8)', // Yellow-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 4,
    });

    // D. Monthly Revenue (Green Dashed)
    const rawRevData = sourceData.map(d => Number(d.revenue));
    const revData = rawRevData.map(val => {
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Revenue',
      data: revData,
      rawValues: rawRevData,
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
    const rawCostData = sourceData.map(d => Number(d.cogs) + Number(d.opex) + Number(d.interest_expense));
    const costData = rawCostData.map(val => {
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Costs',
      data: costData,
      rawValues: rawCostData,
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
    const debtCoveredRaw = rawDebtData.map(debt => Math.min(debt, creditLimit));
    const debtCovered = debtCoveredRaw.map(v => (isLog && v <= 100) ? 100 : v);

    datasets.push({
      label: 'Covered Overdraft',
      data: debtCovered,
      rawValues: debtCoveredRaw,
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
    const debtFantasyRaw = rawDebtData; 
    const debtFantasy = debtFantasyRaw.map(v => (isLog && v <= 100) ? 100 : v);

    datasets.push({
      label: 'Fantasy Debt (Excess)',
      data: debtFantasy,
      rawValues: debtFantasyRaw,
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
  // Check for p50_data (preferred) or p50_value (legacy)
  if (mode === 'monte_carlo' && (data.p50_data || data.p50_value)) {
    
    // Extract P50 values for clamping calculations
    let p50Vals: number[] = [];
    if (data.p50_data) {
        // Map from pathwise data (Cash Balance for Cash-Only Logic)
        p50Vals = data.p50_data.map(d => Number(d.cash_balance));
    } else if (data.p50_value) {
        // Legacy fallback
        p50Vals = data.p50_value.map(v => Number(v));
    }

    // CALCULATE CLAMPING FLOORS
    // New Logic: Floor based on credit limit to prevent extreme negative scaling
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

    const getRaw = (vals: (number | string)[] | undefined) => {
        if (!vals) return [];
        return vals.map(v => Number(v));
    };

    // LAYER 1: P100 (Max)
    datasets.push({
      label: 'Max (Top Edge)',
      data: clamp(data.p100_value),
      rawValues: getRaw(data.p100_value),
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      order: 50,
    });
    // LAYER 2: P90
    datasets.push({
      label: 'Top 10% (P90-Max)',
      data: clamp(data.p90_value),
      rawValues: getRaw(data.p90_value),
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
      rawValues: getRaw(data.p75_value),
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
      rawValues: getRaw(data.p25_value),
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
      rawValues: getRaw(data.p10_value),
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
      rawValues: getRaw(data.p0_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 55,
    });
    // LAYER 7: Median
    datasets.push({
      label: 'Median Cash (P50)',
      data: clamp(p50Vals),
      rawValues: p50Vals,
      borderColor: 'rgb(37, 99, 235)', 
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      pointStyle: 'line', 
      order: 40, 
    });

    // NEW: Survival Rate (y1 axis)
    if (data.survival_rate) {
        datasets.push({
            label: 'Survival Rate',
            data: data.survival_rate,
            rawValues: data.survival_rate,
            borderColor: 'rgb(75, 85, 99)', // Gray-600
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            tension: 0.1,
            fill: false,
            yAxisID: 'y1',
            order: 10, // Top layer
        });
    }
  }

  // --- 4. Accumulated Pool (Shared Logic) ---
  // We check sourceData (which is now populated with median run in MC mode)
  if (sourceData.length > 0) {
      const rawPoolData = sourceData.map(d => Number(d.cumulative_pool_received || 0));
      const poolData = rawPoolData.map(val => {
          return (isLog && val <= 100) ? 100 : val;
      });
      
      // Only render if there is non-zero data
      const hasPool = poolData.some(v => v > (isLog ? 101 : 1));

      if (hasPool) {
          datasets.push({
              label: 'Accumulated Pool',
              data: poolData,
              rawValues: rawPoolData,
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
      x2: {
        position: 'top' as const,
        grid: {
          drawTicks: false,
          drawOnChartArea: false,
        },
        ticks: {
          display: false,
        },
      },
      y: {
        type: isLog ? 'logarithmic' as const : 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { 
          display: true, 
          text: `Cash Balance (${currencySymbol})${isLog ? ' - Log Scale' : ''}` 
        },
        min: isLog ? 100 : linearFloor,
        max: yAxisMax,
        ticks: {
          callback: (value: any) => {
            return currencySymbol + Number(value).toLocaleString(undefined, { maximumSignificantDigits: 3 });
          }
        },
        afterBuildTicks: (axis: any) => {
          if (!isLog) return;
          
          const min = axis.min;
          const max = axis.max;
          if (min <= 0 || max <= 0) return;

          const logMin = Math.log10(min);
          const logMax = Math.log10(max);
          const range = logMax - logMin;

          axis.ticks = axis.ticks.filter((t: any) => {
            const val = t.value;
            if (val <= 0) return false;

            const log10 = Math.log10(val);
            const power = Math.floor(log10);
            const base = Math.pow(10, power);
            const significand = Math.round(val / base);

            if (range > 5) {
              return significand === 1;
            } else {
              return significand === 1 || significand === 5;
            }
          });
        }
      },
      y1: {
        type: 'linear' as const,
        display: mode === 'monte_carlo',
        position: 'right' as const,
        title: { 
          display: true, 
          text: "Probability of survival" 
        },
        min: 0,
        max: 1,
        grid: {
          drawOnChartArea: false, // keep main grid only
        },
        ticks: {
          callback: (value: any) => {
            return (Number(value) * 100).toFixed(0) + '%';
          }
        }
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
            const labelStr = context.dataset.label || '';
            if (labelStr.includes('Top Edge')) return null;
            
            let value = context.parsed.y;
            if (context.dataset.rawValues && context.dataset.rawValues[context.dataIndex] !== undefined) {
                value = context.dataset.rawValues[context.dataIndex];
            }

            const fmt = (v: number) => currencySymbol + Number(v).toLocaleString(undefined, { maximumSignificantDigits: 3 });

            // --- NEW: Strict Debt Handlers ---
            if (labelStr === 'Fantasy Debt (Excess)') {
                const excess = Math.max(0, value - creditLimit);
                return 'Fantasy (Insolvent): ' + fmt(excess);
            }
            if (labelStr === 'Covered Overdraft') {
                return 'Covered (Credit): ' + fmt(value);
            }
            // ---------------------------------

            // Handle Survival Rate %
            if (context.dataset.yAxisID === 'y1') {
                return labelStr + ': ' + (Number(value) * 100).toFixed(1) + '%';
            }

            // --- NEW: Negative Cash Logic ---
            if (labelStr === 'Cash on Hand' && value < 0) {
                const deficit = Math.abs(value);
                const coveredDebt = Math.min(deficit, creditLimit);
                const fantasyDebt = Math.max(0, deficit - creditLimit);

                const lines = [];
                // Line 1: Original Total
                lines.push(`${labelStr}: ${fmt(value)}`);
                // Line 2: Covered
                lines.push(`Covered (Credit): ${fmt(coveredDebt)}`);
                // Line 3: Fantasy (if any)
                if (fantasyDebt > 0) {
                    lines.push(`Fantasy (Insolvent): ${fmt(fantasyDebt)}`);
                }
                return lines;
            }
            // --------------------------------

            let finalLabel = labelStr;
            if (finalLabel) finalLabel += ': ';
            if (value !== null && value !== undefined) {
              finalLabel += fmt(value);
            }
            return finalLabel;
          }
        }
      }
    },
  };

  return <Line options={options} data={chartData} />;
}
