use crate::engine::domain::{Universe, SimState, Shock};
use crate::engine::event_manager::EventManager;
use crate::models::Event;
use crate::projection::{SimulationResult, MonthlyData};
use crate::distributions::VolatilityModel;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use std::cmp::Ordering;
use std::marker::PhantomData;
use uuid::Uuid;

pub trait SimulationMode {}
pub struct PortfolioMode;
impl SimulationMode for PortfolioMode {}
pub struct EnsembleMode;
impl SimulationMode for EnsembleMode {}

pub struct FundOrchestrator<Mode: SimulationMode> {
    pub universes: Vec<Universe>,
    pub deterministic_universe: Universe,
    pub months: i32,
    pub events: Vec<Event>,
    pub event_manager: EventManager,
    pub events_active: bool,
    _marker: PhantomData<Mode>,
}

impl<Mode: SimulationMode> FundOrchestrator<Mode> {
    pub fn new(iterations: usize, initial_states: Vec<SimState>, months: i32, stop_insolvency: bool, events_active: bool, events: Vec<Event>) -> Self {
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
            events,
            event_manager: EventManager::new(),
            events_active,
            _marker: PhantomData 
        }
    }

    /// Steps a universe forward by one month.
    /// Returns the total "pool pot" collected from this universe (if any).
    /// 
    /// - `enable_horizontal_pooling`: If true, distributes the pot within the universe immediately.
    /// - `apply_reaper`: If true, checks for insolvency and marks companies as dead if cash < 0.
    /// - `shocks`: List of active shocks to apply to companies in this step.
    fn step_universe(universe: &mut Universe, month_idx: i32, enable_horizontal_pooling: bool, apply_reaper: bool, shocks: &[Shock]) -> f64 {
        let mut pool_pot = 0.0;
        let mut solvent_count = 0;

        // TICK: Step all companies and collect pool contributions
        for company in universe.companies.iter_mut() {
            // Filter shocks relevant to this company
            let company_shocks: Vec<Shock> = shocks.iter()
                .filter(|s| s.target_company_id == Some(company.id) || s.target_company_id.is_none())
                .cloned()
                .collect();

            let (_, actual_contribution) = company.step(month_idx, &company_shocks);

            if company.is_solvent {
                solvent_count += 1;
                pool_pot += actual_contribution;
            }
        }

        // TOCK: Distribute pool to solvent companies (Horizontal Pooling)
        if enable_horizontal_pooling {
            if solvent_count > 0 && pool_pot > 0.0 {
                let share = pool_pot / solvent_count as f64;

                for company in universe.companies.iter_mut() {
                    if company.is_solvent {
                        // Update Company State
                        company.current_cash += share;
                        company.cum_pool_received += share;

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
            // Calculate effective floor based on credit facility
            let credit_limit = company.credit_facility.as_ref().map(|c| c.facility_limit).unwrap_or(0.0);
            let effective_floor = company.insolvency_threshold - credit_limit;

            if company.stop_on_insolvency && company.current_cash < effective_floor {
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
            let mut total_treasury = 0.0;
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
                    total_treasury += data.treasury_gain.to_f64().unwrap_or(0.0);
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
                treasury_gain: Decimal::from_f64_retain(total_treasury).unwrap_or_default(),
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

    fn finalize_results(self, fund_trajectories: Vec<Vec<MonthlyData>>, deterministic_data: Vec<MonthlyData>, total_events_triggered: usize) -> SimulationResult {
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

                // Sort snapshots by Cash Balance (instead of Total Value)
                snapshots.sort_by(|a, b| a.cash_balance.cmp(&b.cash_balance));
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

                    // Push Values (Cash Balance)
                    p0_vec.push(p0.cash_balance);
                    p10_vec.push(p10.cash_balance);
                    p25_vec.push(p25.cash_balance);
                    p50_vec.push(p50.cash_balance);
                    p75_vec.push(p75.cash_balance);
                    p90_vec.push(p90.cash_balance);
                    p100_vec.push(p100.cash_balance);

                    // Push Solvent Counts
                    p0_count.push(p0.solvent_companies);
                    p10_count.push(p10.solvent_companies);
                    p25_count.push(p25.solvent_companies);
                    p50_count.push(p50.solvent_companies);
                    p75_count.push(p75.solvent_companies);
                    p90_count.push(p90.solvent_companies);
                    p100_count.push(p100.solvent_companies);

                    // P50 Data (Full Snapshot - Median Cash)
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

        let average_event_count = if iterations > 0 {
            Some(total_events_triggered as f64 / iterations as f64)
        } else {
            Some(0.0)
        };

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
            average_event_count,
        }
    }
}

impl FundOrchestrator<PortfolioMode> {
    pub fn run(mut self) -> SimulationResult {
        let iterations = self.universes.len();
        let mut total_events_triggered = 0;
        
        for month_idx in 1..=self.months {
            // A. Step Monte Carlo Universes (Horizontal Pooling ON, Reaper ON)
            for universe in self.universes.iter_mut() {
                // 1. Generate stochastic shocks for this universe
                let mut monthly_shocks = Vec::new();
                for event in &self.events {
                    // Skip deterministic events (handled elsewhere)
                    if event.start_month.is_some() { continue; }

                    if self.events_active && self.event_manager.check_trigger(event) {
                        total_events_triggered += 1;
                        
                        let is_counter_cyclic = event.is_counter_cyclic.unwrap_or(false);
                        
                        // Identify targets
                        let targets: Vec<Uuid> = if !event.fund_ids.as_deref().unwrap_or(&[]).is_empty() {
                            // Fund Scope: Target all companies
                            universe.companies.iter().map(|c| c.id).collect()
                        } else {
                            // Company Scope: Target specific companies
                            event.company_ids.clone().unwrap_or_default()
                        };

                        if is_counter_cyclic {
                            // Counter-Cyclic: Independent shocks per company
                            for target_id in targets {
                                let (value, duration) = self.event_manager.resolve_impact(event);
                                monthly_shocks.push(Shock {
                                    name: event.event_name.clone(),
                                    month: month_idx,
                                    impact_type: event.impact_type.clone().unwrap_or_else(|| "expense".to_string()),
                                    impact_value: value,
                                    duration_months: Some(duration),
                                    target_company_id: Some(target_id),
                                });
                            }
                        } else {
                            // Standard: Correlated shock (Same impact for all)
                            let (value, duration) = self.event_manager.resolve_impact(event);
                            for target_id in targets {
                                monthly_shocks.push(Shock {
                                    name: event.event_name.clone(),
                                    month: month_idx,
                                    impact_type: event.impact_type.clone().unwrap_or_else(|| "expense".to_string()),
                                    impact_value: value,
                                    duration_months: Some(duration),
                                    target_company_id: Some(target_id),
                                });
                            }
                        }
                    }
                }

                // 2. Step universe with shocks
                Self::step_universe(universe, month_idx, true, true, &monthly_shocks);
            }

            // B. Step Deterministic Universe (Horizontal Pooling ON, Reaper ON)
            // No stochastic shocks for deterministic run
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true, &[]);
        }

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data, total_events_triggered)
    }
}

impl FundOrchestrator<EnsembleMode> {
    pub fn run(mut self) -> SimulationResult {
        let iterations = self.universes.len();
        let mut total_events_triggered = 0;
        
        for month_idx in 1..=self.months {
            let mut total_pot = 0.0;
            let mut solvent_universes_indices = Vec::new();

            // A. Step Monte Carlo Universes (Horizontal Pooling OFF, Reaper OFF)
            for (i, universe) in self.universes.iter_mut().enumerate() {
                // 1. Generate stochastic shocks for this universe
                let mut monthly_shocks = Vec::new();
                for event in &self.events {
                    if event.start_month.is_some() { continue; }

                    if self.events_active && self.event_manager.check_trigger(event) {
                        total_events_triggered += 1;

                        let is_counter_cyclic = event.is_counter_cyclic.unwrap_or(false);

                        let targets: Vec<Uuid> = if !event.fund_ids.as_deref().unwrap_or(&[]).is_empty() {
                            universe.companies.iter().map(|c| c.id).collect()
                        } else {
                            event.company_ids.clone().unwrap_or_default()
                        };

                        if is_counter_cyclic {
                            // Counter-Cyclic: Independent shocks per company
                            for target_id in targets {
                                let (value, duration) = self.event_manager.resolve_impact(event);
                                monthly_shocks.push(Shock {
                                    name: event.event_name.clone(),
                                    month: month_idx,
                                    impact_type: event.impact_type.clone().unwrap_or_else(|| "expense".to_string()),
                                    impact_value: value,
                                    duration_months: Some(duration),
                                    target_company_id: Some(target_id),
                                });
                            }
                        } else {
                            // Standard: Correlated shock
                            let (value, duration) = self.event_manager.resolve_impact(event);
                            for target_id in targets {
                                monthly_shocks.push(Shock {
                                    name: event.event_name.clone(),
                                    month: month_idx,
                                    impact_type: event.impact_type.clone().unwrap_or_else(|| "expense".to_string()),
                                    impact_value: value,
                                    duration_months: Some(duration),
                                    target_company_id: Some(target_id),
                                });
                            }
                        }
                    }
                }

                // 2. Step universe with shocks
                let pot = Self::step_universe(universe, month_idx, false, false, &monthly_shocks);
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
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true, &[]);
        }

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data, total_events_triggered)
    }
}
