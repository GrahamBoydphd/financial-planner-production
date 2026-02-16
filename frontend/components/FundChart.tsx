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
  TooltipItem,
  LegendItem
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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

export interface FanData {
  p0?: number[];
  p5?: number[];
  p10?: number[];
  p25?: number[];
  p50?: number[];
  p75?: number[];
  p90?: number[];
  p95?: number[];
  p100?: number[];
  
  // Solvency Data
  p0_solvent_count?: number[];
  p10_solvent_count?: number[];
  p25_solvent_count?: number[];
  p50_solvent_count?: number[];
  p75_solvent_count?: number[];
  p90_solvent_count?: number[];
  p100_solvent_count?: number[];

  // Metadata for P50 tooltip
  p50_data?: { 
    solvent_companies: number; 
    total_companies: number;
    cumulative_external_capital?: number;
    total_exposure?: number;
  }[];
}

interface Props {
  mode: 'standard' | 'single' | 'monte_carlo';
  labels: string[];
  values?: number[]; // For standard/single mode
  investmentValues?: number[]; // For standard/single mode (and fallback for MC)
  poolValues?: number[]; // NEW: Net Pool Flow
  fanData?: FanData; // For monte_carlo mode
  targetProbability?: number[]; // Secondary axis (was survivalRate)
  targetMultiple?: number; // For label
  currencySymbol?: string;
  isLog?: boolean;
  yMin?: number; // Explicit Min Override
  yMax?: number; // Explicit Max Override
}

