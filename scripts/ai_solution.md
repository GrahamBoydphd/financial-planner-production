🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/app/help/page.tsx'>
import React from 'react';
import Link from 'next/link';

// --- DATA DEFINITIONS (From USER_MANUAL_TECHNICAL_REF.md) ---

const staffingData = [
  { label: "Role Name", purpose: "Title of the position (e.g., 'Sales Rep', 'Developer').", rules: "Required, must not be empty." },
  { label: "Annual Salary", purpose: "Base annual salary per person in this role.", rules: "Required, must be a valid number." },
  { label: "Hiring Plan", purpose: "How employees are added over time (Fixed Count or Monthly Rate).", rules: "Select: 'fixed_count' or 'monthly_rate'." },
  { label: "Target Headcount", purpose: "Maximum number of people to hire for this role.", rules: "Required, integer >= 1." },
  { label: "Hiring Pace", purpose: "Hire 1 person every X months. (e.g., 1 = monthly, 3 = quarterly).", rules: "Required if 'monthly_rate', integer >= 1." },
  { label: "Start Month", purpose: "Month number (1-60) when hiring begins.", rules: "Required, integer 1-60." },
  { label: "Annual Increase (%)", purpose: "Expected annual salary increase (e.g., 3.5 for 3.5%).", rules: "Optional, 0-100." },
];

const revenueData = [
  { label: "Name", purpose: "Name of the revenue stream (e.g., SaaS Subs).", rules: "Required, must not be empty." },
  { label: "Source Type", purpose: "Category of revenue (e.g., Sales, Subscription).", rules: "Select: Sales, Subscription, Service, Other." },
  { label: "Initial Amount ($)", purpose: "Starting revenue amount.", rules: "Required number." },
  { label: "Growth Rate (%/mo)", purpose: "Monthly growth rate percentage.", rules: "Optional number." },
  { label: "Cost of Rev (%)", purpose: "Cost of revenue percentage.", rules: "Optional number." },
  { label: "Frequency", purpose: "How often revenue is recognized.", rules: "Select: Monthly, One-time, Quarterly, Annually." },
  { label: "Start Month", purpose: "Month in which revenue stream begins.", rules: "Required number." },
  { label: "End Month (Opt)", purpose: "Month in which revenue stream ends.", rules: "Optional number." },
  { label: "Model Type", purpose: "Type of volatility model to apply.", rules: "Averages, Simple, NRIG, or Student-T." },
  { label: "Mean / Drift", purpose: "Expected Monthly Return.", rules: "Optional number." },
  { label: "Min %", purpose: "Minimum percentage deviation (Flat).", rules: "Required if Simple, < Max %." },
  { label: "Max %", purpose: "Maximum percentage deviation (Flat).", rules: "Required if Simple, > Min %." },
  { label: "Steps", purpose: "Number of intervals between min and max (Flat).", rules: "Required if Simple." },
  { label: "Scale (Vol)", purpose: "Volatility Scale (Student-T).", rules: "Required if Student-T." },
  { label: "Freedom (Deg)", purpose: "Degrees of freedom (Student-T).", rules: "Required if Student-T." },
  { label: "Likelyhood (Alpha)", purpose: "Tail Weight (NRIG).", rules: "Required if NRIG." },
  { label: "Skew (Beta)", purpose: "Imbalance (NRIG).", rules: "Required if NRIG." },
  { label: "Scale (Delta)", purpose: "Volatility Scale (NRIG).", rules: "Required if NRIG." },
];

const expenseData = [
  { label: "Name", purpose: "Name of the expense item (e.g., Salaries).", rules: "Required, must not be empty." },
  { label: "Category", purpose: "Category of expense (e.g., OpEx, CapEx).", rules: "Select: OpEx, CapEx, Payroll, Marketing." },
  { label: "Initial Amount ($)", purpose: "Starting expense amount.", rules: "Required number." },
  { label: "Growth Rate (%/mo)", purpose: "Monthly growth rate percentage.", rules: "Optional number." },
  { label: "% of Revenue", purpose: "Percentage of revenue tied to expense.", rules: "Optional number." },
  { label: "Frequency", purpose: "How often expense is incurred.", rules: "Select: Monthly, One-time, Quarterly, Annually." },
  { label: "Start Month", purpose: "Month in which expense begins.", rules: "Required number." },
  { label: "End Month (Opt)", purpose: "Month in which expense ends.", rules: "Optional number." },
  { label: "Volatility Inputs", purpose: "Same model options as Revenue.", rules: "See Revenue Volatility." },
];

