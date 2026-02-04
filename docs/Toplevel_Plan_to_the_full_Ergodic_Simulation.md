---
cssclass: wide-note
cssclasses:
---
This is the toplevel guide for Gemini to understand what is coming in the future. One big reason is to build code that is already prepared for the future plans. 

I see the following toplevel stages for the online simulation tool for individual startups and for investment funds. 

The intention is to run these on the cloud. There will be a free level with limited functionality, and then paid versions for companies and investors with greater functionality. The paid version will charge based on tokens, each type of action will charge a certain number of tokens based on the computational cost to us and the value to the client. 

Here are the toplevel stages I envision. Each will have multiple sub-stages.

References to Greg Fisher concern a python software package developed with him. I will use a distinct Gemini agent to analyse the python and extract the functionality instructions needed to add the functionality to our rust + typescript code. The full equilibrium economy of his simulation we will do as a subsequent project after all phases of Company and Investor versions have been completed. This I expect to be a new project that reuses some, but not all, of the Company and Investor versions. 

| Stage Description                                                                                                                                                                         | Company Version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status     | Investor Version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Stage 1.** Simplest play and learn about ergodic vs. non-ergodic dynamics. Free                                                                                                         | Have three simple business model versions. 1) Standard, 2) single company simulation with illustrative non-ergodic dynamics, 3) Monte Carlo (MC) simulation of the dynamics                                                                                                                                                                                                                                                                                                                                               | Done       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | -                            |
| **Stage 2.** <br>Play and learn about correcting for non-ergodic dynamics. Free                                                                                                           | Add to the MC above fractional profit pooling between the different trajectories.                                                                                                                                                                                                                                                                                                                                                                                                                                         | Doing      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | To Do after Stage 3. Company |
| **Stage 3.** <br>Take onto the cloud<br><br><br>Use a dedicated Gemini agent to do all of the migration to the cloud, to keep the architect clear on developing the local software fully. | Implement on the cloud, hosted in the EU, with user registration etc.<br><br>Add in stronger comments, pop-ups, and links to my YouTube videos to explain and convert to take our trainings and consulting.                                                                                                                                                                                                                                                                                                               | To Do.<br> | Implement on the cloud with user registration etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | To Do                        |
| **Stage 4.** <br>Learning level                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |            | A simple fund with $N$ companies. $n$ of them are created by the investor, $N-n$ are automatically created by the engine. Each of the companies created by the investor uses the Company Version software.  This is not yet treating all companies as a single economy with all the economic constraints. The proposal is to have a standard database of companies, the set that Greg Fisher created for his simulation. (These will be provided.) Each of these companies runs using the single company software of the company column. Full Fund level Monte Carlo Simulation of some number of clones. In the investor version it will do profit pooling between the N companies in the fund; and a monte carlo over M clones of the whole fund, without profit pooling between clones. So the individual companies must be able to send profit into the fund pool and receive a share back. |                              |
| **Stage 5.** <br>Learning level production, partial functionality. Paid at lowest tier rates.                                                                                             | Business Modelling (BM) with more sophisticated input options and simulation parameters, and a low-level business model commentary in the output. Including  shocks, both shocks with / unique to a company, and economy-wide shocks affecting all companies, with the potential for a given shock to benefit some and harm others. Include the degree of non-ergodicity.<br><br>A commentary comparing the likely outcome from the MC results to the standard prediction.<br><br>Add payment functionality to the cloud. | To Do      | A commentary comparing the likely fund performance with and without simple correction to the non-ergodic dynamics.<br><br>Add payment functionality to the cloud.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | To Do                        |
| **Stage 6.** <br>Intermediate level production version, paid at mid-tier rates.                                                                                                           | As above, but with a higher quality more comprehensive business model diagnosis and output. This will likely be an API call to dedicated Gemini agent with a good set of instructions (i.e., "You are an expert in business planning for businesses with significant non-ergodic dynamics" is likely to be the first line.)                                                                                                                                                                                               | To Do      | A full simulation of an economy of $M$ companies, $N$ of which are in the investor's fund, $n$ created by the investor. Option of pooling in each fund, key investor metrics measured. Include limited aspects of the macro-economic functionality of Greg's simulation, except for anything to do with equilibrium, the economy being finite, and similar. Focus on the investor-level bottom-up paradigm. Use the correct single-company model developed by me for each company. <br>Currently the monte carlo makes 1000 copies of the same company and then does profit pooling from 0-100%.                                                                                                                                                                                                                                                                                                | To Do                        |
| **Stage 7.** <br>Full production version, paid at top-tier rates.                                                                                                                         | A full business plan is produced, with a wide range of parameters, and a full business plan sent to the user. Including the possibility that this is integrated with the investor simulation, in that the company might explicitly be a company in an ergodic investment fund doing profit pooling, and so the business plan for one company includes simulations of the impact of pooling across all companies in the fund.                                                                                              | To Do      | A full simulation of an economy of M companies, N of which are in one fund, potential to have multiple funds, options of pooling in each fund, key investor metrics measured. Still centred on the investor paradigm of infinite space, no macro-economic constraints, no assumption / test of equilibrium. <br><br>A report for the investor of the typical fund performance. This is very long term, maybe we will never automate this.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | To Do                        |


