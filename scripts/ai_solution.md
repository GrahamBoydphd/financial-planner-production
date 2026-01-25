🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='backend/src/engine/orchestrator.rs'>
use crate::engine::domain::{Universe, SimState};
use crate::projection::{SimulationResult, MonthlyData};
use crate::distributions::VolatilityModel;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use std::cmp::Ordering;
use std::marker::PhantomData;

pub trait SimulationMode {}
pub struct PortfolioMode;
impl SimulationMode for PortfolioMode {}
pub struct EnsembleMode;
impl SimulationMode for EnsembleMode {}

pub struct FundOrchestrator<Mode: SimulationMode> {
    pub universes: Vec<Universe>,
    pub deterministic_universe: Universe,
    pub months: i32,
    _marker: PhantomData<Mode>,
}

impl<Mode: SimulationMode> FundOrchestrator<Mode> {
    pub fn new(iterations: usize, initial_states: Vec<SimState>, months: i32, stop_insolvency: bool) -> Self {
        // println!("🚀 Orchestrator Initializing: {} iterations, {} months, stop_insolvency={}", iterations, months, stop_insolvency);
        
        // 1. Create Monte Carlo Universes
        let mut universes = Vec::with_capacity(iterations);
        for _ in 0..iterations {
            universes.push(Universe::new(initial_states.clone()));
        }

        // Apply stop_insolvency to MC universes AND Initialize Month 0
        for u in universes.iter_mut() {
            for c in u.companies.iter_mut() {
                c.stop_on_insolvency = stop_insolvency;
                c.initialize();
            }
        }

        // 2. Create Deterministic Universe (No Volatility)
        let mut det_states = initial_states.clone();
        for state in det_states.iter_mut() {
            // Sanitize Revenue
            for item in state.revenue_states.iter_mut() {
                let mean = item.sampler.mean();
                item.sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
            // Sanitize Expenses
            for item in state.expense_states.iter_mut() {
                let mean = item.sampler.mean();
                item.sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
            // Sanitize Capital Growth Policy
            if let Some(sampler) = &mut state.cap_growth_sampler {
                let mean = sampler.mean();
                sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
        }
        
        let mut deterministic_universe = Universe::new(det_states);
        
        // Apply stop_insolvency to Deterministic universe AND Initialize Month 0
        for c in deterministic_universe.companies.iter_mut() {
            c.stop_on_insolvency = stop_insolvency;
            c.initialize();
        }

        Self { 
            universes, 
            deterministic_universe, 
            months,
            _marker: PhantomData 
        }
    }

    /// Steps a universe forward by one month.
    /// Returns the total "pool pot" collected from this universe (if any).
    /// 
    /// - `enable_horizontal_pooling`: If true, distributes the pot within the universe immediately.
    /// - `apply_reaper`: If true, checks for insolvency and marks companies as dead if cash < 0.
    fn step_universe(universe: &mut Universe, month_idx: i32, enable_horizontal_pooling: bool, apply_reaper: bool) -> f64 {
        let mut pool_pot = 0.0;
        let mut solvent_count = 0;

        // TICK: Step all companies and collect pool contributions
        for company in universe.companies.iter_mut() {
            let (_, actual_contribution) = company.step(month_idx);

            if company.is_solvent {
                solvent_count += 1;
                pool_pot += actual_contribution;
            }
        }

        // if pool_pot > 0.0 { println!("DEBUG: Orchestrator Month {}: Pot Collected = {}", month_idx, pool_pot); }

        // TOCK: Distribute pool to solvent companies (Horizontal Pooling)
        if enable_horizontal_pooling {
            if solvent_count > 0 && pool_pot > 0.0 {
                let share = pool_pot / solvent_count as f64;

                println!("DEBUG: Orchestrator Month {}: Distributing Pot {} among {} solvent companies (Share: {})", month_idx, pool_pot, solvent_count, share);

                for company in universe.companies.iter_mut() {
                    if company.is_solvent {
                        // Update Company State
                        company.current_cash += share;
                        company.cum_pool_received += share;

                        if company.company_name.ends_with("A") { println!("DEBUG: Company A received subsidy: {}. New Cash: {}", share, company.current_cash); }

                        // Update History
                        if let Some(last_entry) = company.history.last_mut() {
                            last_entry.cash_balance = Decimal::from_f64_retain(company.current_cash).unwrap_or_default();
                            last_entry.cumulative_pool_received = Decimal::from_f64_retain(company.cum_pool_received).unwrap_or_default();
                            last_entry.total_value = last_entry.cash_balance + last_entry.cumulative_dividends;
                        }
                    }
                }
            }
            // Pot is consumed locally
            pool_pot = 0.0; 
        }

        // REAPER: Check for insolvency after all cash movements
        if apply_reaper {
            Self::run_reaper(universe);
        }

        // Return the pot (only non-zero if enable_horizontal_pooling is false)
        pool_pot
    }

    fn run_reaper(universe: &mut Universe) {
        for company in universe.companies.iter_mut() {
            if company.stop_on_insolvency && company.current_cash < company.insolvency_threshold {
                company.is_solvent = false;
                if let Some(last) = company.history.last_mut() {
                    last.is_solvent = false;
                }
            }
        }
    }

    fn aggregate_universe_history(universe: &Universe, months: i32) -> Vec<MonthlyData> {
        let mut universe_history = Vec::with_capacity((months + 1) as usize);
        let total_fund_companies = universe.companies.len() as i32;
        
        for m in 0..=months {
            let month_idx = m as usize;
            
            // Accumulators
            let mut total_revenue = 0.0;
            let mut total_opex = 0.0;
            let mut total_net_income = 0.0;
            let mut total_cash = 0.0;
            let mut total_value = 0.0;
            let mut total_pool_received = 0.0;
            let mut sum_investment = 0.0;
            let mut solvent_companies = 0;

            for company in &universe.companies {
                // Safety: Ensure we don't panic if history is missing
                if let Some(data) = company.history.get(month_idx) {
                    total_revenue += data.revenue.to_f64().unwrap_or(0.0);
                    total_opex += data.opex.to_f64().unwrap_or(0.0);
                    total_net_income += data.net_income.to_f64().unwrap_or(0.0);
                    total_cash += data.cash_balance.to_f64().unwrap_or(0.0);
                    total_value += data.total_value.to_f64().unwrap_or(0.0);
                    total_pool_received += data.cumulative_pool_received.to_f64().unwrap_or(0.0);
                    sum_investment += data.cumulative_external_capital.to_f64().unwrap_or(0.0);
                    
                    if data.is_solvent {
                        solvent_companies += 1;
                    }
                }
            }

            // Construct MonthlyData for the Fund (Universe)
            universe_history.push(MonthlyData {
                month_index: m,
                date: format!("Month {}", m),
                revenue: Decimal::from_f64_retain(total_revenue).unwrap_or_default(),
                cogs: Decimal::ZERO, 
                gross_profit: Decimal::ZERO, 
                opex: Decimal::from_f64_retain(total_opex).unwrap_or_default(),
                interest_expense: Decimal::ZERO,
                net_income: Decimal::from_f64_retain(total_net_income).unwrap_or_default(),
                cash_balance: Decimal::from_f64_retain(total_cash).unwrap_or_default(),
                dividend_paid: Decimal::ZERO,
                cumulative_dividends: Decimal::ZERO,
                cumulative_external_capital: Decimal::from_f64_retain(sum_investment).unwrap_or_default(),
                cumulative_pool_received: Decimal::from_f64_retain(total_pool_received).unwrap_or_default(),
                total_value: Decimal::from_f64_retain(total_value).unwrap_or_default(),
                is_solvent: solvent_companies > 0,
                total_companies: total_fund_companies,
                solvent_companies: solvent_companies,
            });
        }
        universe_history
    }

    fn finalize_results(self, fund_trajectories: Vec<Vec<MonthlyData>>, deterministic_data: Vec<MonthlyData>) -> SimulationResult {
        let iterations = fund_trajectories.len();
        
        // Generate Labels
        let mut labels = Vec::new();
        for m in 0..=self.months {
            labels.push(format!("Month {}", m));
        }

        // Statistical Aggregation
        let cap = (self.months + 1) as usize;
        let mut p0_vec = Vec::with_capacity(cap);
        let mut p10_vec = Vec::with_capacity(cap);
        let mut p25_vec = Vec::with_capacity(cap);
        let mut p50_vec = Vec::with_capacity(cap);
        let mut p75_vec = Vec::with_capacity(cap);
        let mut p90_vec = Vec::with_capacity(cap);
        let mut p100_vec = Vec::with_capacity(cap);

        let mut p0_count = Vec::with_capacity(cap);
        let mut p10_count = Vec::with_capacity(cap);
        let mut p25_count = Vec::with_capacity(cap);
        let mut p50_count = Vec::with_capacity(cap);
        let mut p75_count = Vec::with_capacity(cap);
        let mut p90_count = Vec::with_capacity(cap);
        let mut p100_count = Vec::with_capacity(cap);

        let mut survival_vec = Vec::with_capacity(cap);
        let mut p50_data = Vec::with_capacity(cap);

        if !fund_trajectories.is_empty() {
            for m_idx in 0..cap {
                let mut snapshots: Vec<&MonthlyData> = Vec::with_capacity(iterations);
                let mut solvent_universes = 0;

                for run in &fund_trajectories {
                    if let Some(data) = run.get(m_idx) {
                        snapshots.push(data);
                        
                        if data.is_solvent {
                            solvent_universes += 1;
                        }
                    }
                }

                // Sort snapshots by Total Value (NAV)
                snapshots.sort_by(|a, b| a.total_value.cmp(&b.total_value));
                let len = snapshots.len();

                if len > 0 {
                    let get_snapshot = |idx: usize| -> &MonthlyData {
                        snapshots[idx]
                    };

                    let p0 = get_snapshot(0);
                    let p10 = get_snapshot((len as f64 * 0.10) as usize);
                    let p25 = get_snapshot((len as f64 * 0.25) as usize);
                    let p50 = get_snapshot((len as f64 * 0.50) as usize);
                    let p75 = get_snapshot((len as f64 * 0.75) as usize);
                    let p90 = get_snapshot((len as f64 * 0.90) as usize);
                    let p100 = get_snapshot(len - 1);

                    // Push Values
                    p0_vec.push(p0.total_value);
                    p10_vec.push(p10.total_value);
                    p25_vec.push(p25.total_value);
                    p50_vec.push(p50.total_value);
                    p75_vec.push(p75.total_value);
                    p90_vec.push(p90.total_value);
                    p100_vec.push(p100.total_value);

                    // Push Solvent Counts
                    p0_count.push(p0.solvent_companies);
                    p10_count.push(p10.solvent_companies);
                    p25_count.push(p25.solvent_companies);
                    p50_count.push(p50.solvent_companies);
                    p75_count.push(p75.solvent_companies);
                    p90_count.push(p90.solvent_companies);
                    p100_count.push(p100.solvent_companies);

                    // P50 Data (Full Snapshot)
                    p50_data.push(p50.clone());
                }

                let rate = if iterations > 0 {
                    solvent_universes as f64 / iterations as f64
                } else {
                    0.0
                };
                survival_vec.push(Decimal::from_f64_retain(rate).unwrap_or_default());
            }
        }

        // Calculate Single Run Data (Median Trajectory)
        let mut single_run_data = None;
        let mut single_run_value = None;

        if !fund_trajectories.is_empty() {
            // Sort indices based on the total_value of the last month
            let mut indices: Vec<usize> = (0..fund_trajectories.len()).collect();
            indices.sort_by(|&a, &b| {
                let val_a = fund_trajectories[a].last().map(|m| m.total_value).unwrap_or(Decimal::ZERO);
                let val_b = fund_trajectories[b].last().map(|m| m.total_value).unwrap_or(Decimal::ZERO);
                val_a.cmp(&val_b)
            });

            // Pick the median trajectory
            if !indices.is_empty() {
                let median_idx = indices[indices.len() / 2];
                let selected_run = &fund_trajectories[median_idx];

                single_run_data = Some(selected_run.clone());
                single_run_value = Some(selected_run.iter().map(|m| m.total_value).collect());
            }
        }

        SimulationResult {
            labels,
            valuation_method: "fund_nav".to_string(),
            deterministic_data,
            single_run_data,
            single_run_value,
            p0_value: Some(p0_vec),
            p10_value: Some(p10_vec),
            p25_value: Some(p25_vec),
            p50_value: Some(p50_vec),
            p75_value: Some(p75_vec),
            p90_value: Some(p90_vec),
            p100_value: Some(p100_vec),
            p0_solvent_count: p0_count,
            p10_solvent_count: p10_count,
            p25_solvent_count: p25_count,
            p50_solvent_count: p50_count,
            p75_solvent_count: p75_count,
            p90_solvent_count: p90_count,
            p100_solvent_count: p100_count,
            p50_pool_cumulative: None,
            p50_data: Some(p50_data),
            survival_rate: Some(survival_vec),
            deterministic_runway: None,
            deterministic_valuation: Decimal::ZERO,
            single_run_runway: None,
            single_run_valuation: None,
            p50_runway: None,
            p50_valuation: None,
            all_paths: Some(fund_trajectories),
        }
    }
}

impl FundOrchestrator<PortfolioMode> {
    pub fn run(mut self) -> SimulationResult {
        // println!("🏃 Orchestrator Running (Portfolio Mode) for {} months...", self.months);
        let iterations = self.universes.len();
        
        for month_idx in 1..=self.months {
            // if month_idx % 12 == 0 { println!("... processing month {}", month_idx); }

            // A. Step Monte Carlo Universes (Horizontal Pooling ON, Reaper ON)
            for universe in self.universes.iter_mut() {
                Self::step_universe(universe, month_idx, true, true);
            }

            // B. Step Deterministic Universe (Horizontal Pooling ON, Reaper ON)
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true);
        }

        // println!("✅ Simulation Loop Complete. Aggregating...");

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data)
    }
}

impl FundOrchestrator<EnsembleMode> {
    pub fn run(mut self) -> SimulationResult {
        // println!("🏃 Orchestrator Running (Ensemble Mode) for {} months...", self.months);
        let iterations = self.universes.len();
        
        for month_idx in 1..=self.months {
            // if month_idx % 12 == 0 { println!("... processing month {}", month_idx); }

            let mut total_pot = 0.0;
            let mut solvent_universes_indices = Vec::new();

            // A. Step Monte Carlo Universes (Horizontal Pooling OFF, Reaper OFF)
            for (i, universe) in self.universes.iter_mut().enumerate() {
                let pot = Self::step_universe(universe, month_idx, false, false);
                total_pot += pot;

                // Check if universe is "alive" (has at least one solvent company)
                if universe.companies.iter().any(|c| c.is_solvent) {
                    solvent_universes_indices.push(i);
                }
            }

            // B. Vertical Pooling Logic
            let solvent_count = solvent_universes_indices.len();
            if solvent_count > 0 && total_pot > 0.0 {
                let share = total_pot / solvent_count as f64;

                for idx in solvent_universes_indices {
                    let universe = &mut self.universes[idx];
                    
                    // Distribute share to this universe's solvent companies
                    let universe_solvent_companies = universe.companies.iter().filter(|c| c.is_solvent).count();
                    
                    if universe_solvent_companies > 0 {
                        let company_share = share / universe_solvent_companies as f64;
                        
                        for company in universe.companies.iter_mut() {
                            if company.is_solvent {
                                company.current_cash += company_share;
                                company.cum_pool_received += company_share;
                                
                                // Update History for this month
                                if let Some(last_entry) = company.history.last_mut() {
                                    last_entry.cash_balance = Decimal::from_f64_retain(company.current_cash).unwrap_or_default();
                                    last_entry.cumulative_pool_received = Decimal::from_f64_retain(company.cum_pool_received).unwrap_or_default();
                                    last_entry.total_value = last_entry.cash_balance + last_entry.cumulative_dividends;
                                }
                            }
                        }
                    }
                }
            }

            // C. Run Reaper (Delayed Death)
            for universe in self.universes.iter_mut() {
                Self::run_reaper(universe);
            }

            // D. Step Deterministic Universe (Standard Mode)
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true);
        }

        // println!("✅ Simulation Loop Complete. Aggregating...");

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data)
    }
}
</file>