const capitalData = [
  { label: "Source Name", purpose: "Name of the capital source (e.g., Seed Round).", rules: "Required, must not be empty." },
  { label: "Amount ($)", purpose: "Amount of capital injection.", rules: "Required number." },
  { label: "Month", purpose: "Month in which capital is injected.", rules: "Required integer 1-120." },
];

const capitalGrowthData = [
  { label: "Model Type", purpose: "Type of volatility model to apply.", rules: "Selection required." },
  { label: "Expected Return", purpose: "Expected monthly return percentage.", rules: "Required number." },
  { label: "Volatility Params", purpose: "Min/Max (Simple) or Distribution params.", rules: "Dependent on Model Type." },
];

const dividendData = [
  { label: "Enable Dividends", purpose: "Toggle dividends payout.", rules: "Boolean." },
  { label: "Safety Threshold ($)", purpose: "Minimum cash balance required before dividends are paid.", rules: "Required number." },
  { label: "Payout Percentage", purpose: "Percentage of surplus cash distributed as dividends.", rules: "Required number 0-100." },
];

const creditData = [
  { label: "Max Limit ($)", purpose: "Maximum credit facility limit.", rules: "Required number." },
  { label: "Interest Rate (%)", purpose: "Interest rate on the credit facility.", rules: "Required number." },
  { label: "Rate Type", purpose: "Annual (APR) or Monthly.", rules: "Boolean." },
];

const valuationData = [
  { label: "Valuation Method", purpose: "Method used for valuation.", rules: "Revenue Multiple or EBITDA Multiple." },
  { label: "Revenue Multiple (x)", purpose: "Multiple applied to revenue.", rules: "Required if Revenue Method." },
  { label: "EBITDA Multiple (x)", purpose: "Multiple applied to EBITDA.", rules: "Required if EBITDA Method." },
];

const authData = [
  { label: "Username", purpose: "Required Username.", rules: "Required." },
  { label: "Email", purpose: "Required Email.", rules: "Required." },
  { label: "Full Name", purpose: "Required Full Name.", rules: "Required." },
  { label: "Company Name", purpose: "Organization Name.", rules: "Required (unless Student)." },
  { label: "Password", purpose: "Required Password.", rules: "Required." },
  { label: "Student / Individual", purpose: "Toggle for individual bypass.", rules: "Boolean." },
];

// --- COMPONENTS ---

