// NRIG Parameter Helper Options
// Used to translate qualitative descriptions into specific math parameters

export const ALPHA_OPTIONS = [
  { label: "Normal Distribution (Bell Curve)", value: 50.0, description: "Standard, predictable probabilities. Rare extreme events." },
  { label: "Heavy Tails (Frequent Surprises)", value: 2.0, description: "Higher chance of extreme outcomes (good or bad)." },
  { label: "Very Heavy Tails (White and Black Swans)", value: 0.5, description: "Extreme events are common. Expect the unexpected." }
];

export const BETA_OPTIONS = [
  { label: "Downside tail is a lot fatter (Black swans)", value: -0.9, description: "More likely to crash/drop than to spike up." },
  { label: "Downside tail is a little fatter", value: -0.4, description: "Slight negative skew." },
  { label: "Symmetric (Even Chance)", value: 0.0, description: "Upside and downside risks are equal." },
  { label: "Upside tail is a little fatter", value: 0.4, description: "Slight positive skew." },
  { label: "Upside tail is a lot fatter (White swans)", value: 0.9, description: "More likely to surprise on the upside than the downside." }
];

export const SCALE_OPTIONS = [
  { label: "Low Volatility (Stable)", value: 1.0, description: "Prices/Values move slower than normal." },
  { label: "Medium Volatility", value: 5.0, description: "Standard market movement." },
  { label: "High Volatility", value: 15.0, description: "Larger swings." }
];
