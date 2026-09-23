# Landing demo story audit

Audited for the v11 landing page against the live calculation functions in `app.html`. The figures below use the same `loadDemoData()` portfolio opened by every guided-demo link. Monte Carlo figures use the saved seeds and 10,000 paths.

## Portfolio and allocation

- Household investment portfolio: **$265,000**, excluding the 529.
- Total including the 529: **$280,000**.
- Stocks: **81.1%** against a 65% target, or **+16.1 percentage points**.
- Bonds: **7.5%** against an 18% target, or **−10.5 percentage points**.
- The public site intentionally does not market an account count.

## Tax-location example

Illustrative assumptions: Single, $200,000–$400,000 income band, Massachusetts. FXNAX has a $20,000 market value in taxable Brokerage, confirmed long-term status, and cost basis equal to value in each sample snapshot. VOO is in the 401(k), preserving the prior household allocation.

- Modeled annual tax drag on FXNAX in taxable: **$359.92** (shown as about **$360**).
- Allocation-neutral FXNAX/FXAIX exposure swap: **$298.04** modeled annual reduction (shown as about **$298**).
- Modeled realization cost in the sample: **$0**, because sample basis equals value.
- Total modeled taxable drag across the sample portfolio: **$763.70**. This is retained for audit context and is not a headline claim.

Tax effects are simplified and may omit future taxes, plan restrictions, trading costs, and changes in yields or law. The landing page does not describe the 401(k) as permanently tax-free.

## Retirement example

- Current age 40; retirement age 65; model all non-529 accounts.
- Glide to the app's balanced 60/40 target.
- $90,000 annual after-tax spending in today's dollars.
- Annual contributions: $18,000 pre-tax, $7,000 Roth, and $6,000 taxable.
- Manual Social Security assumption: $3,500 per month beginning at 67.
- Seed 12345; 10,000 paths.

Results:

- Withdrawal confidence through age 95: **86.44%** (shown as **86%**).
- Median projected balance at retirement: **$1,948,595** (shown as **$1.95M**).
- 10th-percentile projected balance at retirement: **$1,110,198** (shown as **$1.11M**).
- 90th-percentile projected balance at retirement: **$3,499,761**.

The engine stores real geometric return assumptions and the Assumptions screen converts them to and from nominal inputs using the selected inflation rate. Landing results are shown in today's dollars.

## College example

- Maya is age 8 with $15,000 in the 529.
- Four college years begin at 18.
- $25,000 annual cost and $9,000 annual contributions, both in today's dollars.
- The saved age-based allocation glide is used.
- Seed 24680; 10,000 paths.

Results:

- Probability all four years are fully funded: **86.64%** (shown as **87%**).
- Average years fully funded: **3.8652 of 4** (shown as **3.9 of 4**).
- Median balance after the first college-year draw: **$90,717**.

The landing page does not call 87% a “funding percentage” and does not publish an expected dollar gap because the engine does not calculate either measure.

## Decision record

- **Decided:** direct the next contribution toward underweight bonds.
- **To reconsider:** an allocation-neutral FXNAX/FXAIX location swap after confirming plan fund availability and tax details.
- **Why:** stocks are +16.1 percentage points over the household target and bonds are −10.5 percentage points under it.

## Required public qualification

Illustrative sample data and assumptions. Estimates, not forecasts or guarantees. Tax effects are simplified and may omit future taxes, plan restrictions, trading costs, and changes in yields or law. Not investment, tax, or legal advice.
