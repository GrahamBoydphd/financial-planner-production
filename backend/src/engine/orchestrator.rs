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
use rayon::prelude::*;

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
    pub fn new(
        iterations: usize, 
        mut initial_states: Vec<SimState>, 
        months: i32, 
        stop_insolvency: bool, 
        events_active: bool, 
        events: Vec<Event>,
        pooling_override: Option<Decimal> // NEW: Override pooling fraction for all companies
    ) -> Self {
        
        // Apply pooling override if provided (Ergodicity Correction)
        if let Some(rate) = pooling_override {
            let rate_f64 = rate.to_f64().unwrap_or(0.0);
            for state in initial_states.iter_mut() {
                state.pooling_fraction = rate_f64;
            }
        }

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
                            last_entry.pool_received = Decimal::from_f64_retain(share).unwrap_or_default();
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
            let mut total_cogs = 0.0;
            let mut total_gross_profit = 0.0;
            let mut total_opex = 0.0;
            let mut total_interest = 0.0;
            let mut total_net_income = 0.0;
            let mut total_treasury = 0.0;
            let mut total_cash = 0.0;
            let mut total_value = 0.0;
            let mut total_pool_received = 0.0;
            let mut sum_investment = 0.0;
            let mut solvent_companies = 0;
            
            let mut total_pool_contribution = 0.0;
            let mut total_pool_received_month = 0.0;
            let mut total_contributing_companies = 0;
            let mut total_exposure_sum = 0.0;

            for company in &universe.companies {
                // Safety: Ensure we don't panic if history is missing
                if let Some(data) = company.history.get(month_idx) {
                    total_revenue += data.revenue.to_f64().unwrap_or(0.0);
                    total_cogs += data.cogs.to_f64().unwrap_or(0.0);
                    total_gross_profit += data.gross_profit.to_f64().unwrap_or(0.0);
                    total_opex += data.opex.to_f64().unwrap_or(0.0);
                    total_interest += data.interest_expense.to_f64().unwrap_or(0.0);
                    total_net_income += data.net_income.to_f64().unwrap_or(0.0);
                    total_treasury += data.treasury_gain.to_f64().unwrap_or(0.0);
                    total_cash += data.cash_balance.to_f64().unwrap_or(0.0);
                    total_value += data.total_value.to_f64().unwrap_or(0.0);
                    total_pool_received += data.cumulative_pool_received.to_f64().unwrap_or(0.0);
                    sum_investment += data.cumulative_external_capital.to_f64().unwrap_or(0.0);
                    
                    total_pool_contribution += data.pool_contribution.to_f64().unwrap_or(0.0);
                    total_pool_received_month += data.pool_received.to_f64().unwrap_or(0.0);
                    total_contributing_companies += data.contributing_companies;
                    total_exposure_sum += data.total_exposure.to_f64().unwrap_or(0.0);
                    
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
                cogs: Decimal::from_f64_retain(total_cogs).unwrap_or_default(),
                gross_profit: Decimal::from_f64_retain(total_gross_profit).unwrap_or_default(),
                opex: Decimal::from_f64_retain(total_opex).unwrap_or_default(),
                interest_expense: Decimal::from_f64_retain(total_interest).unwrap_or_default(),
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
                pool_contribution: Decimal::from_f64_retain(total_pool_contribution).unwrap_or_default(),
                pool_received: Decimal::from_f64_retain(total_pool_received_month).unwrap_or_default(),
                contributing_companies: total_contributing_companies,
                total_exposure: Decimal::from_f64_retain(total_exposure_sum).unwrap_or_default(),
            });
        }
        universe_history
    }

    fn finalize_results(self, fund_trajectories: Vec<Vec<MonthlyData>>, deterministic_data: Vec<MonthlyData>, total_events_triggered: usize, sort_by_total_value: bool) -> SimulationResult {
        let iterations = fund_trajectories.len();
        
        // Generate Labels
        let mut labels = Vec::new();
        for m in 0..=self.months {
            labels.push(format!("Month {}", m));
        }

        let cap = (self.months + 1) as usize;

        // Parallel aggregation of monthly statistics
        // Returns a vector of tuples: (p_values array, solvent_counts array, survival_rate)
        let monthly_results: Vec<([Decimal; 7], [i32; 7], Decimal)> = (0..cap)
            .into_par_iter()
            .map(|m_idx| {
                let mut snapshots: Vec<&MonthlyData> = Vec::with_capacity(iterations);
                let mut solvent_universes = 0;

                if !fund_trajectories.is_empty() {
                    for run in &fund_trajectories {
                        if let Some(data) = run.get(m_idx) {
                            snapshots.push(data);
                            
                            if data.is_solvent {
                                solvent_universes += 1;
                            }
                        }
                    }
                }

                // Sort snapshots by Target Metric
                snapshots.sort_by(|a, b| if sort_by_total_value {
                    a.total_value.cmp(&b.total_value)
                } else {
                    a.cash_balance.cmp(&b.cash_balance)
                });
                
                let len = snapshots.len();
                let mut p_vals = [Decimal::ZERO; 7];
                let mut c_vals = [0; 7];

                if len > 0 {
                    // Helper to pick exact index
                    let get_idx = |pct: f64| -> usize {
                        let idx = (len as f64 * pct).floor() as usize;
                        if idx >= len { len - 1 } else { idx }
                    };

                    let targets = [
                        snapshots[0],                   // P0
                        snapshots[get_idx(0.10)],       // P10
                        snapshots[get_idx(0.25)],       // P25
                        snapshots[get_idx(0.50)],       // P50
                        snapshots[get_idx(0.75)],       // P75
                        snapshots[get_idx(0.90)],       // P90
                        snapshots[len - 1]              // P100
                    ];

                    for (i, data) in targets.iter().enumerate() {
                        p_vals[i] = if sort_by_total_value { data.total_value } else { data.cash_balance };
                        c_vals[i] = data.solvent_companies;
                    }
                }

                let rate = if iterations > 0 {
                    solvent_universes as f64 / iterations as f64
                } else {
                    0.0
                };
                
                (p_vals, c_vals, Decimal::from_f64_retain(rate).unwrap_or_default())
            })
            .collect();

        // Unzip results into column vectors
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

        for (p, c, s) in monthly_results {
            p0_vec.push(p[0]);
            p10_vec.push(p[1]);
            p25_vec.push(p[2]);
            p50_vec.push(p[3]);
            p75_vec.push(p[4]);
            p90_vec.push(p[5]);
            p100_vec.push(p[6]);

            p0_count.push(c[0]);
            p10_count.push(c[1]);
            p25_count.push(c[2]);
            p50_count.push(c[3]);
            p75_count.push(c[4]);
            p90_count.push(c[5]);
            p100_count.push(c[6]);

            survival_vec.push(s);
        }

        // LOGIC B: Pathwise Data Object (p50_data)
        // Find the median run based on the FINAL month's Metric
        let mut p50_data_path = Vec::new();
        let mut single_run_data = None;
        let mut single_run_value = None;

        if !fund_trajectories.is_empty() {
            // Create a list of (index, final_val)
            let mut final_values: Vec<(usize, Decimal)> = fund_trajectories.iter().enumerate().map(|(i, run)| {
                let final_val = run.last().map(|m| if sort_by_total_value { m.total_value } else { m.cash_balance }).unwrap_or(Decimal::ZERO);
                (i, final_val)
            }).collect();

            // Sort by final value
            final_values.sort_by(|a, b| a.1.cmp(&b.1));

            // Pick median index
            let median_pos = (final_values.len() as f64 * 0.50).floor() as usize;
            let median_idx = final_values.get(median_pos).map(|x| x.0).unwrap_or(0);

            // Clone that path
            if let Some(run) = fund_trajectories.get(median_idx) {
                p50_data_path = run.clone();
                single_run_data = Some(run.clone());
                single_run_value = Some(run.iter().map(|m| m.total_value).collect());
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
            p50_data: Some(p50_data_path),
            survival_rate: Some(survival_vec),
            deterministic_runway: None,
            deterministic_valuation: Decimal::ZERO,
            single_run_runway: None,
            single_run_valuation: None,
            p50_runway: None,
            p50_valuation: None,
            all_paths: Some(fund_trajectories),
            average_event_count,
            errors: None,
        }
    }
}

