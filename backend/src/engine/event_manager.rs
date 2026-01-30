use rand::Rng;
use std::f64::consts::PI;
use crate::models::Event;
use rust_decimal::prelude::ToPrimitive;

// --- Event Domain Models (Internal) ---

#[derive(Debug, Clone, PartialEq)]
pub enum EventMagnitude {
    Small,
    Medium,
    Large,
    Catastrophic,
}

#[derive(Debug, Clone, PartialEq)]
pub enum EventDirection {
    DetrimentalOnly,
    BeneficialOnly,
    BothBiasedDetrimental,
    BothBiasedBeneficial,
    BothNeutral,
}

#[derive(Debug, Clone, PartialEq)]
pub enum EventDuration {
    Short,
    Medium,
    Long,
}

// --- Event Manager ---

pub struct EventManager;

impl EventManager {
    pub fn new() -> Self {
        Self
    }

    /// Checks if an event triggers in the current time step (month).
    /// Converts Annual Probability to Monthly Probability: P_m = 1 - (1 - P_a)^(1/12)
    pub fn check_trigger(&self, event: &Event) -> bool {
        // Extract probability from model (Decimal -> f64)
        // likelihood_annual_pct is e.g. 20.0 for 20%
        let probability = event.likelihood_annual_pct.and_then(|d| d.to_f64()).unwrap_or(0.0) / 100.0;

        // Safety checks
        if probability <= 0.0 {
            return false;
        }
        if probability >= 1.0 {
            return true;
        }

        // Formula: P_m = 1 - (1 - P_a)^(1/12)
        let monthly_probability = 1.0 - (1.0 - probability).powf(1.0 / 12.0);
        
        // Stochastic trigger
        rand::random::<f64>() < monthly_probability
    }

    /// Resolves the impact of a triggered event.
    /// Returns a tuple: (impact_magnitude, duration_months)
    /// 
    /// Impact Magnitude is a percentage (e.g., 5.0 for 5%).
    /// Duration is in months.
    pub fn resolve_impact(&self, event: &Event) -> (f64, i32) {
        let mut rng = rand::thread_rng();

        let mag_input = event.magnitude.as_deref().unwrap_or("Small");

        let raw_dir = event.direction.as_deref().unwrap_or("DetrimentalOnly");
        let direction = match raw_dir.to_lowercase().as_str() {
            "beneficial" | "beneficialonly" | "beneficial_only" => EventDirection::BeneficialOnly,
            "both (biased detrimental)" | "both_biased_detrimental" => EventDirection::BothBiasedDetrimental,
            "both (biased beneficial)" | "both_biased_beneficial" => EventDirection::BothBiasedBeneficial,
            "neutral" | "both" | "both (neutral)" | "both_neutral" => EventDirection::BothNeutral,
            "detrimental" | "detrimentalonly" | "detrimental_only" => EventDirection::DetrimentalOnly,
            _ => {
                EventDirection::DetrimentalOnly
            }
        };

        let duration_cat = match event.duration_category.as_deref().unwrap_or("short").to_lowercase().as_str() {
            "medium" => EventDuration::Medium,
            "long" => EventDuration::Long,
            "short" => EventDuration::Short,
            _ => {
                EventDuration::Short
            }
        };

        // 1. Determine Base Magnitude (Normal Distribution)
        // UPDATED: Values are now Percentages (0-100 scale) to match domain.rs division logic.
        // Also handles numeric strings (e.g. "0.80" or "80")
        let (mean, std_dev) = if let Ok(val) = mag_input.parse::<f64>() {
            // STRICT: val is ALREADY percent. 0.8 means 0.8%.
            (val, val * 0.2)
        } else {
            // Map Model Strings to Internal Enums
            match mag_input.to_lowercase().as_str() {
                "small" => (10.0, 2.0),
                "medium" => (30.0, 5.0),
                "large" => (50.0, 10.0),
                "catastrophic" | "catastrophe" | "catastrophy" => (80.0, 15.0),
                _ => {
                    (10.0, 2.0)
                }
            }
        };

        // Sample from Normal Distribution and take absolute value for magnitude scale
        let raw_magnitude = sample_normal(&mut rng, mean, std_dev).abs();

        // 2. Determine Direction (Sign)
        let impact = match direction {
            EventDirection::DetrimentalOnly => -raw_magnitude,
            EventDirection::BeneficialOnly => raw_magnitude,
            EventDirection::BothNeutral => {
                // 50% chance positive or negative
                if rng.gen_bool(0.5) {
                    raw_magnitude
                } else {
                    -raw_magnitude
                }
            }
            EventDirection::BothBiasedDetrimental => {
                // 75% chance negative (Majority)
                if rng.gen_bool(0.75) {
                    -raw_magnitude
                } else {
                    // 25% chance positive (Minority)
                    raw_magnitude * 0.25
                }
            }
            EventDirection::BothBiasedBeneficial => {
                // 75% chance positive (Majority)
                if rng.gen_bool(0.75) {
                    raw_magnitude
                } else {
                    // 25% chance negative (Minority)
                    -raw_magnitude * 0.25
                }
            }
        };

        // 3. Determine Duration
        let duration = match duration_cat {
            EventDuration::Short => rng.gen_range(1..5),   // 1 to 4 months
            EventDuration::Medium => rng.gen_range(4..9),  // 4 to 8 months
            EventDuration::Long => rng.gen_range(8..25),   // 8 to 24 months
        };

        (impact, duration)
    }
}

/// Helper function to generate normally distributed random numbers
/// using the Box-Muller transform.
/// Returns a single sample from N(mean, std_dev).
fn sample_normal<R: Rng>(rng: &mut R, mean: f64, std_dev: f64) -> f64 {
    // Box-Muller transform
    // u1 must be > 0 for ln()
    let u1: f64 = rng.gen::<f64>().max(f64::EPSILON);
    let u2: f64 = rng.gen();

    let z0 = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
    
    mean + (z0 * std_dev)
}
