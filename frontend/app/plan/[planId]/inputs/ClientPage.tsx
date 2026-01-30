'use client';

export default function ClientPage({ params }: { params: { planId: string } }) {
  return <div>Plan Inputs for {params.planId}</div>;
}

/**
 * Helper to format growth rates for display.
 * Logic:
 * - If >= 1 (e.g. 5%), show 2 decimals (5.00).
 * - If < 1 (e.g. 0.05%), show 3 significant digits (0.05).
 */
export const fmtRate = (val: string | number) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return val;
  if (Math.abs(num) >= 1) return num.toFixed(2); 
  return parseFloat(num.toPrecision(3)).toString(); 
};
