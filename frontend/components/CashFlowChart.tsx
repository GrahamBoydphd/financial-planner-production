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

// --- Helper: Smart Min Calculation ---
function getSmartMin(minVal: number, isLog: boolean) {
  if (isLog) {
    if (minVal <= 0) return 1; // Log scale fallback
    return Math.pow(10, Math.floor(Math.log10(minVal)));
  }
  return minVal < 0 ? minVal * 1.1 : minVal * 0.9;
}

// --- Helper: Nice Log Max Calculation ---
function getNiceLogMax(maxVal: number) {
  if (maxVal <= 0) return 10;
  const exponent = Math.floor(Math.log10(maxVal));
  const fraction = maxVal / Math.pow(10, exponent);
  
  if (fraction <= 1) return 1 * Math.pow(10, exponent);
  if (fraction <= 5) return 5 * Math.pow(10, exponent);
  return 10 * Math.pow(10, exponent);
}

interface Props {
  data: SimulationResult;
  singleRunData?: MonthlyData[];
  isLog?: boolean;
  mode: 'single' | 'monte_carlo' | 'standard';
  creditLimit?: number;
  currencySymbol?: string; 
  yMin?: number;
  yMax?: number;
}

export default function CashFlowChart({ 
  data, 
  singleRunData, 
  isLog = false, 
  mode, 
  creditLimit = 0, 
  currencySymbol = '$',
  yMin,
  yMax
}: Props) {
  const linearFloor = creditLimit > 0 ? -(creditLimit * 1.5) : 0;
  
  // --- 0. CALCULATE INTERNAL MIN/MAX (Fallback) ---
  let internalMin = 0;
  let internalMax = 0;
  const allValues: number[] = [];

  const addVal = (v: any) => {
    const n = Number(v);
    if (!isNaN(n)) allValues.push(n);
  };

  // Helper to extract net pool
  const getNetPool = (d: any) => Number(d.pool_received || 0) - Number(d.pool_contribution || 0);

  // Scan Deterministic Data
  if (data.deterministic_data) {
    data.deterministic_data.slice(1).forEach(d => {
      addVal(d.total_value);
      addVal(d.cash_balance);
      addVal(d.total_exposure);
      addVal(d.cumulative_external_capital);
      addVal(getNetPool(d));
    });
  }

  // Scan Single Run Data
  const singleSource = singleRunData || data.single_run_data;
  if (singleSource) {
    singleSource.slice(1).forEach(d => {
      addVal(d.total_value);
      addVal(d.cash_balance);
      addVal(getNetPool(d));
    });
  }

  // Scan Monte Carlo Data
  if (data.p100_value) data.p100_value.slice(1).forEach(addVal);
  if (data.p0_value) data.p0_value.slice(1).forEach(addVal);
  if (data.p90_value) data.p90_value.slice(1).forEach(addVal);
  if (data.p10_value) data.p10_value.slice(1).forEach(addVal);
  if (data.p50_data) data.p50_data.slice(1).forEach(d => addVal(getNetPool(d)));

  if (allValues.length > 0) {
    internalMin = Math.min(...allValues);
    internalMax = Math.max(...allValues);
  }

  // --- DETERMINE FINAL AXIS BOUNDS ---
  let axisMin = 0;
  let axisMax = 100;

  // Min Logic
  if (yMin !== undefined) {
    axisMin = yMin;
  } else {
    // Internal Calculation
    if (!isLog) {
      // Linear: Respect credit limit floor but expand if data is lower
      let baseMin = internalMin;
      if (baseMin > linearFloor) baseMin = linearFloor;
      axisMin = getSmartMin(baseMin, false);
    } else {
      // Log: Find lowest positive value
      let relevantLow = Infinity;
      const positives = allValues.filter(v => v > 0);
      if (positives.length > 0) {
        relevantLow = Math.min(...positives);
      } else {
        relevantLow = 100; // Default
      }
      axisMin = getSmartMin(relevantLow, true);
    }
  }

  // Max Logic
  if (yMax !== undefined) {
    axisMax = yMax;
  } else {
    if (isLog) {
      axisMax = getNiceLogMax(internalMax);
    } else {
      axisMax = internalMax > 0 ? internalMax * 1.2 : 100;
      if (axisMax > 0) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(axisMax)));
        const niceStep = magnitude / 2; 
        axisMax = Math.ceil(axisMax / niceStep) * niceStep;
      }
    }
  }

  // --- END SCALE CALCULATION ---

  const labels = data.labels;
  const datasets: any[] = [];

  // --- 1. DETERMINE SOURCE DATA FOR RENDERING ---
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

  // --- 2. The "Red Line" (Cumulative Investment + Debt) ---
  if (sourceData.length > 0) {
      const rawInvestmentData = sourceData.map(d => Number(d.total_exposure || d.cumulative_external_capital || 0));
      const investmentData = rawInvestmentData.map(val => {
          return (isLog && val <= axisMin) ? axisMin : val;
      });

      datasets.push({
        label: 'Cumulative Investment + Debt',
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

  // --- 3. Deterministic / Single Run Mode ---
  if (sourceData.length > 0 && (mode === 'standard' || mode === 'single')) {
    
    // A. Net Value (Blue Solid)
    const rawValueData = sourceData.map(d => Number(d.total_value));
    const valueData = rawValueData.map(val => {
        return (isLog && val <= axisMin) ? axisMin : val;
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
        return (isLog && val <= axisMin) ? axisMin : val;
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
        return (isLog && val <= axisMin) ? axisMin : val;
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
        return (isLog && val <= axisMin) ? axisMin : val;
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
        return (isLog && val <= axisMin) ? axisMin : val;
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

    // F. DEBT VISUALIZATION
    const rawDebtData = sourceData.map(d => {
        const cash = Number(d.cash_balance);
        return cash < 0 ? Math.abs(cash) : 0;
    });

    // 1. Covered Overdraft
    const debtCoveredRaw = rawDebtData.map(debt => Math.min(debt, creditLimit));
    const debtCovered = debtCoveredRaw.map(v => (isLog && v <= axisMin) ? axisMin : v);

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

    // 2. Fantasy Debt
    const debtFantasyRaw = rawDebtData; 
    const debtFantasy = debtFantasyRaw.map(v => (isLog && v <= axisMin) ? axisMin : v);

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

  // --- 4. Monte Carlo Mode ---
  if (mode === 'monte_carlo' && (data.p50_data || data.p50_value)) {
    
    let p50Vals: number[] = [];
    if (data.p50_value) {
        p50Vals = data.p50_value.map(v => Number(v));
    } else if (data.p50_data) {
        p50Vals = data.p50_data.map(d => Number(d.cash_balance));
    }

    // CALCULATE CLAMPING FLOORS
    const clamp = (vals: (number | string)[] | undefined) => {
        if (!vals) return [];
        return vals.map(v => {
            const num = Number(v);
            if (isLog) {
                return num < axisMin ? axisMin : num;
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
      label: 'Max (Top Edge). P100 is',
      data: clamp(data.p100_value),
      rawValues: getRaw(data.p100_value),
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      order: 50,
    });
    // LAYER 2: P90
    datasets.push({
      label: 'Top 10% (P90-Max). P90 is',
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
      label: 'Upper 15% (P75-P90). P75 is',
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
      label: 'Typical 50% (P25-P75). P25 is',
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
      label: 'Lower 15% (P10-P25). P10 is',
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
      label: 'Bottom 10% (Min-P10). P0 is',
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

  // --- 5. Net Pool Flow (Monthly) ---
  if (sourceData.length > 0) {
      const rawPoolData = sourceData.map(d => {
          const received = Number((d as any).pool_received || 0);
          const contribution = Number((d as any).pool_contribution || 0);
          return received - contribution;
      });

      const poolData = rawPoolData.map(val => {
          return (isLog && val <= axisMin) ? axisMin : val;
      });
      
      const hasPool = rawPoolData.some(v => Math.abs(v) > 1);

      if (hasPool) {
          datasets.push({
              label: 'Net Pool Flow (Monthly)',
              data: poolData,
              rawValues: rawPoolData,
              borderColor: 'rgb(168, 85, 247)', // Purple-500
              backgroundColor: 'rgba(168, 85, 247, 0.2)', 
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.1,
              pointStyle: 'line',
              fill: false,
              order: 7, 
          });
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
        min: axisMin,
        max: axisMax,
        ticks: {
          callback: (value: any) => {
            const label = currencySymbol + Number(value).toLocaleString(undefined, { maximumSignificantDigits: 3 });
            
            if (!isLog) return label;

            const val = Number(value);
            const log10 = Math.log10(val);
            const isPowerOf10 = Math.abs(log10 - Math.round(log10)) < 1e-6;
            const log5 = Math.log10(val / 5);
            const isPowerOf5 = Math.abs(log5 - Math.round(log5)) < 1e-6;

            const decades = Math.log10(axisMax) - Math.log10(axisMin);

            if (decades > 5) {
              return isPowerOf10 ? label : null;
            } else {
              return (isPowerOf10 || isPowerOf5) ? label : null;
            }
          }
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
          drawOnChartArea: false, 
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
            
            let value = context.parsed.y;
            if (context.dataset.rawValues && context.dataset.rawValues[context.dataIndex] !== undefined) {
                value = context.dataset.rawValues[context.dataIndex];
            }

            const fmt = (v: number) => currencySymbol + Number(v).toLocaleString(undefined, { maximumSignificantDigits: 3 });

            if (labelStr === 'Fantasy Debt (Excess)') {
                const excess = Math.max(0, value - creditLimit);
                return 'Fantasy (Insolvent): ' + fmt(excess);
            }
            if (labelStr === 'Covered Overdraft') {
                return 'Covered (Credit): ' + fmt(value);
            }
            if (labelStr === 'Monthly Costs') {
                const item = sourceData[context.dataIndex];
                if (item) {
                    return [
                        'Total Costs: ' + fmt(value),
                        '  OpEx: ' + fmt(Number(item.opex || 0)),
                        '  COGS: ' + fmt(Number(item.cogs || 0)),
                        '  Interest: ' + fmt(Number(item.interest_expense || 0))
                    ];
                }
            }
            if (labelStr === 'Net Pool Flow (Monthly)') {
                return 'Net Pool: ' + (value >= 0 ? '+' : '') + fmt(value);
            }
            if (context.dataset.yAxisID === 'y1') {
                return labelStr + ': ' + (Number(value) * 100).toFixed(1) + '%';
            }
            if (labelStr === 'Cash on Hand' && value < 0) {
                const deficit = Math.abs(value);
                const coveredDebt = Math.min(deficit, creditLimit);
                const fantasyDebt = Math.max(0, deficit - creditLimit);

                const lines = [];
                lines.push(`${labelStr}: ${fmt(value)}`);
                lines.push(`Covered (Credit): ${fmt(coveredDebt)}`);
                if (fantasyDebt > 0) {
                    lines.push(`Fantasy (Insolvent): ${fmt(fantasyDebt)}`);
                }
                return lines;
            }

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
