'use client';

import Card from '@/components/ui/Card';
import { SimulationResult } from '@/lib/api';

interface Props {
  data: SimulationResult;
  currency: string;
  mode: 'single' | 'monte_carlo' | 'standard';
  currentPathValues?: {
    netValue: number;
  };
  isRow?: boolean;
  targetMultiple?: number;
  dpiValue?: number;
  likelihoodValue?: number;
}

export default function FundKPICards({ 
  data, 
  currency, 
  mode, 
  currentPathValues, 
  isRow = false,
  targetMultiple,
  dpiValue,
  likelihoodValue
}: Props) {
  const fmt = (n: any) => 
    `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // Helper to get the last value of a specific field from a dataset
  const getLast = (dataset: any[], field: string) => {
    if (!dataset || dataset.length === 0) return 0;
    const lastRow = dataset[dataset.length - 1];
    return Number(lastRow[field] || 0);
  };

  // 1. METRICS EXTRACTION
  let netValue: number | undefined = undefined;
  let labelSuffix = '';
  
  // Show Investor Metrics in Monte Carlo and Single mode
  const showInvestorMetrics = mode === 'monte_carlo' || mode === 'single';

  if (mode === 'monte_carlo') {
    // P50 Data
    if (data.p50_data && data.p50_data.length > 0) {
        netValue = getLast(data.p50_data, 'total_value');
        labelSuffix = '(Pathwise P50)';
    }
  } else if (mode === 'single') {
    // Single Run Data (Volatile)
    if (currentPathValues) {
        netValue = currentPathValues.netValue;
        labelSuffix = '(Current Path)';
    }
    // No fallback to deterministic
  } else {
    // Standard / Deterministic
    netValue = getLast(data.deterministic_data, 'total_value');
    labelSuffix = '(Deterministic)';
  }

  // Layout: Row = Grid 4 cols (for Single View), Col = Flex Col (for Sidebar)
  const containerClass = isRow 
    ? "grid grid-cols-1 md:grid-cols-4 gap-4 w-full" 
    : "flex flex-col gap-4 w-full";

  // Formatting for Likelihood
  const likelihoodPct = likelihoodValue !== undefined ? (likelihoodValue * 100).toFixed(1) : '0.0';
  const likelihoodNum = Number(likelihoodPct);

  // Formatting for DPI
  const dpiDisplay = dpiValue !== undefined ? dpiValue.toFixed(2) : '0.00';

  return (
    <div className={containerClass}>
      
      {/* CARD 1: LIKELIHOOD (Replaces Survival) */}
      {showInvestorMetrics && targetMultiple !== undefined && (
        <Card className={`text-center border-t-4 p-4 ${likelihoodNum < 50 ? 'border-orange-400' : 'border-green-500'}`}>
            <h3 className="text-gray-500 text-xs uppercase font-bold">Likelihood of hitting {targetMultiple}X Target</h3>
            <p className={`text-3xl font-bold mt-2 ${likelihoodNum < 50 ? 'text-orange-600' : 'text-green-600'}`}>
            {likelihoodPct}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Probability of Success</p>
        </Card>
      )}

      {/* CARD 2: NET VALUE */}
      <Card className="text-center border-t-4 border-blue-500 p-4">
        <h3 className="text-gray-500 text-xs uppercase font-bold">Net Value {labelSuffix}</h3>
        <p className="text-3xl font-bold mt-2 text-gray-800">
          {netValue !== undefined ? fmt(netValue) : 'N/A'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Aggregated Cash + Dividends</p>
      </Card>

      {/* CARD 3: CASH BALANCE - REMOVED */}

      {/* CARD 4: DPI (New) */}
      {showInvestorMetrics && (
        <Card className="text-center border-t-4 border-purple-500 p-4">
            <h3 className="text-gray-500 text-xs uppercase font-bold">DPI (Distributed to Paid-In)</h3>
            <p className="text-3xl font-bold mt-2 text-purple-700">
            {dpiDisplay}x
            </p>
            <p className="text-xs text-gray-400 mt-1">Realized Returns</p>
            <p className='text-xs italic text-gray-500 mt-2'>* in this simulation only dividends are distributed, no companies are able to be sold.</p>
        </Card>
      )}

    </div>
  );
}
