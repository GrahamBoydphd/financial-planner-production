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
  minY?: number;
  maxY?: number;
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
  minY,
  maxY,
}: Props) {
  const LOG_FLOOR = 1000;

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
      // Map new labels to data
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
    // Handle Pool Values Raw
    if (datasetLabel === 'Total Pool Contribution' && poolValues) {
        return poolValues[index] ?? null;
    }
    return null;
  };

  // --- Calculate Axis Limits ---
  let yAxisMin = 0;
  let yAxisMax = 100;

  if (maxY !== undefined) {
      yAxisMax = maxY > 0 ? maxY * 1.2 : 100;
      // Snap logic
      if (yAxisMax > 0) {
          const magnitude = Math.pow(10, Math.floor(Math.log10(yAxisMax)));
          const niceStep = magnitude / 2;
          yAxisMax = Math.ceil(yAxisMax / niceStep) * niceStep;
      }
  } else {
      // Fallback if no global max provided
      let dataMax = 0;
      if (mode === 'monte_carlo' && fanData?.p100) {
        // Ignore Month 0 for scaling
        dataMax = Math.max(...fanData.p100.slice(1));
      } else if (values) {
        // Ignore Month 0 for scaling
        dataMax = Math.max(...values.slice(1));
      }
      yAxisMax = dataMax > 0 ? dataMax * 1.2 : 100;
  }

  if (minY !== undefined) {
      if (isLog) {
          yAxisMin = LOG_FLOOR;
      } else {
          // If min is negative, add padding
          if (minY < 0) {
              yAxisMin = minY * 1.1;
          } else {
              yAxisMin = 0; // Default to 0 baseline
          }
      }
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
      pointStyle: 'line',
      fill: false,
    });

    // Investment Line for Standard/Single
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
      backgroundColor: 'rgba(30, 58, 138, 0.6)', // Blue-900ish
      pointRadius: 0,
      pointStyle: 'rect',
      fill: '-1', // Fills to previous dataset (P100)
      order: 51,
    });

    // 3. Upper 15% (P75-P90)
    datasets.push({
      label: 'Upper 15% (P75-P90)',
      data: processArray(fanData.p75),
      solvencyData: fanData.p75_solvent_count,
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', // Blue-600ish
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
      backgroundColor: 'rgba(147, 197, 253, 0.4)', // Blue-300ish
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
      backgroundColor: 'rgba(37, 99, 235, 0.4)', // Blue-600ish
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
      backgroundColor: 'rgba(30, 58, 138, 0.6)', // Blue-900ish
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
      borderColor: 'rgb(37, 99, 235)', // Blue-600 (Matched CashFlowChart)
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      pointStyle: 'line',
      order: 40,
    });

    // 8. Cumulative Investment + Debt (Updated)
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

    // 9. Target Probability (Secondary Axis)
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
        pointStyle: 'line',
        order: 1,
      });
    }
  }

  // --- 3. Net Pool Flow (Universal) ---
  if (poolValues && poolValues.length > 0) {
      datasets.push({
          label: 'Total Pool Contribution',
          data: processArray(poolValues),
          borderColor: 'rgb(168, 85, 247)', // Purple-500
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          fill: false,
          pointStyle: 'line',
          order: 30, // Distinct order
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
          usePointStyle: true,
          filter: function (item: LegendItem) {
            // Hide helper datasets like Top Edge
            return !item.text.includes('Top Edge');
          },
        },
      },
      tooltip: {
        itemSort: function (a: TooltipItem<any>, b: TooltipItem<any>) {
          // Sort by value descending
          return b.parsed.y - a.parsed.y;
        },
        callbacks: {
          label: function (context: TooltipItem<any>) {
            let label = context.dataset.label || '';
            
            // Handle Target Probability
            if (context.dataset.yAxisID === 'y1') {
              // Data is already 0-100
              return `${label}: ${Number(context.parsed.y).toFixed(1)}%`;
            }

            // Custom tooltip for Pool Volume
            if (label === 'Total Pool Contribution') {
                label = 'Pool Volume';
            }

            // Handle Financial Values (use getRaw to show real value, not clamped)
            const rawVal = getRaw(context.dataset.label || '', context.dataIndex);
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
