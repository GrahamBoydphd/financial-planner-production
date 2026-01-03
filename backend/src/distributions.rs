use rand::prelude::*;
use rand_distr::{StudentT, Distribution, WeightedIndex};
use serde::{Deserialize, Serialize};
use rust_decimal::Decimal;
//use rust_decimal::prelude::ToPrimitive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VolatilityModel {
    None { fixed_rate: f64 },
    Flat { 
        average: f64, 
        min: f64, 
        max: f64, 
        intervals: i32 
    },
    StudentsT { 
        mean: f64, 
        scale: f64, 
        freedom: f64 
    },
    NRIG {
        alpha: f64,
        beta: f64,
        delta: f64,
        mu: f64,
    }
}

pub struct GrowthSampler {
    model: VolatilityModel,
    rng: ThreadRng,
}

impl GrowthSampler {
    pub fn new(model: VolatilityModel) -> Self {
        Self {
            model,
            rng: rand::thread_rng(),
        }
    }

    pub fn sample(&mut self) -> Decimal {
        let val: f64 = match &self.model {
            VolatilityModel::None { fixed_rate } => *fixed_rate,
            
            VolatilityModel::Flat { average, min, max, intervals } => {
                let n = *intervals as usize;
                
                // Edge Case: Invalid Range or Count
                if n <= 1 || min >= max {
                    *average 
                }
                // Case A: N=2 (Bernoulli / Coin Flip)
                // We calculate the exact probability P needed to hit the Average.
                else if n == 2 {
                    // P * Max + (1-P) * Min = Average
                    // P * (Max - Min) = Average - Min
                    let range = max - min;
                    let p_high = (average - min) / range;
                    
                    // Clamp to [0,1] for safety
                    let p_high = p_high.max(0.0).min(1.0);
                    
                    if self.rng.gen_bool(p_high) { *max } else { *min }
                }
                // Case B: N > 2 (Linear Ramp / Tilted Uniform)
                else {
                    // 1. Generate the discrete steps (the x values)
                    // If min=-30, max=30, n=3 => [-30, 0, 30]
                    let step_size = (max - min) / ((n - 1) as f64);
                    let x_values: Vec<f64> = (0..n).map(|i| min + i as f64 * step_size).collect();
                    
                    // 2. Calculate the Weights (Probabilities)
                    // Base probability for uniform is 1/N.
                    // We add a linear slope: P_i = 1/N + Slope * (i - center)
                    
                    let mid_idx = (n as f64 - 1.0) / 2.0; 
                    let midpoint_val = (min + max) / 2.0;
                    
                    // How far is our target average from the geometric center?
                    let target_shift = average - midpoint_val;
                    
                    // Math: Slope S = (12 * Shift) / (N * (N^2 - 1) * StepSize)
                    // This formula aligns the "center of mass" of the distribution.
                    let numerator = 12.0 * target_shift;
                    let denominator = (n as f64) * ((n * n) as f64 - 1.0) * step_size;
                    
                    if denominator.abs() < 1e-9 {
                        *average
                    } else {
                        let mut slope = numerator / denominator;
                        
                        // 3. Clamp Slope to prevent negative probabilities
                        // Max valid slope is when the edge probability hits 0.
                        // P_0 = 1/N + S * (0 - mid_idx) >= 0  =>  S <= 1 / (N * mid_idx)
                        let max_slope = 1.0 / (n as f64 * mid_idx);
                        
                        // Clamp
                        if slope > max_slope { slope = max_slope; }
                        if slope < -max_slope { slope = -max_slope; }
                        
                        // 4. Generate Weights
                        let weights: Vec<f64> = (0..n).map(|i| {
                            let dist_from_center = i as f64 - mid_idx;
                            let p = (1.0 / n as f64) + slope * dist_from_center;
                            p.max(0.0)
                        }).collect();
                        
                        // 5. Sample using WeightedIndex
                        match WeightedIndex::new(&weights) {
                            Ok(dist) => x_values[dist.sample(&mut self.rng)],
                            Err(_) => *average // Fallback if math fails
                        }
                    }
                }
            },

            VolatilityModel::StudentsT { mean, scale, freedom } => {
                let dist = StudentT::new(*freedom).unwrap();
                let sample = dist.sample(&mut self.rng);
                mean + (sample * scale)
            },

            VolatilityModel::NRIG { alpha, beta, delta, mu } => {
                // NRIG Sampling Logic
                let gamma = (alpha.powi(2) - beta.powi(2)).sqrt();
                if gamma <= 0.0 { return Decimal::from_f64_retain(*mu).unwrap_or_default(); }

                let ig_mean = delta / gamma;
                let ig_lambda = delta.powi(2);

                let z = sample_inverse_gaussian(&mut self.rng, ig_mean, ig_lambda);

                let norm_mean = mu + (beta * z);
                let norm_std = z.sqrt();
                
                let normal_dist = rand_distr::Normal::new(norm_mean, norm_std).unwrap();
                normal_dist.sample(&mut self.rng)
            }
        };

        Decimal::from_f64_retain(val).unwrap_or_default()
    }
}

// Helper for NRIG (Inverse Gaussian Sampler)
fn sample_inverse_gaussian(rng: &mut ThreadRng, mu: f64, lambda: f64) -> f64 {
    let nu: f64 = rng.sample(rand_distr::StandardNormal); 
    let y = nu * nu;
    let x = mu + (mu*mu*y)/(2.0*lambda) - (mu/(2.0*lambda)) * (4.0*mu*lambda*y + mu*mu*y*y).sqrt();
    let u: f64 = rng.gen(); 
    if u <= mu / (mu + x) { x } else { (mu * mu) / x }
}