const TableSection = ({ title, id, data }: { title: string, id: string, data: any[] }) => (
  <div id={id} className="scroll-mt-24 mb-10">
    <h4 className="text-md font-bold text-gray-900 mb-4 uppercase tracking-wide border-l-4 border-indigo-500 pl-3">{title}</h4>
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 sm:pl-6">Label</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Purpose</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Validation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((row, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{row.label}</td>
              <td className="px-3 py-4 text-sm text-gray-600">{row.purpose}</td>
              <td className="px-3 py-4 text-sm text-gray-500 italic">{row.rules}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function HelpPage({ searchParams }: { searchParams?: { new?: string } }) {
  const isNewUser = searchParams?.new === 'true';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Global Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img src="/logo.png" alt="Evolutesix" className="h-8 w-auto" />
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/structure" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Structure
                </Link>
                <Link href="/help" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Help Center
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 hidden lg:block fixed h-[calc(100vh-4rem)] overflow-y-auto top-16 left-0 z-10">
          <div className="p-6">
            <h1 className="text-xl font-bold text-indigo-600 mb-8">Help Topics</h1>
            <nav className="space-y-1">
              <a href="#intro" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">Introduction</a>
              <a href="#hierarchy" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">The Hierarchy</a>
              <a href="#best-practices" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">Best Practices</a>
              
              <div className="h-6"></div>
              <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Technical Appendix</p>
              <a href="#glossary" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">Input Glossary</a>
              <a href="#sim-params" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">Simulation Parameters</a>
              <a href="#ui-logic" className="block px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md">UI Logic</a>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 lg:ml-64 p-8 lg:p-12">
          <div className="max-w-5xl mx-auto space-y-16">
            
            {/* Welcome Hero Section (Visible only to new arrivals) */}
            {isNewUser && (
              <div className="bg-indigo-600 rounded-lg shadow-md p-8 text-white">
                <h2 className="text-3xl font-bold mb-4">Welcome to Evolutesix</h2>
                <div className="space-y-4 text-indigo-100 text-lg">
                  <p>
                    Congratulations on starting your journey. This Financial Planner helps founders and investors understand how a business is likely to behave under real-world uncertainty.
                  </p>
                  <p>
                    Instead of projecting a single “expected” outcome, the tool stress-tests your plan across thousands of possible paths, revealing: how sensitive your business is to cash shocks, where volatility creates hidden risk, and which strategic choices meaningfully reduce the chance of failure.
                  </p>
                  <p>
                    The result is not a prediction, but clearer insight into survival, resilience, and downside risk — so you can compare strategies, adjust assumptions, and make better-informed decisions before capital and time are committed.
                  </p>
                </div>
                <div className="mt-8">
                  <Link href="/" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 shadow-sm">
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Start Guide (Subsequent Visits) */}
            {!isNewUser && (
              <section id="quick-start" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start Guide</h2>
                <div className="prose prose-indigo text-gray-600 max-w-none space-y-4">
                  <p>
                    Use this guide to understand our risk-based modeling before building your first plan.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Structure:</strong> Go to the <Link href="/structure" className="text-indigo-600 hover:underline">Structure (Funds & Companies)</Link> page to create your first Fund and Company.
                    </li>
                    <li>
                      <strong>Dashboard:</strong> Navigate to the <Link href="/" className="text-indigo-600 hover:underline">Dashboard</Link> to see all the funds and companies you've created.
                    </li>
                    <li>
                      <strong>Company Inputs:</strong> Click on one of your companies to enter its workspace. Use the tabs to enter:
                      <ul className="list-disc pl-5 mt-1">
                        <li>Revenue items, Expense items, and Staffing items.</li>
                        <li>Initial cash on hand, Investment rounds, Credit facilities.</li>
                        <li>Valuation model, Growth rates, and other parameters.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Projections:</strong> Finally, go to the Projections page. Use the <strong>dropdown menu</strong> to switch between views:
                      <ul className="list-disc pl-5 mt-1">
                        <li><strong>Conventional:</strong> Standard deterministic planning.</li>
                        <li><strong>Real World:</strong> Single-company real world volatility planning.</li>
                        <li><strong>Monte Carlo:</strong> The real world spread of most likely outcomes in the 1000 clones simulation.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {/* Alpha Disclaimer */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-yellow-800">Alpha Release Warning</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      This software is in Alpha. Financial models are probabilistic estimations, not guarantees. 
                      Results should be used for strategic planning and scenario analysis only, not as tax or investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Introduction */}
            <section id="intro" className="scroll-mt-24">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">Antifragile Financial Modeling</h1>
              <div className="prose prose-indigo text-gray-600 max-w-none">
                <p className="text-xl leading-relaxed">
                  Traditional spreadsheets assume averages. Reality is volatile. Our engine prioritizes 
                  <span className="font-bold text-gray-900"> "Correctness over Convenience"</span> by modeling 
                  non-ergodic path dependence—meaning the order of events matters.
                </p>
                <p className="mt-4">
                  A 50% drop followed by a 50% gain leaves you with 75% of your starting capital, not 100%. 
                  We simulate thousands of trajectories to show you the probability of ruin, not just the average outcome.
                  This approach helps you build an "Antifragile" strategy that can withstand and potentially benefit from volatility.
                </p>
              </div>
            </section>

            {/* Hierarchy */}
            <section id="hierarchy" className="scroll-mt-24">
              <div className="border-b border-gray-200 pb-4 mb-8">
                <h2 className="text-3xl font-bold text-gray-900">The Hierarchy</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">🏛️</div>
                  <h3 className="text-lg font-bold text-gray-900">Fund</h3>
                  <p className="mt-2 text-sm text-gray-500">The top-level container. Represents your investment firm or holding entity. Invests in the Company.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">🏢</div>
                  <h3 className="text-lg font-bold text-gray-900">Company</h3>
                  <p className="mt-2 text-sm text-gray-500">A specific business entity. Contains historical data and settings; and prediction parameters for future scenarios. Needs multiple plans in order to navigate into the future.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">📄</div>
                  <h3 className="text-lg font-bold text-gray-900">Plans</h3>
                  <p className="mt-2 text-sm text-gray-500">A specific business plan scenario (e.g., "Series A Base") for the company.</p>
                </div>
              </div>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="scroll-mt-24">
              <div className="border-b border-gray-200 pb-4 mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Best Practices</h2>
              </div>
              
              <div className="space-y-12">
                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">1. The Three-Tier Approach</h3>
                  <p className="text-gray-700 mb-4">
                    Don't rely on a single number. We recommend creating three distinct Plans for every Company:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    <li><strong>Base Case (P50):</strong> Your honest expectation. Standard growth, standard churn.</li>
                    <li><strong>Optimistic (P90):</strong> Everything goes right. Higher viral coefficient, lower costs.</li>
                    <li><strong>Stress Test (P5):</strong> The "Black Swan" scenario. Use NRIG volatility with fat tails to model market crashes or funding dry-ups.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">2. Iterative Modeling & The Liquidity Gap</h3>
                  <p className="text-gray-700 mb-4">
                    Financial modeling is a loop, not a line. Use the simulation results to find your breaking point.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-gray-600">
                    <li>Run the simulation (1000+ iterations).</li>
                    <li>Check the <strong>Cash Balance</strong> chart. Look for the <strong>P5 (5th Percentile)</strong> line.</li>
                    <li>Identify the "Liquidity Gap"—the month where the P5 line dips below zero.</li>
                    <li>Return to the <strong>Capital</strong> form and inject a bridge round or credit facility one month prior to the gap.</li>
                    <li>Re-run to verify survival.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">3. The Starter Strategy</h3>
                  <p className="text-gray-700 mb-4">
                    If you are unsure where to begin, we recommend starting with <strong>Flat Volatility</strong>. This establishes a baseline range without the complexity of heavy-tailed distributions.
                  </p>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-md">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Starter Configuration</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li><strong>Model Type:</strong> Simple / Flat</li>
                      <li><strong>Mean / Drift:</strong> 1.34% <span className="text-gray-400">(Average Monthly Growth)</span></li>
                      <li><strong>Min %:</strong> -30.00% <span className="text-gray-400">(Worst Month)</span></li>
                      <li><strong>Max %:</strong> 32.68% <span className="text-gray-400">(Best Month)</span></li>
                      <li><strong>Steps:</strong> 2</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">4. Advanced Modeling Examples</h3>
                  <p className="text-gray-700 mb-4">
                    For specific risk profiles, use these tested configurations to model asymmetric or fat-tailed risks:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h4 className="font-bold text-indigo-900">NRIG (Asymmetric Risk)</h4>
                      <p className="text-xs text-indigo-700 mb-3">High downside tail risk. Ideal for early-stage startups.</p>
                      <ul className="text-sm text-indigo-800 space-y-1">
                        <li><strong>Likelyhood (Alpha):</strong> 0.8</li>
                        <li><strong>Skew (Beta):</strong> -0.5</li>
                        <li><strong>Scale (Delta):</strong> 1.5</li>
                      </ul>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-gray-900">Student-T (Fat Tails)</h4>
                      <p className="text-xs text-gray-600 mb-3">High frequency of outliers. Ideal for volatile markets.</p>
                      <ul className="text-sm text-gray-800 space-y-1">
                        <li><strong>Scale (Vol):</strong> 2.0</li>
                        <li><strong>Freedom (DoF):</strong> 3.0</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Technical Appendix */}
            <section id="technical-appendix" className="pt-10 border-t-4 border-gray-200">
              <h2 className="text-3xl font-bold text-gray-900 mb-10">Technical Appendix</h2>

              {/* Glossary */}
              <div id="glossary" className="scroll-mt-24">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">1. Input Field Glossary</h3>
                <TableSection title="Staffing Form" id="staffing" data={staffingData} />
                <TableSection title="Revenue Form" id="revenue" data={revenueData} />
                <TableSection title="Expense Form" id="expense" data={expenseData} />
                <TableSection title="Capital Injection" id="capital" data={capitalData} />
                <TableSection title="Capital Growth Policy" id="capital-growth" data={capitalGrowthData} />
                <TableSection title="Dividends" id="dividends" data={dividendData} />
                <TableSection title="Credit Facility" id="credit" data={creditData} />
                <TableSection title="Valuation" id="valuation" data={valuationData} />
                <TableSection title="Authentication" id="auth" data={authData} />
              </div>

              {/* Simulation Parameters */}
              <div id="sim-params" className="scroll-mt-24 mt-16">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">2. Simulation Parameters</h3>
                <div className="prose prose-indigo text-gray-600 max-w-none space-y-8">
                  <p>
                    The simulation allows you to model financial performance under different conditions. Volatility can be included for Revenue, Expenses and Capital Growth.
                  </p>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-900">Deterministic</h4>
                    <p className="mt-2">The simulation runs without any volatility. This is the most basic form of modelling that gives you an idea of what to expect without accounting for any unexpected conditions.</p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-900">NRIG (Normal-Inverse-Gamma)</h4>
                    <p className="mt-2">Used for "Comprehensive Volatility". Captures heavy tails and skewness.</p>
                    <ul className="mt-4 list-disc pl-5 space-y-1">
                      <li><strong>Alpha (Likelihood):</strong> Affects the likelihood of extreme events. Lower values = fatter tails (higher risk of extreme events).</li>
                      <li><strong>Beta (Skew):</strong> Controls asymmetry. Skew risk towards upside (positive shocks) or downside.</li>
                      <li><strong>Delta (Scale):</strong> Base volatility scale. Higher values = higher variance.</li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-900">Student-T</h4>
                    <p className="mt-2">A robust alternative to Normal distribution, handling outliers via degrees of freedom.</p>
                    <ul className="mt-4 list-disc pl-5 space-y-1">
                      <li><strong>Scale:</strong> Spread of the distribution. Higher values = higher volatility.</li>
                      <li><strong>Freedom (Degrees):</strong> Controls tail thickness. Lower values (3-5) = fatter tails. Higher values converge to Normal distribution.</li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-900">Flat / Simple</h4>
                    <p className="mt-2">Uniform distribution between a defined Minimum and Maximum percentage deviation.</p>
                    <ul className="mt-4 list-disc pl-5 space-y-1">
                      <li><strong>Min %:</strong> Maximum downside deviation in a single month.</li>
                      <li><strong>Max %:</strong> Maximum upside deviation in a single month.</li>
                      <li><strong>Steps:</strong> Granularity of the random walk.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* UI Logic */}
              <div id="ui-logic" className="scroll-mt-24 mt-16 mb-20">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">3. UI Logic</h3>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8">
                  <h4 className="text-xl font-bold text-gray-900 mb-4">"Student / Individual" Bypass</h4>
                  <p className="text-gray-700 mb-4">
                    To facilitate access for students and individual researchers who do not belong to a corporate entity, the registration form includes a specific bypass logic.
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-5 w-5 text-indigo-500">✓</span>
                        <span className="ml-2">When checked, the <strong>Company / Organization Name</strong> field is immediately disabled.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-5 w-5 text-indigo-500">✓</span>
                        <span className="ml-2">The value is programmatically set to <code>"Individual"</code>.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-5 w-5 text-indigo-500">✓</span>
                        <span className="ml-2">This allows the user to bypass strict organization name validation while maintaining data integrity in the backend.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
</file>

<file path='frontend/components/forms/AuthForm.tsx'>
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InfoTag from '@/components/ui/InfoTag';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (data: any) => Promise<void>;
}

export default function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsStudent(checked);
    if (checked) {
      setCompanyName('Individual');
    } else {
      setCompanyName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    if (mode === 'register') {
      if (!fullName) {
        setError('Full Name is required.');
        return;
      }
      if (!email) {
        setError('Email is required.');
        return;
      }
      if (!companyName) {
        setError('Company / Organization Name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await onSubmit({ username, email, password, full_name: fullName, company_name: companyName });
        // Redirect to Help page with new flag for new users
        router.push('/help?new=true');
      } else {
        await onSubmit({ username, password });
        // Redirect to Dashboard for returning users
        router.push('/');
      }
    } catch (err: any) {
      console.error(err);
      
      // Debugging 422: Show raw JSON
      setError(JSON.stringify(err.response?.data) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4">
      
      {/* Branding Logo */}
      <img 
        src="/logo.png" 
        alt="Logo" 
        className="h-16 w-auto mb-8 mx-auto block" 
      />

      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-md md:flex-row">
        
        {/* Left Column: Marketing & Disclaimer (Visible on md+) */}
        <div className="hidden w-full flex-col bg-indigo-700 p-10 text-white md:flex md:w-1/2">
          <h2 className="mb-6 text-3xl font-bold">Master Your Financial Future</h2>
          <div className="space-y-4 text-indigo-100">
            <p>
              A sophisticated simulation tool designed to model the survival and growth of startups, SMEs, 
              and the funds that invest in them. Replaces your conventional business / portfolio planning, 
              because standard business / portfolio planning tools are blind to the
              losses caused by volatility drag and all other forms of non-ergodic dynamics. This software
              does capture the non-ergodic dynamics, and uses Monte Carlo simulations to give you a far 
              superior way of assessing if your venture / fund is likely to succeed. Or not. Because you now 
              account for real-world volatility, and so can identify and remedy risks standard tools hide.
            </p>
            <p className="text-sm opacity-80">
              This app is based on the book <i>The Ergodic Investor and Entrepreneur</i> by Graham Boyd and 
              Jack Reardon. 
            </p>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="w-full p-8 md:w-1/2">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          
          {error && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-500 border border-red-200 break-words whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your username"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="companyName">
                  Company / Organization Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isStudent}
                  className={`w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isStudent ? 'bg-gray-100 text-gray-500' : ''}`}
                  placeholder={isStudent ? "Individual" : "Enter company name"}
                  required={!isStudent}
                />
                <div className="mt-2 flex items-center">
                  <input
                    id="isStudent"
                    type="checkbox"
                    checked={isStudent}
                    onChange={handleStudentChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isStudent" className="ml-2 block text-sm text-gray-900">
                    I am a student / individual
                  </label>
                  <InfoTag content="Automatically sets Company Name to 'Individual' and disables the field. Use this if you don't have a registered business entity." />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your password"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <Link href="/register" className="font-medium text-blue-600 hover:underline">
                  Register
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:underline">
                  Login
                </Link>
              </p>
            )}
          </div>

          {/* Alpha Disclaimer (Bottom of White Card) */}
          <div className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-400">
            <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1">Disclaimer</p>
            <p>
              This app is provided for educational purposes only. The output is not advice in any form, 
              certainly neither investment nor legal advice. To the fullest extent of the law, no liability 
              will be accepted, neither by Evolutesix nor the author(s) for any loss related to this content. 
              This is an alpha release for early developmental testing, feedback, and educational purposes only.
              We may at any stage need to do a complete clean reset, at which point all of your data and 
              login details may be lost.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
</file>

