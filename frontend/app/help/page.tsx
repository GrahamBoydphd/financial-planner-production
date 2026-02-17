import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ExpandableVideo from '@/components/ui/ExpandableVideo';

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
  { label: "Initial Amount", purpose: "Starting revenue amount.", rules: "Required number." },
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
  { label: "Initial Amount", purpose: "Starting expense amount.", rules: "Required number." },
  { label: "Growth Rate (%/mo)", purpose: "Monthly growth rate percentage.", rules: "Optional number." },
  { label: "% of Revenue", purpose: "Percentage of revenue tied to expense.", rules: "Optional number." },
  { label: "Frequency", purpose: "How often expense is incurred.", rules: "Select: Monthly, One-time, Quarterly, Annually." },
  { label: "Start Month", purpose: "Month in which expense begins.", rules: "Required number." },
  { label: "End Month (Opt)", purpose: "Month in which expense ends.", rules: "Optional number." },
  { label: "Volatility Inputs", purpose: "Same model options as Revenue.", rules: "See Revenue Volatility." },
];

const capitalData = [
  { label: "Source Name", purpose: "Name of the capital source (e.g., Seed Round).", rules: "Required, must not be empty." },
  { label: "Amount", purpose: "Amount of capital injection.", rules: "Required number." },
  { label: "Month", purpose: "Month in which capital is injected.", rules: "Required integer 1-120." },
];

const capitalGrowthData = [
  { label: "Model Type", purpose: "Type of volatility model to apply.", rules: "Selection required." },
  { label: "Expected Return", purpose: "Expected monthly return percentage.", rules: "Required number." },
  { label: "Volatility Params", purpose: "Min/Max (Simple) or Distribution params.", rules: "Dependent on Model Type." },
];

const dividendData = [
  { label: "Enable Dividends", purpose: "Toggle dividends payout.", rules: "Boolean." },
  { label: "Safety Threshold", purpose: "Minimum cash balance required before dividends are paid.", rules: "Required number." },
  { label: "Payout Percentage", purpose: "Percentage of surplus cash distributed as dividends.", rules: "Required number 0-100." },
];

