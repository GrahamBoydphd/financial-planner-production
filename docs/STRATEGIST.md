
# STRATEGIST: Tactical Mission Orders

Current Phase: Stage 4 - The Base Fund

Objective: Build the Fund Container and the Lockstep Simulation Engine.

---

## 1. Immediate Goals (Stage 4)

### A. The "Fund" Level Structure (Backend)

We have the Tenant -> User doing Company level simulation where the fund is merely the static owner of the company. Now we are adding the full facility for the User to do either Company level or Fund level simulations. 

- **Schema:** The `funds` table is as before the parent. 
    
- **The Dashboard:** As present. 
    

### B. The "Lockstep"  Engine (Backend)

We are moving from **Independent Parallelism** to **Interdependent Synchronization**.

- **Old Logic:** If a Standard Averages or single volatile run, Run Company to end. If a Monte Carlo, run 1000 clones of the company for one month, then pool profit and redistribute pool, then run another month. 
    
- **New Logic:**
    The simulation is stored in memory and then shown on the results page. Only re-simulate if the user clicks that button on the single volatile run or Monte Carlo pages, unlike at present on the single company Monte Carlo that does it on each refresh. 
    - `for month in 0..120`:
        
        - Step Company A (Month `t`)
            
        - Step Company B (Month `t`)
            
        - **Interceptor:** Calculate Total Fund Cash.
            
        - **Redistributor:**  Apply Pooling redistribution logic.
            

### C. The "View Layer" Reset (Frontend)

The Frontend is purely a still purely rendering engine.

- **Constraint:** No business logic. No projections. No "Month 0" math on the client.
    
- **Contract:** Adhere strictly to the **Fortress Data Contract** (Strings for Money, Strings for Percentages).
    
- The Frontend currently shows the current three Company level projections if you click on the projection button in on a single company page. We will next add the new Fund projections results page to the existing Fund page, from there I go to a new Fund Inputs or Fund Results page following the same directory naming conventions and other logic as for the Companies. 
    

## 3. The Definition of Done (Stage 4 MVP)

1. **[ ] Hybrid Engine:** Simulation of funds implemented using `f64` conversion pattern.
    
2. **[ ] Dashboard:** Frontend renders the full Fund page, fund input, and fund results pages.
    
3. **[ ] Simulation:** Can trigger a "Run Fund" command that executes $N$ companies in lockstep and returns an aggregated result. The simulation is stored in memory and then shown on the results page. Only re-simulate if the user clicks that button on the single volatile run or Monte Carlo pages, unlike at present on the single company Monte Carlo that does it on each refresh. 
    

## 4. Current Constraints

- **Auth:** Users must be linked to a Tenant/Fund.
    
- **Inputs:** All numbers: money, percentages, etc. strictly passed as Strings (e.g., `"3.0"`).
    
- **Stack:** Rust/Axum (Backend), Next.js/Tailwind (Frontend).
    
- **Architectural Reference from V3 Freeze:** See attached file. 
















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
