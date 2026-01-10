
Anchoring the "Strategic Context" is exactly what prevents the "one step forward, two steps back" cycle.

Based on the entire conversation history with Architect 1, here is the **Strategic Purpose & Vision** for the Jules-BP project the Architect has seen. This captures not just _what_ we are building, but _why_ and _where_ it is going.

### 1. The North Star: "The Non-Ergodic Truth"

**The Core Problem:** Traditional financial planning (Excel, standard SaaS) relies on "average of averages" (Ensemble Averages). This hides the reality of **Ruin**, creating a false sense of security for startups. **The Solution:** Build a simulation engine that models **Time Averages** (Path Dependence). **The USP:** To show founders and investors the _real_ probability of survival by mathematically accounting for non-ergodic factors like volatility drag, not just pretending everything is ergodic. We are not building a calculator; we are building a "Wind Tunnel" for financial stress testing.

### 2. The Commercial Destination: Enterprise Hierarchies

While the MVP is a "Single User" tool, the architecture is being laid for a complex B2B SaaS reality.

- **Current State:** User = Tenant (Simple 1:1).
    
- **Strategic Goal:** A 3-Tier Hierarchy:
    
    1. **Tenant ( The "Payer"):** The Investment Fund or Holding Company.
        
    2. **Department (The "Cost Center"):** The Portfolio Company or Business Unit.
        
    3. **User (The "Actor"):** The Analyst or Founder logging in with a Username.
        
- **Implication:** Our `tenant_id` strategy in the database is designed to eventually support strictly siloed workspaces where a Fund Manager can see all their companies, but a Company Founder sees only their own plan.
    

### 3. The Technical Standard: "Correctness over Convenience"

We have consistently chosen rigid engineering constraints to ensure the simulation is trustworthy.

- **No Floats:** We rejected standard floating-point math for `rust_decimal` to prevent cumulative rounding errors in 10-year simulations.
    
- **Rust Backend:** We chose Rust not just for speed, but for type safety—ensuring that a "Fund ID" can never be accidentally used as a "Company ID".
    
- **Frozen Math Core:** We deliberately isolated the simulation logic (`projection.rs`) from the web logic to ensure that authentication changes or UI updates never silently alter the financial results.
    

### 4. The Operational Philosophy: "Immutable Stability"

We pivoted from a "Hobbyist" workflow (editing files on the server) to an "Industrial" workflow.

- **The Rule:** The Production Server is treated as **Read-Only**.
    
- **The Flow:** We only deploy immutable Docker containers. If a config needs changing, we change it in the repo, build a new container, and replace the old one.
    
- **Why:** To guarantee that the financial model running on the server is _exactly_ the same code we tested on the laptop, eliminating "it works on my machine" risks.
    

### Summary Statement

> **Jules-BP is an enterprise-grade financial simulation platform designed to reveal the non-ergodic risks of startup growth. It prioritizes mathematical correctness and multi-tenant security over development speed, aiming to evolve from a founder's tool into a portfolio management solution for investment funds.**


# Part 2
Here is a summary of the **Key Strategic Decisions & Pivots** mined from the conversation history with the first Architect, categorized to improve the "Toplevel Strategy". 

### 1. The "Identity & Hierarchy" Pivot

- **Initial Tactic:** "Users are Tenants." (Simple 1:1 mapping).
    
- **Strategic Decision:** We explicitly moved **away from Email** as the primary key and **to Username** (`jules_01`).
    
- **Why:** This prepares for the future multi-tier hierarchy you mentioned (Tenant > Department > User). A "Username" acts as a workspace identifier (like a GitHub handle), whereas an Email is just a person.
    
- **Constraint:** The Backend `LoginRequest` was refactored to reject `email` and strictly demand `username`.
    

### 2. The "Immutable Infrastructure" Pivot

- **Initial Habit:** Editing production files on the server (`nano .env`, `git pull`) and development files on the laptop.
    
- **Strategic Decision:** **Server is Read-Only.** We shifted to a "Push-Only" workflow: `deploy.sh` (Build Local) $\rightarrow$ `trigger-update.sh` (Pull Remote).
    
- **Why:** We discovered that "Hotfixing" caused git conflicts and environment drift (e.g., the `NEXT_PUBLIC_API_URL` build-time trap).
    
- **Constraint:** Direct edits on the server are forbidden.
    

### 3. The "Root Routing" Standard

- **Initial Confusion:** `NEXT_PUBLIC_API_URL` sometimes included `/api`, sometimes didn't. This caused the infamous "Double API" bug (`/api/api/funds`) and "Double /" (//) bug.
    
- **Strategic Decision:** **The Base is Root.**
    
    - Client Config: `NEXT_PUBLIC_API_URL` = `http://localhost:8000` (No path).
        
    - Client Code: `auth-client.ts` points to Root. `api.ts` manually adds `/api`.
        
- **Why:** This allows the Frontend to be served from the same domain as the API in production (via Caddy) without complex prefix logic.
    

### 4. The "Frozen Core" (Financial Math)

- **Observation:** We nearly broke the simulation logic while adding Auth.
    
- **Strategic Decision:** **Math is Sacred.** The modules `projection.rs` and `distributions.rs` are strictly **FROZEN**.
    
- **Why:** These contain the non-ergodic volatility logic (the project's USP). Auth middleware wraps _around_ them but must never touch the calculation internals.
    
- **Constraint:** No "Any" types in TypeScript for financial data; strict `rust_decimal` in Rust.
    

### 5. The "Custom Auth" Choice

- **Alternative:** We considered (or implied) using standard libraries or external providers.
    
- **Strategic Decision:** **Custom Stateless JWT.** We built our own `handlers/auth.rs` using `argon2` and `jsonwebtoken`.
    
- **Why:** To maintain absolute control over the `tenant_id` injection into the Token Claims, ensuring our "Strict Isolation" rule (all queries must filter by `tenant_id`) is cryptographically enforced.
    

### 6. The "Hidden" Technical Debt (To Be Fixed)

- **Strategic Concession:** To keep the MVP running during the transition, we hardcoded `tenant_id = 'system_legacy'` in the database migrations.
    
- **Why:** This allowed the Single-User simulation to function without a login.
    
- **Future Requirement:** This _must_ be removed once the Multi-User layer is live, or security will be compromised.
    

### Summary for your Gem

> **Project DNA:**
> 
> 1. **Identity:** Username-based (not Email), anticipating hierarchical tenancy.
>     
> 2. **Ops:** Immutable Server (Push-only deployment).
>     
> 3. **Architecture:** Root-based Routing (Caddy 80/443 -> App 3000/API 8000).
>     
> 4. **Math:** Non-ergodic logic is isolated and frozen.
>     
> 5. **Security:** Custom JWT enforces tenancy at the SQL level (`WHERE tenant_id = claim`).
>