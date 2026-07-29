# Product analytics

`src/domain/analytics.js` groups fabricated order items by product/model and sums quantities across month and year periods. It reports total units, monthly/yearly totals, top/slow-moving products, certification requirements, QA failures and turnaround indicators.

Classification uses the product catalogue identifiers and families already stored with RFQ/order items. Unknown products remain under an explicit uncategorised label rather than being silently discarded.

Production calculations must run against company-authorised data, apply the same status/date definitions, retain period boundaries in the business timezone and avoid employee-blame metrics. No price, cost, margin or revenue fields are needed for product-volume reporting.
