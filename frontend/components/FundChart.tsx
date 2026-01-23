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
  p50_data?: { solvent_companies: number; total_companies: number }[];
}

interface Props {
  mode: 'standard' | 'single' | 'monte_carlo';
  labels: string[];
  values?: number[]; // For standard/single mode
  fanData?: FanData; // For monte_carlo mode
  targetProbability?: number[]; // Secondary axis (was survivalRate)
  targetMultiple?: number; // For label
  currencySymbol?: string;
  isLog?: boolean;
}

export default function FundChart({
  mode,
  labels,
  values,
  fanData,
  targetProbability,
  targetMultiple,
  currencySymbol = '$',
  isLog = false,
}: Props) {
  const LOG_FLOOR = 100;

  // --- Helpers ---
  const clamp = (val: number | undefined | null): number | null => {
    if (val === undefined || val === null) return null;
    if (!isLog) return val;
    return val < LOG_FLOOR ? LOG_FLOOR : val;
  };

  const processArray = (arr: number[] | undefined) => {
    if (!arr) return [];
    return arr.map(clamp);
  };

  // Helper to retrieve raw values for tooltips
  const getRaw = (datasetLabel: string, index: number): number | null => {
    if (mode === 'monte_carlo' && fanData) {
      switch (datasetLabel) {
        case 'P100': return fanData.p100?.[index] ?? null;
        case 'P90': return fanData.p90?.[index] ?? null;
        case 'P75': return fanData.p75?.[index] ?? null;
        case 'P25': return fanData.p25?.[index] ?? null;
        case 'P10': return fanData.p10?.[index] ?? null;
        case 'P0': return fanData.p0?.[index] ?? null;
        case 'P50': return fanData.p50?.[index] ?? null;
        default: return null;
      }
    }
    if ((mode === 'standard' || mode === 'single') && values) {
      return values[index] ?? null;
    }
    return null;
  };

  // --- Calculate Nice Upper Bound ---
  let dataMax = 0;
  if (mode === 'monte_carlo' && fanData?.p100) {
    dataMax = Math.max(...fanData.p100);
  } else if (values) {
    dataMax = Math.max(...values);
  }

  const getNiceUpperBound = (val: number) => {
    if (val <= 0) return 100;
    const log10 = Math.log10(val);
    const power = Math.floor(log10);
    const base = Math.pow(10, power);
    
    // Steps: 1x, 5x, 10x
    if (val <= base) return base;
    if (val <= base * 5) return base * 5;
    return base * 10;
  };

  let yMax = getNiceUpperBound(dataMax);
  // Ensure max is above floor if log
  if (isLog && yMax <= LOG_FLOOR) {
    yMax = LOG_FLOOR * 10;
  }

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
      fill: true,
    });
  }

  // --- 2. Monte Carlo Mode (5-Zone Fan) ---
  if (mode === 'monte_carlo' && fanData) {
    // Colors
    const colorP90_P0 = 'rgba(30, 58, 138, 0.6)';   // Blue-900ish
    const colorP75_P10 = 'rgba(37, 99, 235, 0.4)';  // Blue-600ish
    const colorP25 = 'rgba(147, 197, 253, 0.4)';    // Blue-300ish

    // 1. P100 (Top Edge) - Solid Line
    datasets.push({
      label: 'P100',
      data: processArray(fanData.p100),
      solvencyData: fanData.p100_solvent_count,
      borderColor: 'rgba(30, 58, 138, 0.5)', // Visible solid line
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      order: 10,
    });

    // 2. P90 (Fills to P100) - Zone 5
    datasets.push({
      label: 'P90',
      data: processArray(fanData.p90),
      solvencyData: fanData.p90_solvent_count,
      borderColor: 'transparent',
      backgroundColor: colorP90_P0,
      pointRadius: 0,
      fill: '-1', // Fills to previous dataset (P100)
      order: 11,
    });

    // 3. P75 (Fills to P90) - Zone 4
    datasets.push({
      label: 'P75',
      data: processArray(fanData.p75),
      solvencyData: fanData.p75_solvent_count,
      borderColor: 'transparent',
      backgroundColor: colorP75_P10,
      pointRadius: 0,
      fill: '-1',
      order: 12,
    });

    // 4. P25 (Fills to P75) - Zone 3 (Center)
    datasets.push({
      label: 'P25',
      data: processArray(fanData.p25),
      solvencyData: fanData.p25_solvent_count,
      borderColor: 'transparent',
      backgroundColor: colorP25,
      pointRadius: 0,
      fill: '-1',
      order: 13,
    });

    // 5. P10 (Fills to P25) - Zone 2
    datasets.push({
      label: 'P10',
      data: processArray(fanData.p10),
      solvencyData: fanData.p10_solvent_count,
      borderColor: 'transparent',
      backgroundColor: colorP75_P10,
      pointRadius: 0,
      fill: '-1',
      order: 14,
    });

    // 6. P0 (Fills to P10) - Zone 1
    datasets.push({
      label: 'P0',
      data: processArray(fanData.p0),
      solvencyData: fanData.p0_solvent_count,
      borderColor: 'transparent',
      backgroundColor: colorP90_P0,
      pointRadius: 0,
      fill: '-1',
      order: 15,
    });

    // 7. P50 (Median) - Solid Line
    datasets.push({
      label: 'P50',
      data: processArray(fanData.p50),
      solvencyData: fanData.p50_solvent_count || fanData.p50_data?.map(d => d.solvent_companies),
      borderColor: 'rgb(30, 58, 138)', // Dark Blue
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      order: 5,
    });

    // 8. Target Probability (Secondary Axis)
    if (targetProbability && targetMultiple !== undefined) {
      datasets.push({
        label: `Likelihood of ${targetMultiple}X`,
        data: targetProbability.map(p => p * 100), // Map to 0-100 scale
        borderColor: 'rgb(75, 85, 99)', // Gray-600 (Dashed)
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.1,
        fill: false,
        yAxisID: 'y1',
        order: 1,
      });
    }
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
        min: isLog ? LOG_FLOOR : undefined,
        max: yMax, // Force nice upper bound
        ticks: {
          callback: (value: any) => {
            return currencySymbol + Number(value).toLocaleString(undefined, { maximumSignificantDigits: 3 });
          },
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
              // Only powers of 10 (significand 1)
              return significand === 1;
            } else {
              // Powers of 10 (1) or half-steps (5)
              return significand === 1 || significand === 5;
            }
          });
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
        max: 100, // Force 0-100
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
          filter: function (item: LegendItem) {
            // Hide helper datasets for the fan bands, keep P100 and Median
            const hidden = ['P90', 'P75', 'P25', 'P10', 'P0'];
            return !hidden.includes(item.text);
          },
        },
      },
      tooltip: {
        itemSort: function (a: TooltipItem<any>, b: TooltipItem<any>) {
          const getScore = (label: string) => {
            // If label starts with 'P' and followed by digits (regex /^P\d+$/), return parseInt(digits).
            // Else (e.g., 'Likelihood'), return 1000.
            const match = label.match(/^P(\d+)$/);
            if (match) {
              return parseInt(match[1], 10);
            }
            return 1000;
          };

          const aScore = getScore(a.dataset.label || '');
          const bScore = getScore(b.dataset.label || '');

          // Return 'bScore - aScore' (Descending)
          return bScore - aScore;
        },
        callbacks: {
          label: function (context: TooltipItem<any>) {
            let label = context.dataset.label || '';
            
            // Handle Target Probability
            if (context.dataset.yAxisID === 'y1') {
              // Data is already 0-100
              return `${label}: ${Number(context.parsed.y).toFixed(1)}%`;
            }

            // Handle Financial Values (use getRaw to show real value, not clamped)
            const rawVal = getRaw(label, context.dataIndex);
            const displayVal = rawVal !== null ? rawVal : context.parsed.y;
            const formattedVal = `${currencySymbol}${Number(displayVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            
            // Solvency Logic
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
