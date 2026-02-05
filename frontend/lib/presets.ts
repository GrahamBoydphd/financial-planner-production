// NRIG Parameter Helper Options
// Used to translate qualitative descriptions into specific math parameters

export const ALPHA_OPTIONS = [
  { label: "Ultra flat tails", value: "skinny", description: "Extreme events are ultra rare." },
  { label: "Normal Distribution (Bell Curve)", value: "normal", description: "Standard, predictable probabilities. Rare extreme events." },
  { label: "Moderate Tails (Surprises)", value: "moderate", description: "Moderate chance of extreme outcomes (good or bad)." },
  { label: "Heavy Tails (White and Black Swans)", value: "heavy", description: "Extreme events are common. Expect the unexpected." }
];

export const BETA_OPTIONS = [
  { label: "Downside bias is very strong", value: "strong_downside", description: "More likely to crash/drop than to spike up." },
  { label: "Downside bias is medium", value: "medium_downside", description: "Slight negative skew." },
  { label: "Symmetric (Even Chance)", value: "symmetric", description: "Upside and downside risks are equal." },
  { label: "Upside bias is medium", value: "medium_upside", description: "Slight positive skew." },
  { label: "Upside bias is very strong", value: "strong_upside", description: "More likely to surprise on the upside than the downside." }
];

export const SCALE_OPTIONS = [
  { label: "Very Low Volatility (Stable)", value: "very_low", description: "Prices/Values move slower than normal." },
  { label: "Low Volatility", value: "low", description: "Standard low market volatility." },
  { label: "Medium Volatility", value: "medium", description: "Standard high market volatility." },
  { label: "High Volatility", value: "high", description: "Large swings." }
];
