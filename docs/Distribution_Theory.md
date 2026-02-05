
# NRIG (Normal Reciprocal Inverse Gaussian)

I'm puzzled by the different between the outputs using flat and NRIG. I'm wondering if NRIG is doing what I expect. Specifically the time average ought to be significantly lower than the ensemble average for both distribution types, but NRIG is giving the P50 Monte Carlo (approximately the time average) identical to the ensemble average. Flat is correct. Why might that be? Can you check the code and tell me how each is actually working?

Backend_Architect

Custom Gem

The explanation lies in the difference between the **Location Parameter (μ)** and the **True Arithmetic Mean** of the NRIG distribution.

Currently, your `mean()` function for NRIG simply returns `mu`.

- **For Symmetric Distributions (Flat/Normal):** The Mean equals the Location (`mu`). This is why "Flat" works correctly.
    
- **For Skewed Distributions (NRIG):** The True Mean is **shifted** away from `mu` by the skew (β).
    

### The Math

You are using β=−5 (strong negative skew).

- **Location (`mu`):** This is roughly where the "peak" (or Median/P50) of your distribution sits.
    
- **True Mean (E[x]):** Because of the fat tail to the downside, the actual arithmetic average is **significantly lower** than `mu`.
    

**Current Behavior:**

- **Deterministic Run:** Uses `mean()` → returns `mu`. It projects the **Median** outcome.
    
- **Stochastic P50:** Natural volatility drag pulls it to the **Median** outcome (≈ `mu`).
    
- **Result:** The two lines sit on top of each other.
    

**Correct Behavior:**

- **Deterministic Run:** Should project the **True Mean** (which includes the negative drag from the skew).
    
- **Stochastic P50:** Should fall below the True Mean due to volatility drag (Variance Drain).
    
- **Result:** P50 < Ensemble Average.
    

### ｧ CLI Command: Fix NRIG Mean Calculation

This script updates the `mean()` method in `distributions.rs` to calculate the correct arithmetic mean for NRIG, ensuring the "Ensemble/Deterministic" line reflects the true expected value.

Bash

```
./scripts/do_task.sh 'CONTEXT: Fix NRIG Mean Calculation.
PROBLEM: The "mean()" method for NRIG returns "mu" (location), ignoring the skew shift. This causes the Deterministic run to track the Median (P50) instead of the Mean (Ensemble Average).
GOAL: Update "mean()" to return the True Arithmetic Mean.

ACTION:
1. Update "backend/src/distributions.rs":
   - In the "GrowthSampler::mean" method, locate the "VolatilityModel::NRIG" match arm.
   - Replace "=> mu," with the correct formula:
     "let gamma_sq = alpha.powi(2) - beta.powi(2);
      if gamma_sq <= 0.0 { mu } else {
          let gamma = gamma_sq.sqrt();
          mu + delta * (beta / gamma)
      }"

CONSTRAINTS: Ensure correct order of operations. Use "alpha.powi(2)" etc.' backend/src/distributions.rs docs/ARCHITECTURAL_CONTEXT_CLI.md
```

### What to Expect After This Fix

1. **The Deterministic Line will Move:** Since you have negative skew (β=−5), the Deterministic/Ensemble Average line will drop **lower** than it is now (reflecting the true downside risk).
    
2. **P50 Separation:** The P50 (Median) line will likely stay near `mu` (or slightly lower), but it will now be clearly distinct from the Ensemble Average line in a mathematically consistent way.
    
3. **Note on Inputs:** If you want your _final average return_ to be 1.34%, you might need to increase your input `mu` to compensate for the negative skew. Currently, `mu=1.34%` with huge negative skew implies an actual average return of effectively negative.
    

Still not doing what I expect. I'm using these parameters: Active Strategy: NRIG (Mean: 1.34%, α: 0.5, β: 0, δ: 15)

To get similar to the flat choice of mean 1.34, min -30%, max 32.68%

  

The NRIG has both the median and the detereministic mean rising; whereas I expect the P50 to be significantly lower, and want to get it to the point that it drops below the starting point, just as the above flat one does, due to volatility drag.

  

In a sense, NRIG seems to have no volatility drag. Almost as if it's additive not multiplicative.

Backend_Architect

Custom Gem

The reason for the difference is simply the **magnitude of the variance** (volatility). Your "Flat" strategy has massive volatility (Standard Deviation ~18%), while your NRIG settings result in relatively low volatility (Standard Deviation ~5.5%), despite the heavy tails.

