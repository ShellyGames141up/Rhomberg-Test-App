# Laboratory workbook review 2

Status: controlled implementation review only. This is not SANAS approval. The supplied workbook protection credential was used only during private analysis and is not stored in this repository, application code, documentation or public build.

## Sources reviewed

| Workbook | Sheets and purpose | Protection/formulas | Links and findings |
| --- | --- | --- | --- |
| Master Worksheet-Testsheet(QMS-Testsheet TMP).xlsx | Sheet1, A1:R44, worksheet layout | No protected sheet; 0 formulas; 76 merged ranges | Layout/reference form only. Inputs and certificate mappings require management confirmation. |
| Master Temperature Cert QMS7.2RHOM1.xlsx | CERTIFICATE, DATA ENTRY, Uncertainty Budget | 145 formulas across three sheets; 29 unlocked DATA ENTRY cells | One external link. DATA ENTRY G27 points to an external uncertainty workbook. |
| P11629-7 First Subsea 2500 bar | 250 MPa certificate, Uncertainty Budget, DATA ENTRY | 151 formulas; uncertainty sheet protected; 72 unlocked data-entry cells | External reliability-calculation references in uncertainty J6:J13. |
| P13127-216 Temperature Controls 600 kPa | CERTIFICATE, Master gauges, DATA ENTRY, Uncertainty Budget | 157 formulas; uncertainty sheet protected; 63 unlocked data-entry cells | Two external links. Certificate and uncertainty sheets reference external workbook indexes. |
| P13144-4 Micron Technologies 25 MPa | 70 000 kPa certificate, DATA ENTRY, Uncertainty Budget | 154 formulas; uncertainty sheet protected; 61 unlocked data-entry cells | External reliability-calculation references in uncertainty J6:J13. |
| SANAS_CERT_1.xlsx | CERTIFICATE, Master gauges, DATA ENTRY, Uncertainty Budget | 156 formulas; uncertainty sheet protected | Blank template contains cached `#DIV/0!` results in three data-entry and eleven uncertainty cells. |
| DWT Method R PL 12 - 250 MPa | Certificate, Uncertainty Budget, DATA ENTRY | 129 formulas; uncertainty sheet protected | External reliability links; blank-template cached division errors remain unresolved. |
| DWT Method R PL 3A - High Pressure | Certificate, DATA ENTRY, Uncertainty Budget | 143 formulas; uncertainty sheet protected | External reliability links; blank-template cached division errors remain unresolved. |

No defined names were present in the inspected converted workbooks. Certificate sheets primarily link identification and result cells from DATA ENTRY. Uncertainty sheets calculate standardised contributions, root-sum-of-squares combined uncertainty, effective degrees of freedom and expanded uncertainty. Input cells are concentrated in unlocked DATA ENTRY regions; calculated and certificate-output cells are formula-driven.

## Procedure sources

- Digital Thermometer PROC/2002:DT, Issue 1, January 2026.
- Mechanical Dial Thermometer PROC/2004:MD.
- Both specify 23 C +/- 5 C ambient, maximum 2 C/hour ambient change/gradient, ice-point preparation, sensor cleaning, appropriate matched immersion depth, tip proximity, stabilisation, paired readings at approximately one-minute intervals, at least six readings, ambient recording and satisfactory review before the next point.
- Type A is the standard deviation of the UUT mean. Type B examples are reference uncertainty/drift, source uncertainty/drift and UUT resolution.

## Calibration structures

Pressure software now enforces 6 Increasing + 5 Repeatability + 5 Decreasing records. Each record retains nominal/reference pressure, UUT indication, correction/error, standard, conditions, technician, timestamp and uncertainty result. The software does not infer missing legacy formulas.

Temperature software uses an unbounded list of calibration points. Every point carries nominal temperature, paired Reference Standard/UUT readings, actual timestamps, ambient temperature, immersion depth, stabilisation evidence, statistics, uncertainty, notes and satisfactory/review status. A minimum of six pairs is enforced; additional pairs are allowed.

## Approval questions

1. Confirm the authoritative reliability-calculation source replacing external workbook index `[1]`.
2. Confirm whether the Temperature external uncertainty reference in DATA ENTRY G27 is intentional.
3. Approve the exact mapping from Reference Standard readings and corrections to certificate-reported actual temperature.
4. Confirm rounding, coverage factor and effective-degrees-of-freedom policy per method/range.
5. Resolve cached division errors in blank master templates before production validation.
6. Approve each method version and comparison dataset through Laboratory Management and the Technical Signatory.