const creditData = [
  { label: "Max Limit", purpose: "Maximum credit facility limit.", rules: "Required number." },
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
    <Layout>
      <div className="flex gap-8">
        {/* Sidebar Navigation - Sticky */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="sticky top-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-xl font-bold text-indigo-600 mb-6">Help Topics</h1>
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
        <div className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto space-y-16">
            
            {/* Welcome Hero Section (Visible only to new arrivals) */}
            {isNewUser && (
              <div className="bg-indigo-600 rounded-lg shadow-md p-8 text-white">
                <h2 className="text-3xl font-bold mb-4">Welcome to Evolutesix's planner with real-world volatility<br/>For founders and investors</h2>
                <div className="space-y-4 text-indigo-100 text-lg">
                  <p>
                    Congratulations on starting your journey. This alpha release Financial Planner helps founders and investors understand how a business or fund is likely to behave under real-world uncertainty.
                  </p>
                  <p>
                    Instead of projecting a single “expected” outcome, the tool stress-tests your plan across thousands of possible paths, revealing how sensitive your business is to the volatility you already can estimate, as well as white and black swan events, where volatility creates hidden risk or opportunity, and where strategic choices meaningfully reduce the chance of failure.
                  </p>
                  <p>
                    The result is a clearer insight into survival and resilience, as well as upside opportunities and downside risk — so you can optimise strategies, adjust assumptions, and make better-informed decisions before capital and time are committed.
                  </p>
                  
                  <p>
                    Use this guide to understand our risk-based modeling before building your first plan. 
                  </p>
                  <ExpandableVideo videoId='RpHR-XkiYhw' />
                  <p>
                    <strong>Or watch the quick-start
                    <Link href="https://youtu.be/RpHR-XkiYhw" className="text-yellow-300 hover:underline"> video</Link>!</strong>
                  </p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Dashboard:</strong> Navigate to the <Link href="/" className="text-yellow-300 hover:underline">Dashboard</Link> to see all of your funds and companies.
                      <ul className="list-disc pl-5 mt-1">
                      <li> Get started by copying one of our templates. Play with it, edit it, have fun experimenting!</li> 
                      <li> Click on a company to edit the inputs and see the company level projections. </li>
                      <li> Click on a fund to create fund scenarios and see the projections.</li>
                      <li> <strong> Take care: there is no protection against physically impossible parameters. 
                           Impossible input will give you impossible results!</strong> </li>
                    </ul>
                    </li>
                    <li>                      
                    <strong>Structure:</strong> Go to the <Link href="/structure" className="text-yellow-300 hover:underline">Structure (Funds & Companies)</Link> page to create your first Fund and Company.
                    </li>
                    <li>
                      <strong>Company Inputs:</strong> Click on one of your companies to enter its workspace. If you want a new business plan scenario, click on New Scenario. Otherwise go to the business plan you want, click on Edit Inputs to begin / change the data, or View Results if your input data is complete to go straight to the Projections tab. Use the tabs to enter:
                      <ul className="list-disc pl-5 mt-1">
                        <li>Revenue items, Expense items, and Staffing items.</li>
                        <li>Initial cash on hand, Investment rounds, Credit facilities.</li>
                        <li>Treasury management, and Valuation model.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Fund Inputs:</strong> Click on one of your funds to enter its workspace. If you want a new fund scenario, click on New Scenario. Otherwise go to the fund scenario you want, click on Edit Scenario to alter the plans each company runs, or View Results if your input data is complete to go straight to the Projections tab. 
                    </li>
                    <li>
                      <strong>Projections:</strong> Finally, go to the Projections page. Use the <strong>dropdown menu</strong> to switch between views:
                      <ul className="list-disc pl-5 mt-1">
                        <li><strong>Conventional:</strong> Standard deterministic planning, as used in MPT for funds, or typical business planning.</li>
                        <li><strong>Real World:</strong> Single-company real world volatility planning. Step through 1000 equally likely typical real-world outcomes.</li>
                        <li><strong>Likely real-world outcomes:</strong> Fan plot of the spread of all 1000 real world most likely outcomes.</li>
                      </ul>
                    </li>
                  </ol>
                  
                </div>
                <div className="mt-8">
                <Link 
                  href="/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 shadow-sm"
                >
                  Go to Dashboard
                </Link>
                </div>
              </div>
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
                  <h3 className="font-bold text-yellow-800">Alpha Release Warning</h3>
                  <div className="mt-2 text-yellow-700">
                    <p>
                      This software is in Alpha. These financial models are probabilistic projections using specific input parameters
                      estimating future volatility. They are not in any way guarantees. 
                      Results should be used for strategic planning and scenario analysis only, not as advice for any purpose, 
                      certainly not as tax or investment advice.
                    </p>
                  </div>
                </div>
              </div>
            </div>


            {/* Quick Start Guide (Subsequent Visits) */}
            {!isNewUser && (
              <section id="quick-start" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start Guide</h2>
                <div className="prose prose-indigo text-gray-600 max-w-none space-y-4">
                  <p>
                    Use this guide to understand our risk-based modeling before building your first plan. 
                  </p>
                  <ExpandableVideo videoId='RpHR-XkiYhw' /> 
                  <p>
                    <strong>Or watch the quick-start 
                    <Link href="https://youtu.be/RpHR-XkiYhw" className="text-indigo-600 hover:underline"> video</Link>!</strong>
                  </p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Dashboard:</strong> Navigate to the <Link href="/" className="text-indigo-600 hover:underline">Dashboard</Link> to see all of your funds and companies.
                      <ul className="list-disc pl-5 mt-1">
                        <li> Get started by copying one of our templates. Play with it, edit it, have fun experimenting!</li> 
                        <li> Click on a company to edit the inputs and see the company level projections. </li>
                        <li> Click on a fund to create fund scenarios and see the projections.</li>
                        <li> <strong> Take care: there is no protection against physically impossible parameters. 
                           Impossible input will give you impossible results!</strong> </li>                    
                      </ul>
                    </li>
                    <li>                      
                    <strong>Structure:</strong> Go to the <Link href="/structure" className="text-indigo-600 hover:underline">Structure (Funds & Companies)</Link> page to create your first Fund and Company.
                    </li>
                    <li>
                      <strong>Company Inputs:</strong> Click on one of your companies to enter its workspace. If you want a new business plan scenario, click on New Scenario. Otherwise go to the business plan you want, click on Edit Inputs to begin / change the data, or View Results if your input data is complete to go straight to the Projections tab. Use the tabs to enter:
                      <ul className="list-disc pl-5 mt-1">
                        <li>Revenue items, Expense items, and Staffing items.</li>
                        <li>Initial cash on hand, Investment rounds, Credit facilities.</li>
                        <li>Treasury management, and Valuation model.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Fund Inputs:</strong> Click on one of your funds to enter its workspace. If you want a new fund scenario, click on New Scenario. Otherwise go to the fund scenario you want, click on Edit Scenario to alter the plans each company runs, or View Results if your input data is complete to go straight to the Projections tab. 
                    </li>
                    <li>
                      <strong>Projections:</strong> Finally, go to the Projections page. Use the <strong>dropdown menu</strong> to switch between views:
                      <ul className="list-disc pl-5 mt-1">
                        <li><strong>Conventional:</strong> Standard deterministic planning, as used in MPT for funds, or typical business planning.</li>
                        <li><strong>Real World:</strong> Single-company real world volatility planning. Step through 1000 equally likely typical real-world outcomes.</li>
                        <li><strong>Likely real-world outcomes:</strong> Fan plot of the spread of all 1000 real world most likely outcomes.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {/* Introduction */}
            <section id="intro" className="scroll-mt-24">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">Antifragile Financial Modeling</h1>
              <div className="prose prose-indigo text-gray-600 max-w-none">
                <p className="text-xl leading-relaxed">
                  <ExpandableVideo videoId='Xlnqf4GvqkU' />
                  Traditional approaches to company financial planning, and modern portfolio theory approaches to hitting the right 
                  risk-return profile for a fund extrapolate averages. But, because of how volatility in reality actually plays out, 
                  this excessively simplified approach is misleading. 
                  Our engine prioritizes 
                  <span className="font-bold text-gray-900"> "reality over premature simplicity"</span> by modeling 
                  non-ergodic path dependence—meaning the order of events matters. Because averages are fundamentally misleading.
                  Especially if your intent is regenerative, systemic, circular, doughnut, etc.
                </p> 
                <p className="text-xl leading-relaxed">
                  Many of you know that a 50% drop followed by a 50% gain leaves you with 75% of your starting capital, not 100%.
                  But not many know the consequence of all aspects of this kind of volatile growth, called non-ergodic growth.  
                  Because it can't be calculated with pen and paper, only laborously simulated with computers!
                  We simulate hundreds of equally likely real-world trajectories to show you your likelihood of ruin or success, 
                  not just the average outcome.
                  This approach helps you build an "Antifragile" strategy that can withstand and potentially benefit from volatility.
                </p>
              </div>
            </section>

            {/* Hierarchy */}
            <section id="hierarchy" className="scroll-mt-24">
              <div className="border-b border-gray-200 pb-4 mb-8">
                <h2 className="text-3xl font-bold text-gray-900">How the modelling is structured</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">🏛️</div>
                  <h3 className="text-lg font-bold text-gray-900">Fund</h3>
                  <p className="mt-2 text-gray-500">The top-level container. Represents your investment firm or holding entity. Invests in the Company.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">🏢</div>
                  <h3 className="text-lg font-bold text-gray-900">Company</h3>
                  <p className="mt-2 text-gray-500">A specific business entity. Contains historical data and settings; and prediction parameters for future scenarios. Needs multiple plans in order to navigate into the future.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="text-4xl mb-4">📄</div>
                  <h3 className="text-lg font-bold text-gray-900">Plans</h3>
                  <p className="mt-2 text-gray-500">A specific business plan scenario (e.g., "Series A Base") for the company.</p>
                </div>
              </div>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="scroll-mt-24">
              <div className="border-b border-gray-200 pb-4 mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Best practices reading the results, choosing parameters</h2>
              </div>
              
              <div className="space-y-12">
                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">1. The Three-Tier Approach</h3>
                  <p className="text-gray-700 mb-4">
                    Don't rely on a single number. We recommend creating three distinct Plans for every Company:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    <li><strong>Base Case (P50):</strong> Your honest expectation. Standard growth, standard churn.</li>
                    <li><strong>Optimistic (P90):</strong> The "White Swan" scenario. Everything goes right. </li>
                    <li><strong>Stress Test (P10):</strong> The "Black Swan" scenario. Everything goes wrong.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">2. Iterative Modeling & The Liquidity Gap</h3>
                  <p className="text-gray-700 mb-4">
                    Financial modeling is a loop, not a line. Use the simulation results to find your breaking point.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-gray-600">
                    <li>Run the simulation (1000+ iterations).</li>
                    <li>Check the <strong>Cash Balance</strong> chart. Look for the <strong>P10 (10th Percentile)</strong> line.</li>
                    <li>Identify the "Liquidity Gap"—the month where the P10 line dips below zero.</li>
                    <li>Return to the <strong>Capital</strong> form and inject a bridge round or credit facility one month prior to the gap.</li>
                    <li>Re-run to verify survival. Increase the duration to see if you just get another downturn.</li>
                    <li>Try out different levels of ergodicity correction. How does that help?</li>
                  </ol>
                  <p className="text-gray-700 mt-4 bg-indigo-50 p-4 rounded-md border-l-4 border-indigo-500">
                    <strong>Cash vs. Accrual:</strong> This model uses Cash Basis accounting. Revenue is recognized when cash is received, and expenses are recognized when cash is paid out. This is critical for startup survival modeling, as "profit" on paper does not pay the bills. Ensure your inputs reflect cash movements (e.g., if you invoice in Jan but get paid in Mar, enter the revenue start month as Mar).
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">3. The Starter Strategy for growth parameters</h3>
                  <p className="text-gray-700 mb-4">
                    If you are unsure where to begin, we recommend starting with <strong>Flat Volatility</strong>. This establishes a baseline range without the complexity of heavy-tailed distributions.
                  </p>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-lg">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Starter Configuration</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li><strong>Model Type:</strong> Simple Model</li>
                      <li><strong>Mean:</strong> 1.34% <span className="text-gray-400">(Average Monthly Growth, calculated from min and max)</span></li>
                      <li><strong>Min %:</strong> -30.00% <span className="text-gray-400">(Worst Month; negative means loss)</span></li>
                      <li><strong>Max %:</strong> 32.68% <span className="text-gray-400">(Best Month)</span></li>
                      <li><strong>Steps:</strong> 1 or 2 (smaller means higher volatility; best to stay below 5)</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-indigo-600 mb-3">4. Advanced Strategy for growth parameters</h3>
                  <p className="text-gray-700 mb-4">
                    For specific risk profiles, use these tested configurations to model asymmetric or fat-tailed risks:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h4 className="font-bold text-indigo-900">Comprehensive (Asymmetric & broad & fat-tailed risk)</h4>
                      <p className="text-xs text-indigo-700 mb-3">Recommended when you want to go beyond the simple min-max-average.</p>
                      <ul className="text-sm text-indigo-800 space-y-1">
                        <li><strong>Simple Mode:</strong> Choose from the pull-down options.</li>
                        <li><strong>Advanced Mode:</strong> Take out your stats texts and calculate!</li>
                      </ul>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-gray-900">Student's-T (Fat Tails)</h4>
                      <p className="text-xs text-gray-600 mb-3">For those who want it. Lacks certain useful aspects of the Comprehensive. </p>
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
        </div>
      </div>
    </Layout>
  );
}
