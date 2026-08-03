# Management analytics

The Company Owner dashboard now combines operational oversight with a restricted commercial-performance section. The Sales Manager receives the same representative-related commercial analysis and may narrow it to one representative or branch. Ordinary Managers, Administrators, representatives and customers do not receive quotation totals or commercial PDF reports.

## Commercial measures

- total quotations for the selected period;
- converted-order value overall, monthly, by representative and by branch;
- quote-to-order and quote-to-loss ratios overall and per representative;
- monthly new-client growth overall and per representative;
- delayed or held orders that have passed a recorded promise date;
- value coverage, so missing quotation values are disclosed rather than estimated;
- stage averages displayed as days and hours.

The browser mock reads the machine-readable fields in the current Rhomberg Reporting Services quotation PDF format, including quote number, quote date, expiry, subtotal, VAT and `TOTAL ZAR`. The representative must verify the extracted total before confirming the quotation. Commercial values are stripped from normal record projections and are used only by the restricted management service.

Converted-order value counts only verified quotation totals associated with converted orders. Quote-to-order ratio is converted quotations divided by all quoted cases. Quote-loss ratio is quoted RFQs recorded as cancelled or expired without conversion divided by all quoted cases. New clients are counted from the first authorised record for each company.

## Management PDF

The Company Owner and Sales Manager can generate an audited PDF for rolling periods of 1, 3, 6, 12, 24 or 36 months, or an explicit start and end date. They may select individual report sections. The Sales Manager can also select a representative or branch. The report is marked `RESTRICTED MANAGEMENT REPORT`, includes page numbers and contains only records within the caller's authorised company scope.

## Production requirements

The GitHub Pages implementation is a fabricated mock. Production must parse quotation PDFs in a private backend after MIME/signature checks, size limits, malware scanning and encrypted private-object storage. Preserve the source-file hash and parser version, add OCR only as a controlled fallback, require human verification for uncertain fields and log corrections as new audit events. Commercial aggregates and PDFs must be calculated after company and role authorisation; files should use short-lived download links and retention approved by Rhomberg and IT.

All quantity metrics continue to sum line-item quantities rather than order rows. Timing uses immutable workflow timestamps. No protected price-engine, margin or staff-only data is added to customer responses.
