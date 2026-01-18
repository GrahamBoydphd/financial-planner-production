# STRATEGIST: Tactical Mission Orders

=== STRATEGIST: REVISED TACTICS (STAGE 4) ===

**The Core Shift:** We are moving from `Vector<CompanyPath>` (independent trajectories) to `Vector<FundPath>`.

- **Old Engine:** Run Company A Scenario X (t=0→t=End). 
    
- **New Engine (The "Lockstep" Loop):** For each Month t:
    
    1. Advance Company A Scenario X, B Scenario Y, ... N Scenario Z by one step (calculate raw cashflow).
        
    2. **The Interceptor:** Calculate Total Fund Surplus/Deficit.
        
    3. **The Redistributor:** Move cash from Profitable Companies to Struggling Companies (Pooling Logic).
        
    4. Finalize Month t balances.
        

This requires a fundamental rewrite of the inner simulation loop.

---

### PROMPT 1: For the Backend Architect

**ACT AS:** Backend Architect (Rust, Domain Modeling). **REPORT TO:** Lead Strategist. 

**PROJECT CONTEXT:** Stage 4: Investor Track. We are implementing **Multi-Company Monte Carlo with Vertical Pooling**.

**YOUR MISSION:** You must implement the `FundSimulation` engine. This is a "Meta-Simulation" that coordinates multiple companies stepping through time together.

**TECHNICAL SPECIFICATIONS:**

**1. The Data Structure (`domain/fund.rs`)**

- **Fund:** Contains a list of `CompanyConfig` objects.
    
- **PoolingConfig:** Parameters defining _how_ money is pooled (e.g., "Cover 100% of burn if Fund Balance > X").
    

**2. The Simulation Logic (`engine/waterfall.rs`)**

- **Constraint:** You cannot run companies in isolation. They must run in **Lockstep**.
    
- **The Loop:**
    
    Rust
    
    ```
    // Psuedocode for one MC Path
    for month in 0..months {
        let mut fund_pool = 0.0;
        let mut company_states = vec![];
    
        // Step 1: Calculate Raw Performance
        for company in companies {
            let cashflow = company.step(month); // Standard stochastic step
            fund_pool += cashflow;
            company_states.push(cashflow);
        }
    
        // Step 2: The Pooling Logic (The "Correction")
        // If FundPool is positive, distribute to companies with negative cashflow?
        // If FundPool is negative, who breaks first?
        distribute_pool(&mut fund_pool, &mut company_states);
    }
    ```
    
- **Output:** The simulation must return a `FundTrajectory` struct, aggregating the Net Asset Value (NAV) and individual company survivability over time.
    

**3. API Layer**

- `POST /simulate/fund`:
    
    - Input: `fund_id` (fetches all attached companies).
        
    - Output: Aggregated Monte Carlo results (e.g., "Probability of Fund Return > 3x").
        

**DELIVERABLES:**

1. **The Lockstep Engine:** The Rust code implementing the loop described above.
    
2. **The Pooling Logic:** A simple "Pro-Rata Burn Coverage" algorithm (e.g., successful companies cover the burn of failing ones up to the limit of free cash flow).
    
3. **Refactor Note:** Ensure the existing `Company` struct exposes a `step()` method that can be called incrementally (stateful), rather than just `run_all()`.
    

**Execute.**

---

### PROMPT 2: For the Frontend Architect

**ACT AS:** Frontend Architect (React, Recharts). **REPORT TO:** Lead Strategist. 

**PROJECT CONTEXT:** Stage 4: Investor Track. We are visualizing the **Aggregated Fund Performance**.

**YOUR MISSION:** The user needs to understand not just how _one_ company does, but how the _Portfolio_ performs when companies use a profit pooling mechanism each time step.

**Overarching requirement:** this app will eventually be full production code with sensitive data for different users. Build accordingly. For example we choose strictness for the database.
* Always check before an action that may relax security. 
* Always examine existing files to check if a change might compromise existing functionality or security.

=== **TECHNICAL SPECIFICATIONS:** ===

**1. The "Fund Dashboard" (`/fund/:id`)**

- **Concept:** This is the control room.
    
- **Top Metric:** "Fund Survival Rate" (The % of Monte Carlo runs where the Fund returns positive ROI).
    