# Detailed activities
This is does not need to be fully fleshed out before we start. We will add, subtract, and modify as we learn by doing. We will flesh it out in full as we do each sub-stage or iteration. 

## Stage 2
### Company-Level Simulation 
Finalise a clean version, freeze the clean version backend. 
- ✅ **Investment Logic:** Calculate `investment_gain` and add it to `state.current_cash` immediately. 
- ✅ **Pooling Logic:** Define `poolable_income = op_gain + inv_gain`, where `inv_gain` is strictly positive (`Max(0, investment_gain)`).

### Investor-Level Simulation 
TBD based on Greg's functionality. 

## Stage 3
### Company-Level Simulation 
#### Implement the clean version on the cloud.
- First in a fixed development instance, later a freestanding version that spools up or down only when used to keep the monthly costs manageable. (Unless the instance is only there when I'm logged in? )
- Implement basic user registration. Currently a user login, storing their details, and the company they work for as well. GDPR compliant. During phase 4 we will begin charging users for all but the lowest free tier, based on tokens representing the cost of each action they take (e.g. each Monte Carlo simulation may cost 10 tokens, a simulation of a small fund 100 tokens) So let's prepare for this in our logic. 
### 1. The Multi-Tenant Hierarchy

To support B2B sales (e.g., selling to a VC firm) while allowing granular billing (e.g., specific funds paying for their own compute), we separated "Who Pays" from "Who Works."

- **Tenant (The Customer):** The legal entity paying the bill (e.g., "Sequoia Capital"). Critical here is to distinguish cleanly between the Tenant (refers to the actual company the user works for) and the simulation company in the software database. - **Linkage:** We added a column `tenant_id` to this table. **Crucial Distinction:** This column implies _ownership_, not identity. "New Startup Ltd" **belongs to** "Acme VC Firm". Ideally, "New Startup Ltd" doesn't even know "Acme VC" exists; it's just a data row owned by ID `123-abc`.
    
    - _Fields:_ `id`, `name`, `tier` (Free/Pro/Enterprise), `token_balance`.
            
- **Department (The Cost Center):** Optional subgroups (e.g., "BioTech Fund 1").
    
    - _Logic:_ Has its own `token_balance`. When a user runs a simulation, we try to charge the Department first; if empty, we charge the Tenant.
    - **The "Department" Nuance** You correctly asked for tokens to be spendable by Department.
	    - The schema supports this: `departments` has its own `token_balance`.
		- - The logic (Phase 4) will be: `IF user.department.balance > cost THEN spend ELSE try user.tenant.balance`.
	    - **Simulation Companies** are currently linked to the **Tenant** (root level). This means anyone in the Tenant can potentially see the simulation (if permissions allow), but billing can be segregated by Department. This is usually the desired behavior for enterprise SaaS.
        
- **User (The Human):** The actual person logging in.
    
    - _Linkage:_ Belongs to **One Tenant** and optionally **One Department**.
	- **`tenants` Table:** This is the User's employer (e.g., "Acme VC Firm"). It holds the credit card tokens.
	   - **`departments` Table:** A subgroup of the Tenant (e.g., "Acme VC - BioTech Team").
	    - **`users` Table:** The actual human. They have a foreign key `tenant_id` pointing to the Tenant.

	- **Individual Users (The "Student" Case):**
    
    - **Architecture:** The database _requires_ a Tenant container for data isolation.
        
    - **Solution:** When an individual signs up, we technically create a "Personal Tenant" (e.g., "Jane's Workspace") in the background. To the user, it just looks like signing up.
        
    - **UI:** We will label the field **"Workspace / Organization Name"**. We will add a tip: _"Students/Individuals: Enter 'My Workspace' or your name."_
        
- **Join vs. Create (The "Approval" Constraint):**
    
    - **Security:** We must prevent random users from typing "Acme VC" and joining that private simulation data.
        
    - **Solution:** The **Public Registration Page** will _only_ support creating **New Tenants**.
        
    - **Future Proof:** Joining an existing company (which requires approval) will be handled later via **Invite Links** (e.g., `planner.evolutesix.com/join?token=xyz`). For today, we assume every registration is a new "Admin" of a new workspace.
        
- **Free Tier & Tokens:**
    
    - **Logic:** We will not ask for a credit card. The backend already defaults new Tenants to `tier: "free"` and `token_balance: 0`.
        
    - **UI:** The registration flow is frictionless.
    - **Tiers:** 
	    - Free version (Company+Investor functionality)
		- Company paid tier (Silver) (Can't be chosen, "Coming soon")
		- Company paid tier (Gold) (Can't be chosen, "Coming soon")
		- Investor (Includes Company) (Silver) (Can't be chosen, "Coming soon")
		- Investor (Includes Company) (Gold) (Can't be chosen, "Coming soon")

- The "Simulation Data" Layer (The Work): These tables represent **the startups being modeled**.
- **`companies` Table:** This is the simulation subject (e.g., "New Startup Ltd").
   -  **Linkage:** We added a column `tenant_id` to this table.
        - **Crucial Distinction:** This column implies _ownership_, not identity. "New Startup Ltd" **belongs to** "Acme VC Firm". Ideally, "New Startup Ltd" doesn't even know "Acme VC" exists; it's just a data row owned by ID `123-abc`.
        

### 2. GDPR Compliance Strategy

To satisfy "Right to be Forgotten" while maintaining financial audit trails (critical for Phase 4 billing), we adopted a **Soft Delete & Consent** pattern.

- **No Hard Deletes:** We do not physically remove rows immediately (which breaks historical billing data).
    
- **The Fields:**
    
    - `marketing_consent` (Boolean): Explicit opt-in for communications.
        
    - `terms_accepted_at` (Timestamp): Versioning for legal agreements.
        
    - `deleted_at` (Timestamp): If set, the user is "gone" effectively, but the ID remains for ledger integrity.
        
- **The "Forget Me" Action:** When a user requests deletion, we scramble PII (Personal Identifiable Information like email/name) and set `deleted_at`, keeping the keys intact for the token ledger.
    

### 3. The "Token Economy" (Phase 4 Prep)

We prepared the database for "Usage-Based Billing" (Monte Carlo simulations costing tokens) by creating a double-entry style ledger.

- **Table:** `token_ledger`
    
- **Mechanism:**
    
    - Every expensive action (Simulation) creates a ledger entry: `amount: -100`, `description: "Small Fund Simulation"`.
        
    - Purchases create positive entries: `amount: +5000`, `description: "Stripe Top-up"`.
        
- **Why this way?** It allows us to audit exactly _where_ tokens went if a client disputes a bill, rather than just decrementing a single number.





#### Improve the clean version with better guidance to the user.
#### Improve the output
- Add in to the Monte Carlo graph an output box reading "Likelyhood of losing: X times out of Y the company has lost money by the end" where Y is the number of MC copies (1000 base case) and X is the number of paths below the "flatline" path. By flatline I mean the initial starting cash balance after the first investment, or the cumulative flatline adding all investments. 

### Investor-Level Simulation 
Implement the clean version on the cloud.
Improve the clean version with better guidance to the user.


### Still to add in
- Descriptive text panel next to the login / registration card.
- Email the results to user's email. 
- Make a copy of the current scenario (i.e., business plan) to ease users making modifications to just some items while retaining the previous for comparison.
- 


## Stage 4

## Company-Level Simulation 
- Include the degree of non-ergodicity at time T as the ABS(Monte Carlo P50 value - standard value) at the end of the time period. 
- Include in the data table the Investment gains and losses from treasury management activities. 

- [x] Set up BE gem
- [x] Rebuild docs/ARCHITECTURAL_CONTEXT_CLI.md
- [x] On the FE change code temporarily to freeze currencies to Fund currency, all frozen to Euro. 
- [x] Clean up the root, and make a final V3 archive. 
- [x] Put in the first prompt from Strategist. 
      We may need to completely refactor the company level engine. What I believe we will need is 
		1. A Universe. In each universe you may have only one company running (company level), or many companies (fund level). In a given universe the economy-wide shocks we later define will be applicable to all companies. And the company level shocks distinct to each company. If the run is the traditional deterministic engine, use rust decimal. If the run is volatile, both for single volatile and for the Monte Carlo, use f64. 
		2. A Monte Carlo simulation across many universes, in two variants.
			1. Company-level simulation: What we have now. **Ensemble Pooling** (Company Level: pooling across parallel timelines to fix ergodicity). Each universe contains one company, we iterate each universe by one time step and then do profit pooling (if switched on) at the given percentage between universes. Of course only one company per universe, so company and universe are equivalent. 
			2. Fund-level simulation: What we are building. **Portfolio Pooling** (Fund Level: pooling across different entities to manage risk). Each universe contains multiple companies, we iterate each universe by one time step and then do profit pooling (if switched on) at the given percentage between *the companies within that universe*. At the fund level there is NO profit pooling between universes now. Of course now we have multiple companies per universe, so company and universe are NOT equivalent. 
		3. So this suggests that we refactor into nested functionality (subroutines, functions, you decide what is best) 
			1. Individual Company Iterator: Takes Company A, B, C, etc one step forwards in Universe 1, 2, 3 etc. Lowest level function.
			2. Company-level simulation manager. Calls  Individual Company Iterator for company A in universe X. If a standard or single company volitlity, repeats to the end of the time T. If a Monte Carlo, repeats the call in breadth first for one time step across all universes, pools profit between the universes, then repeats for the next time step until the end of time T. Suggestion: only re-run the simulation if the user requests it via a button to re-run it, similar to the call for the single company volatility. Not if the user merely refreshes the page etc., nor if the the ergodicity correction, the capital stack, the credit facility, or the dividend policy changes 
			3. Fund-level simulation manager. Calls  Individual Company Iterator for each company A, B, C etc. in universe X. If a standard or single fund volatility, repeats to the end of the time T only for Universe X. If a Monte Carlo, repeats the call in breadth first for one time step across all universes and each company in the universe, pools profit between the companies within a universe, then repeats for the next time step until the end of time T.  Suggestion: only re-run the simulation if the user requests it via a button to re-run it, similar to the call for the single company volatility. Not if the user merely refreshes the page etc., nor if the the ergodicity correction, the capital stack, the credit facility, or the dividend policy changes 
- [x] Add a line for the fund achieving a 3X return?  Or similar? 
- [x] And add a comment on the fund graph page about the fund being based  on cash, not on valuation, for simplicity of understanding. together with Total Fund Value = Sum(Company Cash) + Sum(Dividends Paid). And this as the top, and bigger. 
- [x] Change insolvent cut-off to 100 and add comment to the plots and FAQ.
- [x] Confirm that the insolvent shutdown only happens after exhausting the overdraft. Done now. 
- [x] Check the insolvent + overdraft respected. 
- [x] Fix the fantasy and approved overdraft being the same. 
- [x] Next stage add an input function for the insolvent cut-off, maybe only in paid, and default to 100. 
- [x] FE to Add  to the fund graphs the same red line showing cumulative investment to date that we have in the company graphs. Do you already have the data you need, or does the Backend Architect need to do work? 
- [x] FE to Add to the company data table a column for treasury management gains / losses. 
- [x] Bi directional event and Counter cyclic events.
- [x] Register demo user. 
- [ ] Make full companies demo on server. 
- [x] Make video. 
- [ ] Upgrade help page.
- [x] Add copy event to companies page.
- [ ] Add checks to all FE input items to insure in a valid range. Esp. flat check if the steps are between 1 and 20 (or some smallish number).  And add in Fortress checks in the code, and clear messages on screen if errors in operation. You are absolutely right. The previous "blind clamp" proposal was too permissive. In a financial simulation, silently converting `-2` (which is logically invalid) to `+2` is dangerous because it hides a configuration error from the user.
	- [ ] **Big refactor** This code runs deep inside the simulation loop (`sample()` function) which returns a simple `f64`. It cannot easily return an `Result<Error>` to the user without rewriting the entire engine signature (a massive, risky change).
	- [ ] **The Fortress Standard:** We must not allow invalid state to execute. If the user asks for `-2` intervals, the simulation _should_ likely fail or warn, not just guess.
- [ ] Later change the P0 and P100 lines on each plot to P2 and P98, eliminating the two 1 in 500 extremes on each end. Or maybe not, since I cut off the big ones anyway? Or maybe yes, to simply not create gambler's hope. 
- [x] Later add a feedback tab that connects to google forms. 
- [x] Duplicate a plan in a company on the company page; Duplicate a whole company in a fund on the dashboard page and the structure page; move a company from one fund to another on the dashboard and on the structure page;  duplicate a whole fund on both the Structure page and the Fund page .  When a company is Duplicated, all plans are Duplicated with it. When a fund is Duplicated, all companies and their plans are duplicated.
- [x] Have a user called demo_admin that runs the "Demo Fund" of the "Demo Tenant" and manages the demo fund and demo companies. Either 1) All users can see the demo fund, see the results, but cannot edit it. And they can copy the demo into their own trial and then edit that. Or alternately 2) if it's better for security, a copy is copied in on registration as their personal "demo fund and companies". 1. is preferred because then they can always restore the demo fund, and if we improve it they can copy the improved version. Please advise though on the security implications.
- [ ] Change $ sign in staffing to currency symbol.
- [ ] I want to add new functionality to both the company charts and the fund charts. On the Monte Carlo simulation runs, I want to add a card that shows the performance improvement when the ergodic correction is switched on. This should give a number for the P50 end value that shows how much bigger the total value of the fund is, is the fund is, is at the...
- [ ] Improve the information and description and FAQ. 
	- [ ] "The Frankenstein Median" : The "Zombie Resurrection" (2 → 1 → 2) happens because the engine currently calculates the P50 **Cross-Sectionally** (month-by-month): 
	      - **Month 10:** The engine sorts all 1,000 runs. The median (Run #500) happens to be a solvent company. **Count: 2/2**. 
	      - **Month 11:** The engine resorts. The median (Run #500) happens to be a _different_ company that just went insolvent. **Count: 1/2**. 
	      - **Month 12:** The engine resorts. The median (Run #500) is a third company that is solvent. **Count: 2/2**.
	    Because the "Median" is a statistical abstraction, not a single continuous company, it can exhibit impossible behaviors like coming back to life.
- [ ] Add to the Authorisation the different registration levels, but blanked out.
- [ ] Add a route to Open Collective to support completion of the project, including early payment for full tokens.
- [ ] tomorrow on events: FE: One more fine-tuning. The events card is between the New Fund card and the List of existing funds. Better to put the list above the events, below the Fund card. And now that the funds are in the Events as a tick box list, no need for the "manage swan events" action icon in the funds list; the events card is always there.
---
1. **Insolvency = Zero (or Negative):** In `domain.rs`, once a company is flagged insolvent, its `cash_balance` is forced to `0.0` for all future months. Even in the exact month it dies, it likely has a negative or low cash balance.
    
2. **The Sorting "Sinks" the Dead:** When we sort by `cash_balance`:
    
    - **Indices 0 to 599:** The 600 Insolvent companies (Value = 0).
        
    - **Indices 600 to 999:** The 400 Solvent companies (Value > 0).
        
3. **The Median (P50) Pick:** The code picks the item at index 500. Since indices 0–599 are all 0, **Index 500 is 0**.
    

**Conclusion:** The P50 line will flatline at **0 (Insolvent)** the moment more than half your simulated universes fail. It does **not** accidentally switch to "the P50 of the survivors."
1. **For the Table (`p50_data`):**
    
    - We send the detailed breakdown for the Median run.
        
    - This includes a specific field `cash_balance` which **is** exactly what you asked for: the sum of the cash sitting in the bank accounts of all solvent companies.
        
    - You can display this column in your data table if you want to show "Liquid Assets vs. Total Value."
        

### ✅ Confirmation of Aggregation

Yes, the simulation performs a **simulation of every single company** (1,000 times) and then **sums them up** month-by-month. It does not average the inputs; it sums the outputs.

- **Fund Revenue** = Sum of Company Revenues
    
- **Fund Opex** = Sum of Company Opex
    
- **Fund Cash** = Sum of Company Cash

---



### Shocks
- Some shocks only for the paid version.
	- Shock design: a tick box to activate. Choose probability distribution per year with one-sided or two-sided options, and probability distribution for the scale of the shock and clear guidance, , 
- Standard shocks (free version) (Company+Investor functionality)
	- Unspecific shock. 
	- Marketing
	- Staffing
- Company paid tier (Silver)
	- 
- Company paid tier (Gold)
	- 
- Investor (Includes Company) (Silver)
	- 
- Investor (Includes Company) (Gold)
	- 

# First iteration shock structure:

### Future Logic (For your awareness)

When we get to the **Engine** phase (next prompt), I will implement the "Translator" logic you requested:

- **Likelihood:** $P(Monthly) = 1 - (1 - P(Annual))^{1/12}$
    
- **Magnitude Mapping (Example):**
    
    - `small` $\rightarrow$ $\mu = 5\%$
        
    - `medium` $\rightarrow$ $\mu = 15\%$
        
    - `large` $\rightarrow$ $\mu = 30\%$
        
- **Direction Mapping (Example):**
    
    - `detrimental_only` $\rightarrow$ Multiply by $-1$, force Max $< 0$.
        
    - `both_biased_detrimental` $\rightarrow$ Skew Normal Distribution with negative $\alpha$ (tail to the left).

### 2. The Logic Change (Handler)

The backend handler will inspect `scope` and `target_id`:

- **Scope "global"** $\rightarrow$ Save `fund_id = target_id`.
    
- **Scope "local"** $\rightarrow$ Save `company_id = target_id`.
    
- **Mapping:** The handler will derive `impact_type` (required for math) from your `shock_type` (e.g., "revenue_hit" $\rightarrow$ "revenue").

--- 



#### Multi-Fund Structure (The "Clean Break")
We paused this earlier. Now that the simulation kernel is stable, we could return to the database refactor to allow a **Company to belong to multiple Funds** (Many-to-Many). 
- **Why:** This is essential for the "Structure" page to truly reflect complex ownership (e.g., Company A is owned by Fund X and Fund Y).
   
### Investor-Level Simulation (The "waterfall")

We have simulated the _Company_. Now we need to simulate the _Investor_. This means there are now two modes of operation: 
1. The company level, which is as we have done it to now. 
2. The Fund level, which will simulate one entire fund's performance over 1, 2, 3, 5, 10,  20, 50, or 100 years. The fund level will use the company level single volatile runs as input, and then do either conventional projections using standard Modern Portfolio Theory approaches or will use the Ergodic Investment Strategy (EIS) from my book The Ergodic Investor and Entrepreneur. In the EIS there is a "Fund Internal ergodicity correction" from 0 to 100% implemented as a slider as on the single company Monte Carlo. This implements the same kind of pooling mechanism and profit redistribution each month. Only now it is between the actual companies in the fund. The Monte Carlo is to do some number of simulations, to be defined by the user as an input variable on the projection page, default to 500. Further details below. 
	1. Freeze initially the currency of the company creation to match that of the Fund; only single-currency Funds. 

- **Task:** Create the **"Investor"** entity.
    - **Logic:** Investors buy shares in Funds. Funds hold Companies. We need to calculate the **"Look-through Earnings"**—how much of Company A's distributed profit actually lands in Investor Z's pocket after passing through the Fund layer?
- ##### The "Waterfall" Mechanics
	- Only **Simple Pro-Rata:** at this stage. (If an Investor owns 10% of the Fund, they simply get 10% of every dollar the Fund receives.)  At Stage 6 we will build in more options to choose between, e.g. **Complex Private Equity Style:** 
- ##### Fund Behaviour (Pass-Through vs. Reinvesting). 
  Have the possibility for both of these options. 
	- **Pass-Through:** The Fund immediately distributes all cash it receives from Companies to the Investors. (Common in simple structures).    
	- **Active Treasury:** The Fund can hold cash, paying its own expenses or saving for future investments, before distributing to Investors.
	- **Active fund level ergodicity factors:** The Fund can directly support companies correcting for non-ergodic dynamics, in addition to the pooling mechanism. 
- ##### The "Economy" of Investors
	- **Finite Capital:** Investors have a limited "wallet" that runs out, the sources of capital for the simulation are finite.
	- **Direct Holdings:** At this stage investors can hold a Company directly, and the "Multi-Fund Structure" allows a company to be in multiple funds.

## Stage 5


### Specific Tasks
- [ ] Open the fund to all currencies, but keep the companies frozen to the fund currency
- [ ] 

### User Authorisation
- Build in the full token management etc. of Stage 3

### Company-Level Simulation 
### Investor-Level Simulation 
- ##### Systemic / Ecosystemic
  At this stage we build in more sophisticated relationships between companies so that they form a proper system. e.g. to simulate systemic impact investing at an initial level. 
- ##### The "Waterfall" Mechanics
  Build in the option for a given fund to choose between simple pro-rata and a more complex PE style
	- **Simple Pro-Rata:** As in Stage 4 and now we add the option to choose    
	- **Complex Private Equity Style:**  we need to model **Hurdle Rates** (e.g., Investor gets 100% of profit until they hit an 8% return) and **Carried Interest** (Fund Manager takes 20% of profits after the hurdle) and anything else needed.
	- **Evergreen Ergodic Ecosystem Holding Company Style:**  we need to model a fully fledged holding company approach, where investors can only invest by buying new shares or shares from a willing buyer, and exit by selling their shares to a willing buyer. 
- ##### Fund Behavior (Pass-Through vs. Reinvesting). 
  All the above options, and possibly more added.
	- 
- ##### The "Economy" of Investors
	- **Direct Holdings:** At this stage investors can hold a Company directly, and the "Multi-Fund Structure" allows a company to be in multiple funds.

## Stage 6

### Specific Tasks
- [ ] Add in exchange rates between currencies, potentially with fluctuations, and then open the companies to different currencies to the fund. 
- [ ] Enable companies to be created during the fund's lifetime.


### Company-Level Simulation 
### Investor-Level Simulation 