Volatility drag (the force that pulls the P50 down) is driven by **Variance**. To get the "drop" you see in the Flat model, you need to increase your NRIG **Delta (δ)** significantly.

### 1. The Math: Why it behaves differently

I analyzed the code in `backend/src/distributions.rs` and compared the statistical properties of your two inputs.

- **Flat Strategy (-30% to +32.68%):**
    
    - This is a uniform distribution with a massive range (approx 63 percentage points).
        
    - **Variance:** ≈327
        
    - **Standard Deviation:** ≈18.1%
        
    - **Result:** This high variance creates a "Drag" of ≈1.6% per month. Since your Mean is only 1.34%, the Drag overpowers the growth (1.34−1.64=−0.3%), causing the P50 to fall over time.
        
- **NRIG Strategy (α=0.5,β=0,δ=15):**
    
    - For a symmetric NRIG (β=0), the Variance formula is simply δ/α.
        
    - **Variance:** 15/0.5=30
        
    - **Standard Deviation:** 30![](data:image/svg+xml;utf8,<svg%20xmlns="http://www.w3.org/2000/svg"%20width="400em"%20height="1.08em"%20viewBox="0%200%20400000%201080"%20preserveAspectRatio="xMinYMin%20slice"><path%20d="M95,702%0Ac-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14%0Ac0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54%0Ac44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10%0As173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429%0Ac69,-144,104.5,-217.7,106.5,-221%0Al0%20-0%0Ac5.3,-9.3,12,-14,20,-14%0AH400000v40H845.2724%0As-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7%0Ac-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z%0AM834%2080h400000v40h-400000z"></path></svg>)​≈5.5%
        
    - **Result:** This lower variance creates a "Drag" of only ≈0.15% per month. Your Mean (1.34%) easily overpowers this small drag (1.34−0.15=+1.19%), so the P50 rises.
        

### 2. The Solution: Increase Delta

To get the NRIG model to behave like the Flat model (i.e., to match its volatility drag), you need to match its Variance (~327).

Using the formula Variance=δ/α:

327=δ/0.5

δ=327×0.5

δ≈163.5

**Try changing your parameters to:**

- **Active Strategy:** NRIG
    
- **Mean:** 1.34%
    
- **α (Alpha):** 0.5
    
- **β (Beta):** 0
    
- **δ (Delta):** **164** (instead of 15)
    

This will widen the bell curve to match the spread of the Flat distribution, generating the volatility drag you expect.

### 3. "Additive vs. Multiplicative"