- **The List:** A table of Companies in the Fund.
    
    - Columns: Name, Starting Capital, **Pooled Contribution** (Calculated field).
        

**2. The "Aggregate Graph" (Visualizing Pooling)**

- We need a new Chart: **"Fund Consolidated Cashflow"**.
    
- **X-Axis:** Time (Months).
    
- **Lines:**
    
    - Line A (Grey): Sum of Cashflows _without_ pooling (Hypothetical).
        
    - Line B (Green): Sum of Cashflows _with_ pooling (Actual).
        
    - _Insight:_ The user should see how pooling smooths out the volatility (the "Ergodic" effect).
        

**3. The Interaction**

- **Button:** "Run Fund Simulation".
    
- **State:** This triggers the heavy calculation on the backend. Show a progress bar or "Simulating Fund Scenario..." loader.
    

**DELIVERABLES:**

1. **UI Component:** `FundSimulationView.tsx`.
    
2. **Chart Design:** A Recharts composition showing the "Pooled vs. Unpooled" comparison.
    
3. **Data Fetching:** handling the POST request to the new `simulate/fund` endpoint.
    

**Execute.**




# Old stage 3 
**Current Phase:** Company Stage 3 - Cloud Implementation (User Layer)
**Objective:** Implement the "Identity & Isolation" layer.
**Critical Context:** This layer to support *both* Companies and Investors in the future.

---

## 1. Immediate Goals (The MVP)
We are building the **Foundation** for the 3-Tier hierarchy.

* **Story 3.1: Anonymous Registration**
    * User registers with `username` + `password` ONLY. (No Email).
    * *Backend:* Creates a `User` and a linked `Tenant` (Self-Tenancy) in one transaction.
* **Story 3.2: The Security Wall**
    * Every resource (Funds, Companies) must have a `tenant_id` column.
    * **CRITICAL:** API Handlers must strictly enforce `WHERE tenant_id = $1` using the claim from the JWT.
* **Story 3.3: The Smart Client**
    * Frontend automatically attaches `Authorization: Bearer` to requests.

### 📝 Clarified Strategic Directive: Identity & Communication

**1. Identity Philosophy**

- **Primary Identifier:** The `username` is the absolute anchor for user identity and login. It defines the user's handle within the simulation engine.
    
- **Communication Channel:** The `email` is a **mandatory attribute** for the purpose of system notifications, billing, and account recovery. It is _not_ the primary login credential, but it must be collected.
    

**2. User Experience (Auth Flow)**

Routes: /login and /register.

- **Registration Form:**
    
    - **Fields:** `Username`, **`Email`**, `Password`, `Confirm Password`.
        
    - **Validation:** Username must be unique. Email must be valid format. Passwords must match.
        
- **Login Form:**
    
    - **Fields:** `Username` and `Password`. (Email is not used for login).

Error Handling: Display clear error messages from the backend (e.g., "Username already taken").


## 2. Strategic Constraints for the Architect

### A. Data Model (Future-Proofing for Investor Track)
*The Architect must build for Stage 4 (Portfolio Wrapper) compatibility.*

* **Generic Tenancy:** The `tenants` table must be agnostic (Company OR Fund).
* **The "Pooling" Hook:**
    * While Stage 3 demands strict isolation *between* Tenants, Stage 4 will require data flow *within* a Tenant (e.g., between Portfolio Companies in a Fund).
    * *Constraint:* Ensure the schema allows multiple "Company" resources to belong to a single "Tenant" (Fund) ID later.

### B. Implementation Rules (From Autopsy)
* **Identity:** `email` field is **BANNED**. Remove it from Structs and DB.
* **IDs:** All IDs are `UUID`. No Integers.
* **Variables:**
    * Use `tenant_id` to refer to the *Data Owner*.
    * Use `user_id` to refer to the *Actor*.

### C. The "Clean Break"
* **Legacy Code:** The `system_legacy` migration was a temporary bridge.
* **Instruction:** We are now moving to **Strict Auth**.

## 3. Definition of Done
1.  [ ] Database migration creates `users` and `tenants` tables (linked).
2.  [ ] Registration flow works with Username only.
3.  [ ] A user sees *only* their own Funds/Companies (verified by SQL check).
