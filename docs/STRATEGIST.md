# STRATEGIST: Tactical Mission Orders

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
4.  [ ] `do_task.sh` audit confirms no `email` fields exist in the codebase.