export default function FundChart({
  mode,
  labels,
  values,
  investmentValues,
  poolValues,
  fanData,
  targetProbability,
  targetMultiple,
  currencySymbol = '$',
  isLog = false,
  yMin,
  yMax,
}: Props) {
  
  // --- Calculate Axis Limits ---
  let yAxisMin = 0;
  let yAxisMax = 100;

  // Determine Min
  if (yMin !== undefined) {
      yAxisMin = yMin;
  } else {
      // Fallback calculation if no prop provided
      let dataMin = 0;
      if (mode === 'monte_carlo' && fanData?.p0) {
          const valid = fanData.p0.slice(1).filter(v => !isLog || v > 0);
          if (valid.length > 0) dataMin = Math.min(...valid);
      } else if (values) {
          const valid = values.slice(1).filter(v => !isLog || v > 0);
          if (valid.length > 0) dataMin = Math.min(...valid);
      }
      
      if (isLog && dataMin <= 0) dataMin = 100; // Default
      yAxisMin = getSmartMin(dataMin, isLog);
  }

  // Safety: If Log Scale and min is <= 0, force it to be positive
  if (isLog && yAxisMin <= 0) {
      yAxisMin = getSmartMin(yAxisMin, true);
  }

  // Determine Max
  if (yMax !== undefined) {
      yAxisMax = yMax;
  } else {
      let dataMax = 0;
      if (mode === 'monte_carlo' && fanData?.p100) {
        dataMax = Math.max(...fanData.p100.slice(1));
      } else if (values) {
        dataMax = Math.max(...values.slice(1));
      }
      
      if (isLog) {
          yAxisMax = getNiceLogMax(dataMax);
      } else {
          yAxisMax = dataMax > 0 ? dataMax * 1.2 : 100;
          // Snap logic
          if (yAxisMax > 0) {
              const magnitude = Math.pow(10, Math.floor(Math.log10(yAxisMax)));
              const niceStep = magnitude / 2;
              yAxisMax = Math.ceil(yAxisMax / niceStep) * niceStep;
          }
      }
  }

  // --- Helpers ---
  const clamp = (val: number | undefined | null): number | null => {
    if (val === undefined || val === null) return null;
    if (!isLog) return val;
    // In log mode, clamp values below min to min (so they appear at the bottom instead of disappearing)
    return val < yAxisMin ? yAxisMin : val;
  };

  const processArray = (arr: number[] | undefined) => {
    if (!arr) return [];
    return arr.map(clamp);
  };

  // Helper to retrieve raw values for tooltips
  const getRaw = (datasetLabel: string, index: number): number | null => {
    if (mode === 'monte_carlo' && fanData) {
      if (datasetLabel.includes('Max')) return fanData.p100?.[index] ?? null;
      if (datasetLabel.includes('Top 10%')) return fanData.p90?.[index] ?? null;
      if (datasetLabel.includes('Upper 15%')) return fanData.p75?.[index] ?? null;
      if (datasetLabel.includes('Typical 50%')) return fanData.p25?.[index] ?? null;
      if (datasetLabel.includes('Lower 15%')) return fanData.p10?.[index] ?? null;
      if (datasetLabel.includes('Bottom 10%')) return fanData.p0?.[index] ?? null;
      if (datasetLabel.includes('Median')) return fanData.p50?.[index] ?? null;
      
      if (datasetLabel === 'Cumulative Investment + Debt') {
            return fanData.p50_data?.[index]?.total_exposure 
                ?? fanData.p50_data?.[index]?.cumulative_external_capital 
                ?? investmentValues?.[index] 
                ?? 0;
      }
      return null;
    }
    if ((mode === 'standard' || mode === 'single') && values) {
      if (datasetLabel === 'Cumulative Investment + Debt') {
          return investmentValues?.[index] ?? null;
      }
      return values[index] ?? null;
    }
    if (datasetLabel === 'Total Pool Contribution' && poolValues) {
        return poolValues[index] ?? null;
    }
    return null;
  };

  const datasets: any[] = [];

  // --- 1. Standard / Single Mode ---
  if ((mode === 'standard' || mode === 'single') && values) {
    datasets.push({
      label: 'Total Fund Value',
      data: processArray(values),
      borderColor: 'rgb(37, 99, 235)', // Blue-600
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line',
      fill: false,
    });

    if (investmentValues && investmentValues.length > 0) {
        datasets.push({
            label: 'Cumulative Investment + Debt',
            data: processArray(investmentValues),
            borderColor: '#EF4444', // Red-500
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            pointStyle: 'line',
            fill: false,
        });
    }
  }

  // --- 2. Monte Carlo Mode (5-Zone Fan) ---
  if (mode === 'monte_carlo' && fanData) {
    
    // 1. Max (Top Edge)
    datasets.push({
      label: 'Max (Top Edge)',
      data: processArray(fanData.p100),
      solvencyData: fanData.p100_solvent_count,
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      order: 50,
    });

    // 2. Top 10% (P90-Max)
    datasets.push({
      label: 'Top 10% (P90-Max)',
      data: processArray(fanData.p90),
      solvencyData: fanData.p90_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1', 
      order: 51,
    });

    // 3. Upper 15% (P75-P90)
    datasets.push({
      label: 'Upper 15% (P75-P90)',
      data: processArray(fanData.p75),
      solvencyData: fanData.p75_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1',
      order: 52,
    });

    // 4. Typical 50% (P25-P75)
    datasets.push({
      label: 'Typical 50% (P25-P75)',
      data: processArray(fanData.p25),
      solvencyData: fanData.p25_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(147, 197, 253, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1',
      order: 53,
    });

    // 5. Lower 15% (P10-P25)
    datasets.push({
      label: 'Lower 15% (P10-P25)',
      data: processArray(fanData.p10),
      solvencyData: fanData.p10_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1',
      order: 54,
    });

    // 6. Bottom 10% (Min-P10)
    datasets.push({
      label: 'Bottom 10% (Min-P10)',
      data: processArray(fanData.p0),
      solvencyData: fanData.p0_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1',
      order: 55,
    });

    // 7. Median (P50)
    datasets.push({
      label: 'Median Value (P50)',
      data: processArray(fanData.p50),
      solvencyData: fanData.p50_solvent_count || fanData.p50_data?.map(d => d.solvent_companies),
      borderColor: 'rgb(37, 99, 235)', 
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      pointStyle: 'line',
      order: 40,
    });

    // 8. Cumulative Investment + Debt
    let mcInvestmentData: number[] = [];
    if (fanData.p50_data) {
        mcInvestmentData = fanData.p50_data.map(d => Number(d.total_exposure ?? d.cumulative_external_capital ?? 0));
    } else if (investmentValues) {
        mcInvestmentData = investmentValues;
    }

    if (mcInvestmentData.length > 0) {
      datasets.push({
        label: 'Cumulative Investment + Debt',
        data: processArray(mcInvestmentData),
        borderColor: '#EF4444', // Red-500
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        fill: false,
        pointStyle: 'line',
        order: 41, 
      });
    }

    // 9. Target Probability
    if (targetProbability && targetMultiple !== undefined) {
      datasets.push({
        label: `Likelihood of ${targetMultiple}X`,
        data: targetProbability.map(p => p * 100), 
        borderColor: 'rgb(75, 85, 99)', 
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.1,
        fill: false,
        yAxisID: 'y1',
        pointStyle: 'line',
        order: 1,
      });
    }
  }

  // --- 3. Net Pool Flow ---
  if (poolValues && poolValues.length > 0) {
      datasets.push({
          label: 'Total Pool Contribution',
          data: processArray(poolValues),
          borderColor: 'rgb(168, 85, 247)', 
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          fill: false,
          pointStyle: 'line',
          order: 30, 
      });
  }

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
          text: `Fund Value (${currencySymbol})`,
        },
        min: yAxisMin,
        max: yAxisMax, 
        ticks: {
          callback: (value: any) => {
            const label = currencySymbol + Number(value).toLocaleString(undefined, { maximumSignificantDigits: 3 });
            
            if (!isLog) return label;

            const val = Number(value);
            const log10 = Math.log10(val);
            const isPowerOf10 = Math.abs(log10 - Math.round(log10)) < 1e-6;
            const log5 = Math.log10(val / 5);
            const isPowerOf5 = Math.abs(log5 - Math.round(log5)) < 1e-6;

            const decades = Math.log10(yAxisMax) - Math.log10(yAxisMin);

            if (decades > 5) {
              return isPowerOf10 ? label : null;
            } else {
              return (isPowerOf10 || isPowerOf5) ? label : null;
            }
          },
        }
      },
      y1: {
        type: 'linear' as const,
        display: mode === 'monte_carlo' && !!targetProbability,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Likelihood of hitting the target multiplier',
        },
        min: 0,
        max: 100, 
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value: any) => {
            return value + '%';
          },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          usePointStyle: true,
          filter: function (item: LegendItem) {
            return !item.text.includes('Top Edge');
          },
        },
      },
      tooltip: {
        itemSort: function (a: TooltipItem<any>, b: TooltipItem<any>) {
          return b.parsed.y - a.parsed.y;
        },
        callbacks: {
          label: function (context: TooltipItem<any>) {
            let label = context.dataset.label || '';
            
            if (context.dataset.yAxisID === 'y1') {
              return `${label}: ${Number(context.parsed.y).toFixed(1)}%`;
            }

            if (label === 'Total Pool Contribution') {
                label = 'Pool Volume';
            }

            const rawVal = getRaw(context.dataset.label || '', context.dataIndex);
            const displayVal = rawVal !== null ? rawVal : context.parsed.y;
            const formattedVal = `${currencySymbol}${Number(displayVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            
            const dataset = context.dataset as any;
            if (dataset.solvencyData) {
              const numerator = dataset.solvencyData[context.dataIndex] ?? 0;
              const denominator = fanData?.p50_data?.[context.dataIndex]?.total_companies;
              
              if (denominator === undefined) {
                return `${label}: ${formattedVal}`;
              }

              return `${label}: ${formattedVal} | Solvent Companies: ${numerator}/${denominator}`;
            }

            return `${label}: ${formattedVal}`;
          },
        },
      },
    },
  };

  return <Line data={{ labels, datasets }} options={options} />;
}