impl FundOrchestrator<PortfolioMode> {
    pub fn run(mut self) -> SimulationResult {
        let iterations = self.universes.len();
        let mut total_events_triggered = 0;
        
        // Extract read-only references to allow concurrent mutable borrow of universes
        let events = &self.events;
        let event_manager = &self.event_manager;
        let events_active = self.events_active;

        for month_idx in 1..=self.months {
            // A. Step Monte Carlo Universes (Horizontal Pooling ON, Reaper ON)
            // Parallel execution using Rayon
            let monthly_events_count: usize = self.universes.par_iter_mut()
                .map(|universe| {
                    let mut local_triggered = 0;
                    // 1. Generate stochastic shocks for this universe
                    let mut monthly_shocks = Vec::new();
                    for event in events {
                        // Skip deterministic events (handled elsewhere)
                        if event.start_month.is_some() { continue; }

                        if events_active && event_manager.check_trigger(event) {
                            local_triggered += 1;
                            
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
                                    let (value, duration) = event_manager.resolve_impact(event);
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
                                let (value, duration) = event_manager.resolve_impact(event);
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
                    
                    local_triggered
                })
                .sum();

            total_events_triggered += monthly_events_count;

            // B. Step Deterministic Universe (Horizontal Pooling ON, Reaper ON)
            // No stochastic shocks for deterministic run
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true, &[]);
        }

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        
        // Parallelize aggregation of universe history
        let fund_trajectories: Vec<_> = self.universes.par_iter()
            .map(|universe| Self::aggregate_universe_history(universe, self.months))
            .collect();

        // PortfolioMode -> Sort by Total Value (true)
        self.finalize_results(fund_trajectories, deterministic_data, total_events_triggered, true)
    }
}

impl FundOrchestrator<EnsembleMode> {
    pub fn run(mut self) -> SimulationResult {
        let iterations = self.universes.len();
        let mut total_events_triggered = 0;
        
        // Extract read-only references for Rayon
        let events = &self.events;
        let event_manager = &self.event_manager;
        let events_active = self.events_active;

        for month_idx in 1..=self.months {
            // PHASE A: Step Universes (Parallel)
            // Returns (pot, is_solvent, events_triggered)
            let results: Vec<(f64, bool, usize)> = self.universes.par_iter_mut()
                .map(|universe| {
                    let mut local_events_triggered = 0;
                    
                    // 1. Generate stochastic shocks
                    let mut monthly_shocks = Vec::new();
                    for event in events {
                        if event.start_month.is_some() { continue; }

                        if events_active && event_manager.check_trigger(event) {
                            local_events_triggered += 1;

                            let is_counter_cyclic = event.is_counter_cyclic.unwrap_or(false);
                            
                            let targets: Vec<Uuid> = if !event.fund_ids.as_deref().unwrap_or(&[]).is_empty() {
                                universe.companies.iter().map(|c| c.id).collect()
                            } else {
                                event.company_ids.clone().unwrap_or_default()
                            };

                            if is_counter_cyclic {
                                for target_id in targets {
                                    let (value, duration) = event_manager.resolve_impact(event);
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
                                let (value, duration) = event_manager.resolve_impact(event);
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

                    // 2. Step universe (No Horizontal Pooling locally, No Reaper yet)
                    let pot = Self::step_universe(universe, month_idx, false, false, &monthly_shocks);
                    
                    let is_alive = universe.companies.iter().any(|c| c.is_solvent);
                    
                    (pot, is_alive, local_events_triggered)
                })
                .collect();

            // Aggregation
            let mut total_pot = 0.0;
            let mut solvent_count = 0;
            
            for (pot, is_alive, triggered) in results {
                total_pot += pot;
                if is_alive {
                    solvent_count += 1;
                }
                total_events_triggered += triggered;
            }

            // PHASE B: Vertical Pooling (Parallel)
            if solvent_count > 0 && total_pot > 0.0 {
                let share = total_pot / solvent_count as f64;

                self.universes.par_iter_mut().for_each(|universe| {
                    let universe_solvent_companies_count = universe.companies.iter().filter(|c| c.is_solvent).count();
                    
                    if universe_solvent_companies_count > 0 {
                        let company_share = share / universe_solvent_companies_count as f64;
                        
                        for company in universe.companies.iter_mut() {
                            if company.is_solvent {
                                company.current_cash += company_share;
                                company.cum_pool_received += company_share;
                                
                                // Update History for this month
                                if let Some(last_entry) = company.history.last_mut() {
                                    last_entry.cash_balance = Decimal::from_f64_retain(company.current_cash).unwrap_or_default();
                                    last_entry.cumulative_pool_received = Decimal::from_f64_retain(company.cum_pool_received).unwrap_or_default();
                                    last_entry.total_value = last_entry.cash_balance + last_entry.cumulative_dividends;
                                    last_entry.pool_received = Decimal::from_f64_retain(company_share).unwrap_or_default();
                                }
                            }
                        }
                    }
                });
            }

            // PHASE C: Reaper (Parallel)
            self.universes.par_iter_mut().for_each(|universe| {
                Self::run_reaper(universe);
            });

            // PHASE D: Deterministic
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true, &[]);
        }

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        
        // Parallelize aggregation of universe history
        let fund_trajectories: Vec<_> = self.universes.par_iter()
            .map(|universe| Self::aggregate_universe_history(universe, self.months))
            .collect();

        // EnsembleMode -> Sort by Cash Balance (false)
        self.finalize_results(fund_trajectories, deterministic_data, total_events_triggered, false)
    }
}
