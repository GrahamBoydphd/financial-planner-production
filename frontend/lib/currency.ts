export const getCurrencySymbol = (code: string): string => {
  const c = code ? code.toUpperCase() : 'USD';
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'Fr',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$',
  };
  return symbols[c] || '$';
};
