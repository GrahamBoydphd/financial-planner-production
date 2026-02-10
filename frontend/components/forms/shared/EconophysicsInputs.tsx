import React from 'react';

export interface EconophysicsInputsProps {
  active: boolean;
  threshold: string;
  fraction: string;
  currencyCode?: string;
  onChangeActive: (val: boolean) => void;
  onChangeThreshold: (val: string) => void;
  onChangeFraction: (val: string) => void;
}

export const EconophysicsInputs: React.FC<EconophysicsInputsProps> = ({
  active,
  threshold,
  fraction,
  currencyCode = 'EUR',
  onChangeActive,
  onChangeThreshold,
  onChangeFraction,
}) => {
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove commas to get raw number string
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '') {
      onChangeThreshold('');
      return;
    }
    const num = Number(rawValue);
    if (!isNaN(num)) {
      onChangeThreshold(num.toLocaleString());
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Econophysics & Friction</h3>
        <div className="text-sm text-gray-500 mb-4 italic space-y-2">
          <p>
            This simulation does not yet have any of the limiting aspects that become relevant when companies grow very large. 
            To stay aligned with <strong>Econophysics</strong> we need a way to represent the friction of the real world, which increases with scale:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li><strong>Diminishing Returns:</strong> Doubling a 100B company is harder than doubling a 1M company.</li>
            <li><strong>Resource Constraints:</strong> The material supply, the market for your product, isn't infinite (GDP cap).</li>
            <li><strong>Regulatory/Social Friction:</strong> Antitrust, strikes, higher taxes, organizational entropy.</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="econophysicsActive"
            checked={active}
            onChange={(e) => onChangeActive(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="econophysicsActive" className="text-sm font-medium text-gray-700">
            Enable friction on high end
          </label>
        </div>

        {active && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold ({currencyCode})
              </label>
              <input
                type="text"
                value={threshold}
                onChange={handleThresholdChange}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="100,000,000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Value above which friction applies.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Friction Loss on excess (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={fraction}
                  onChange={(e) => onChangeFraction(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 pr-8"
                  placeholder="5"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                % of excess value removed annually.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