The simulation **is** multiplicative (that's why the Flat strategy drops). The reason NRIG _looked_ additive (linear growth) is just that at low volatility levels (5%), the "compound interest" effects are small, so the path looks roughly straight. Once you bump the volatility up to ~18% (Delta 164), the multiplicative "drag" will become visible and powerful.

That helps my understanding, remind me, is small alpha or big alpha increasing the chances of fait tails?

Backend_Architect

Custom Gem

**Small alpha (α) increases the chance of fat tails.**

Here is the breakdown:

- **Small Alpha (e.g., 0.5, 1.0):** This creates **"Fat Tails"** (high kurtosis). The probability density function decays slowly, meaning extreme events (black swans) are much more likely than in a Normal distribution.
    
- **Large Alpha (e.g., 50.0+):** This creates **"Thin Tails."** The distribution converges toward a standard Normal (Gaussian) distribution, where extreme events are mathematically negligible.
    

**Visualizing the Impact:** Imagine the distribution as a pile of sand.

- **High Alpha:** A neat, compact pile. The sand doesn't spread far.
    
- **Low Alpha:** A pile that has slumped and spread out wide. There is "more sand" (probability) far away from the center.
    

**In your NRIG Context:**

- You are using **α=0.5**, which is **extremely low**. This means you _do_ have very fat tails (huge potential outliers).
    
- The reason you weren't seeing the "volatility drag" before was simply that the _central width_ (controlled by δ) was too narrow. You had "fat tails" relative to the peak, but the whole distribution was squeezed too tight to matter.
    
- By increasing δ to ~164 (as discussed), you widen the whole distribution, allowing those fat tails to actually hit your simulation with significant force.
    

So, stick with your **Low Alpha (0.5)** to keep the "Black Swan" potential alive, but increase the **Delta (δ)** to make the day-to-day volatility visible.

I've needed to take delta up to 500 to get the very high volatility needed to see drag.

  

For alpha, what should I choose for normal, moderate tails, heavy tails?

For delta, what numbers for low volatility, standard volatility, medium, and high?

Backend_Architect

Custom Gem

Based on your finding that **Delta (δ) = 500** was required to see significant drag (which implies a monthly volatility of ∼30%), here are the practical heuristics for setting your parameters.

Because NRIG math links these two variables (Variance ≈δ/α), the setting for Delta depends entirely on which Alpha you choose.

### 1. Choosing Alpha (α): The "Shape" of Risk

Alpha controls **Kurtosis** (fat tails). It defines _how often_ extreme events happen compared to a normal day.

|Tail Type|Alpha (α) Range|Description|
|---|---|---|
|**Normal (Gaussian)**|**50.0 - 100.0+**|**Thin Tails.** Extreme events are mathematically impossible. 3-sigma events almost never happen. Behaving like a standard "Bell Curve."|
|**Moderate Tails**|**2.0 - 10.0**|**Real World Finance.** Similar to the S&P 500. Extreme days happen occasionally, but the market is usually stable.|
|**Heavy Tails**|**0.5 - 1.5**|**Crypto / VC / Distressed.** "Black Swans" are common. You will frequently see wild jumps or crashes that defy standard probability.|
|**Extreme / Infinite**|**0.1 - 0.5**|**Power Law.** The variance is barely defined. One single event can dominate the entire history.|

> **Recommendation:** Stick to **α=0.5** (your current setting) if you want to model a high-risk/venture environment where "Black Swans" are the norm.

---

### 2. Choosing Delta (δ): The "Amount" of Volatility

Delta controls **Variance** (width). It defines _how big_ the daily swings are.

**Crucial Rule:**

Delta≈Target Variance×Alpha

Since you are using **α=0.5** (Heavy Tails), here are the Delta values to achieve specific volatility levels. Note how quickly they scale up.

#### **For Heavy Tails (α=0.5)**

|Volatility Level|Monthly Std Dev (σ)|Required Delta (δ)|Effect on P50 (Drag)|
|---|---|---|---|
|**Low**|~3%|**4.5**|Negligible. Line looks straight.|
|**Standard**|~6%|**18**|Minimal. Slight curve below mean.|
|**High**|~15%|**112**|**Noticeable.** P50 clearly separates from Mean.|
|**Very High**|~20%|**200**|**Strong.** Distinct downward curve.|
|**Extreme**|~32%|**500**|**Severe.** The "Drag" you are seeing now.|

#### **For Normal Distribution (α=50.0)**

_If you switched to a Normal distribution, you would need massive Deltas to get the same volatility._

|Volatility Level|Monthly Std Dev (σ)|Required Delta (δ)|
|---|---|---|
|**Low**|~3%|**450**|
|**Standard**|~6%|**1,800**|
|**High**|~15%|**11,250**|
|**Extreme**|~32%|**50,000**|

### Summary for your User Interface

If you want to offer simple presets to your users while keeping your "Heavy Tail" (α=0.5) preference:

- **Low Volatility:** δ=5
    
- **Medium Volatility:** δ=50
    
- **High Volatility:** δ=200
    
- **Extreme (Crypto/Startup):** δ=500
    

Great, this helps. Is there a formula to replace $$\text{Delta} \approx \text{Target Variance} \times \text{Alpha}$$ such that I can calculate the right delta for a given alpha for a given menu choice for delta? Right now we do that for beta too: the menu leads to a factor from -0.9 to +0.9 of alpha.

Backend_Architect

Custom Gem

Yes, there is an exact formula!

Since your system already sets Beta (β) as a **factor** of Alpha (i.e., β=factor×α, where the factor is between -0.9 and +0.9), we can create a clean equation that solves for **Delta** (δ) based on your desired **Volatility** (σ).

### The Master Formula

To calculate the correct **Delta** for any given **Alpha**, **Beta Factor**, and **Target Volatility**:

δ=σ2⋅α⋅(1−factor2)1.5

**Where:**

- **δ (Delta):** The value you need to send to the backend.
    
- **σ (Sigma):** Your Target Volatility from the menu (Standard Deviation).
    
    - _Note: Use whole numbers for percentages (e.g., use `20` for 20% volatility, not `0.20`), consistent with your previous finding that Delta ~160 gave ~18% volatility._
        
- **α (Alpha):** The selected tail shape (e.g., 0.5).
    
- **factor:** The Beta slider setting (e.g., -0.9 to +0.9).
    

---

### How to Implement This in Your Menu

You can map your menu options directly to **Target Volatility (σ)** values. This gives you consistent risk levels regardless of how skewed or fat-tailed the distribution is.

#### 1. Define Your Menu (Target σ)

Instead of hardcoding Delta, hardcode the **Volatility** you want the user to experience:

|Menu Option|Target Volatility (σ)|Description|
|---|---|---|
|**Low**|**5**|~5% monthly swing. Stable growth.|
|**Medium**|**15**|~15% monthly swing. Typical volatile stock.|
|**High**|**30**|~30% monthly swing. High risk / Venture.|
|**Extreme**|**50**|~50% monthly swing. Crypto/Distressed.|

#### 2. Calculate Delta Dynamically

When the user changes the "Volatility" dropdown OR the "Skew" (Beta) slider, calculate `delta` on the fly:

JavaScript

```
// Example JavaScript/TypeScript Logic
function calculateDelta(targetVol: number, alpha: number, betaFactor: number) {
    // 1. Calculate Variance (Sigma squared)
    const variance = Math.pow(targetVol, 2); 

    // 2. Calculate the Skew Adjustment: (1 - factor^2)^1.5
    // If factor is 0 (symmetric), this term becomes 1.
    // If factor is high (0.9), this term shrinks Delta to keep volatility constant.
    const skewAdjustment = Math.pow(1 - Math.pow(betaFactor, 2), 1.5);

    // 3. The Formula
    return variance * alpha * skewAdjustment;
}

// Example Usage:
// User selects: "High Volatility" (30), "Heavy Tails" (0.5), "Strong Crash Skew" (-0.9)
const delta = calculateDelta(30, 0.5, -0.9); 
// Result: 900 * 0.5 * 0.082 ≈ 37.2
```

### Why does the Delta drop when Skew is high?

You might notice in the example above that high skew results in a _lower_ Delta (37.2 vs 450 for symmetric).

This is mathematically correct! When you skew a distribution heavily (β→α), the "tail" stretches out immensely. That stretching **adds volatility**. To keep the _total_ volatility constant at your target (e.g., 30%), the formula automatically shrinks the "width" (δ) to compensate for the massive volatility being added by the skew.

### Summary

Replace your fixed Delta list with this formula. It ensures that **"High Volatility"** always means the same amount of risk (Standard Deviation), whether the user chooses a Normal distribution or a highly skewed Black Swan distribution.




# Data contract
Here is the **Complete Data Exchange Contract** for the Frontend/Backend integration. This document covers the exact JSON payloads the Frontend must send and what it can expect to receive for all three distribution types.

### **Core Concept: The "Target Mean" vs. "Mu" Split**

For **ALL** distributions, the Frontend must send the `target_mean` (the user's desired average).

- **Frontend Responsibility:** Display `target_mean` as the editable "Average" field.
    
- **Backend Responsibility:** Calculate `vol_mu` (Location Parameter) from `target_mean`.
    
    - For **NRIG**: `vol_mu` $\neq$ `target_mean` (Backend adjusts for skew/drag).
        
    - For **others**: `vol_mu` = `target_mean`.
        

---

### **1. NRIG Distribution (The Complex One)**

This is the only distribution with two input modes.

#### **Scenario A: Simple Mode (Qualitative Inputs)**

_User selects words from dropdowns. Backend calculates the math._

**Request (Frontend sends):**

JSON

```
{
  "volatility_type": "nrig",
  "target_mean": "1.34",         // User's desired average return %
  "vol_input_mode": "simple",    // FLAG: Tells backend to use the words below

  // The Qualitative Keys (REQUIRED)
  "vol_fatness_level": "heavy",           // Options: skinny, normal, moderate, heavy
  "vol_skew_level": "strong_downside",    // Options: strong_downside, medium_downside, symmetric, medium_upside, strong_upside
  "vol_width_level": "high",              // Options: very_low, low, medium, high

  // The Quantitative Numbers (OPTIONAL/IGNORED)
  // You can send null or 0; backend will overwrite them.
  "vol_alpha": null,
  "vol_beta": null,
  "vol_scale": null
}
```

**Response (Backend returns):**

JSON

```
{
  "volatility_type": "nrig",
  "target_mean": 1.34,
  "vol_mu": 1.85,                // CALCULATED: The Location parameter needed to hit 1.34%
  "vol_input_mode": "simple",

  // Words (Preserved)
  "vol_fatness_level": "heavy",
  "vol_skew_level": "strong_downside",
  "vol_width_level": "high",

  // Numbers (Calculated & Populated)
  "vol_alpha": 0.5,              // Mapped from "heavy"
  "vol_beta": -0.45,             // Mapped from "strong_downside" (-0.9 factor * alpha)
  "vol_scale": 42.4              // Mapped from "high" (using Sigma=32 formula)
}
```

#### **Scenario B: Advanced Mode (Quantitative Inputs)**

_User enters raw numbers. Backend trusts them but fixes the mean._

**Request (Frontend sends):**

JSON

```
{
  "volatility_type": "nrig",
  "target_mean": "1.34",
  "vol_input_mode": "advanced",  // FLAG: Tells backend to use the numbers below

  // The Quantitative Numbers (REQUIRED)
  "vol_alpha": 0.5,
  "vol_beta": -0.2,
  "vol_scale": 100.0,

  // The Qualitative Keys (OPTIONAL)
  // Send null or ignore.
  "vol_fatness_level": null,
  "vol_skew_level": null,
  "vol_width_level": null
}
```

**Response (Backend returns):**

JSON

```
{
  "target_mean": 1.34,
  "vol_mu": 1.52,                // CALCULATED: Adjusted for the specific alpha/beta/scale provided
  "vol_input_mode": "advanced",
  
  "vol_alpha": 0.5,
  "vol_beta": -0.2,
  "vol_scale": 100.0,
  
  // Words are nullified because custom numbers might not match any preset
  "vol_fatness_level": null, 
  "vol_skew_level": null,
  "vol_width_level": null
}
```

---

### **2. Student's T Distribution**

_Standard manual input. No "Simple Mode" mapping logic applies here._

**Request:**

JSON

```
{
  "volatility_type": "student_t",
  "target_mean": "1.34",
  "vol_input_mode": "simple",    // Mode is ignored, but "simple" is a safe default

  // Required Math Parameters
  "vol_freedom": 3.0,            // Degrees of Freedom
  "vol_scale": 15.0,             // Scale parameter
  
  // Ignored/Null
  "vol_alpha": null,
  "vol_beta": null
}
```

**Response:**

JSON

```
{
  "volatility_type": "student_t",
  "target_mean": 1.34,
  "vol_mu": 1.34,                // SAME as Target Mean (Symmetric distribution)
  "vol_freedom": 3.0,
  "vol_scale": 15.0
}
```

---

### **3. Flat Distribution**

_Legacy/Standard. Uses Min/Max._

**Request:**

JSON

```
{
  "volatility_type": "flat",
  "target_mean": "1.34",         // Primarily for UI display
  
  // Required Range Parameters
  "vol_min": -30.0,
  "vol_max": 32.68
}
```

**Response:**

JSON

```
{
  "volatility_type": "flat",
  "target_mean": 1.34,
  "vol_mu": 1.34,                // SAME as Target Mean
  "vol_min": -30.0,
  "vol_max": 32.68
}
```

---

### **Frontend Implementation Key-Value Reference (NRIG Only)**

Use these **Keys** in the `value` field of your dropdown options.

**1. Fatness (`vol_fatness_level`)**

| Menu Label | Backend Key |

| :--- | :--- |

| Ultra flat tails | `skinny` |

| Normal Distribution (Bell Curve) | `normal` |

| Moderate Tails (Surprises) | `moderate` |

| Heavy Tails (White and Black Swans) | `heavy` |

**2. Skew (`vol_skew_level`)**

| Menu Label | Backend Key |

| :--- | :--- |

| Downside bias is very strong | `strong_downside` |

| Downside bias is medium | `medium_downside` |

| Symmetric (Even Chance) | `symmetric` |

| Upside bias is medium | `medium_upside` |

| Upside bias is very strong | `strong_upside` |

**3. Width (`vol_width_level`)**

| Menu Label | Backend Key |

| :--- | :--- |

| Very Low Volatility (Stable) | `very_low` |

| Low Volatility | `low` |

| Medium Volatility | `medium` |

| High Volatility | `high` |