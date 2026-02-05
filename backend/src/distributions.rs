use rand::prelude::*;
use rand_distr::{StudentT, Distribution, WeightedIndex, Normal, StandardNormal};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrowthSampler {
    model: VolatilityModel,
}

impl Default for GrowthSampler {
    fn default() -> Self {
        Self::new(VolatilityModel::None { fixed_rate: 0.0 })
    }
}

impl GrowthSampler {
    pub fn new(model: VolatilityModel) -> Self {
        Self { model }
    }

    pub fn mean(&self) -> f64 {
        match self.model {
            VolatilityModel::None { fixed_rate } => fixed_rate,
            VolatilityModel::Flat { average, .. } => average,
            VolatilityModel::StudentsT { mean, .. } => mean,
            VolatilityModel::NRIG { alpha, beta, delta, mu } => {
                let gamma_sq = alpha.powi(2) - beta.powi(2);
                if gamma_sq <= 0.0 { 
                    mu 
                } else {
                    let gamma = gamma_sq.sqrt();
                    mu + delta * (beta / gamma)
                }
            },
        }
    }

    pub fn set_model(&mut self, model: VolatilityModel) {
        self.model = model;
    }

    pub fn sample(&self) -> f64 {
        let mut rng = rand::thread_rng();
        
        match self.model {
            VolatilityModel::None { fixed_rate } => fixed_rate,
            
            VolatilityModel::Flat { average, min, max, intervals } => {
                if intervals <= 1 { return average; }
                let n = intervals as f64;
                
                // Edge Case: Invalid Range
                if min >= max {
                    return average;
                }
                
                // Case A: N=2 (Bernoulli / Coin Flip)
                if n == 2.0 {
                    let range = max - min;
                    if range.abs() < 1e-9 { return average; }
                    
                    let p_high = (average - min) / range;
                    let p_high = p_high.max(0.0).min(1.0);
                    
                    return if rng.gen_bool(p_high) { max } else { min };
                }
                
                // Case B: N > 2 (Linear Ramp / Tilted Uniform)
                let step_size = (max - min) / (n - 1.0);
                
                let mid_idx = (n - 1.0) / 2.0; 
                let midpoint_val = (min + max) / 2.0;
                let target_shift = average - midpoint_val;
                
                let numerator = 12.0 * target_shift;
                let denominator = n * (n * n - 1.0) * step_size;
                
                if denominator.abs() < 1e-9 {
                    return average;
                }
                
                let mut slope = numerator / denominator;
                let max_slope = 1.0 / (n * mid_idx);
                
                if slope > max_slope { slope = max_slope; }
                if slope < -max_slope { slope = -max_slope; }
                
                let weights: Vec<f64> = (0..(n as usize)).map(|i| {
                    let dist_from_center = i as f64 - mid_idx;
                    let p = (1.0 / n) + slope * dist_from_center;
                    p.max(0.0)
                }).collect();
                
                match WeightedIndex::new(&weights) {
                    Ok(dist) => {
                        let idx = dist.sample(&mut rng);
                        min + idx as f64 * step_size
                    },
                    Err(_) => average 
                }
            },

            VolatilityModel::StudentsT { mean, scale, freedom } => {
                let safe_freedom = if freedom <= 0.0 { 3.0 } else { freedom };
                let dist = StudentT::new(safe_freedom).unwrap_or_else(|_| StudentT::new(3.0).unwrap());
                let sample = dist.sample(&mut rng);
                mean + (sample * scale)
            },

            VolatilityModel::NRIG { alpha, beta, delta, mu } => {
                let gamma_sq = alpha.powi(2) - beta.powi(2);
                if gamma_sq <= 0.0 { return mu; }

                let gamma = gamma_sq.sqrt();
                let ig_mean = delta / gamma;
                let ig_lambda = delta.powi(2);

                let z = sample_inverse_gaussian(&mut rng, ig_mean, ig_lambda);

                let norm_mean = mu + (beta * z);
                let norm_std = z.sqrt();
                
                let normal_dist = Normal::new(norm_mean, norm_std).unwrap_or_else(|_| Normal::new(norm_mean, 1.0).unwrap());
                normal_dist.sample(&mut rng)
            }
        }
    }
}

// Helper for NRIG (Inverse Gaussian Sampler)
fn sample_inverse_gaussian(rng: &mut ThreadRng, mu: f64, lambda: f64) -> f64 {
    let nu: f64 = rng.sample(StandardNormal); 
    let y = nu * nu;
    let x = mu + (mu*mu*y)/(2.0*lambda) - (mu/(2.0*lambda)) * (4.0*mu*lambda*y + mu*mu*y*y).sqrt();
    let u: f64 = rng.gen(); 
    if u <= mu / (mu + x) { x } else { (mu * mu) / x }
}

/// Factory function to create a GrowthSampler from raw parameters.
/// This bridges the DB/API DTOs to the internal Engine logic.
pub fn create_sampler(
    vol_type: Option<&str>,
    mean: Option<f64>,
    scale: Option<f64>,
    min: Option<f64>,
    max: Option<f64>,
    intervals: Option<i32>,
    freedom: Option<f64>,
    alpha: Option<f64>,
    beta: Option<f64>,
) -> GrowthSampler {
    let model = match vol_type.unwrap_or("none") {
        "flat" | "uniform" => {
            // Safety: Clamp intervals to prevent OOM or excessive computation
            let safe_intervals = intervals.unwrap_or(10).clamp(2, 2000);
            VolatilityModel::Flat {
                average: mean.unwrap_or(0.0),
                min: min.unwrap_or(0.0),
                max: max.unwrap_or(0.0),
                intervals: safe_intervals,
            }
        },
        "student_t" | "studentt" => VolatilityModel::StudentsT {
            mean: mean.unwrap_or(0.0),
            scale: scale.unwrap_or(1.0),
            freedom: freedom.unwrap_or(3.0),
        },
        "normal" | "log_normal" | "lognormal" => VolatilityModel::StudentsT {
            mean: mean.unwrap_or(0.0),
            scale: scale.unwrap_or(0.1),
            freedom: 30.0,
        },
        "nrig" => VolatilityModel::NRIG {
            alpha: alpha.unwrap_or(1.0),
            beta: beta.unwrap_or(0.0),
            delta: scale.unwrap_or(1.0), // Using scale as delta for NRIG if not explicit
            mu: mean.unwrap_or(0.0),
        },
        _ => VolatilityModel::None {
            fixed_rate: mean.unwrap_or(0.0),
        },
    };
    GrowthSampler::new(model)
}
