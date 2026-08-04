# Laboratory template analysis

## Evidence reviewed

The analysis covered the supplied blank Pressure worksheet, Temperature workbook, three Pressure master-certificate families and three historical completed examples. Source files were opened read-only, never modified, and kept outside the public repository. Public fixtures use invented customers, serials and readings.

## Confirmed template families

- Pressure master-gauge comparison for low-pressure ranges.
- Pressure 700 bar deadweight-tester method.
- Pressure 250 MPa primary deadweight-tester method.
- Temperature comparison worksheet, certificate and uncertainty budget.

Pressure and Temperature have materially different layouts, methods and uncertainty sources and must remain separate. The Pressure worksheet uses ascending/descending observations, means, error and repeatability. The Temperature workbook uses six observations, mean/correction and a dedicated budget.

## Validation findings

- Pressure budget templates contain eight links to a missing legacy reliability-calculation workbook. The affected coverage-factor lookup cannot be accepted silently.
- The Temperature certificate contains an external workbook link that resolves as `#REF!` without the source.
- Temperature repeatability groups visibly contain six readings while a legacy standard-error expression divides by the square root of ten. Management must confirm the intended repeat count or formula.
- A Temperature drift row can produce `#VALUE!` when supplied text and numeric assumptions differ.
- Blank legacy sheets naturally contain division errors until readings exist; the application replaces those with friendly validation states.

No formula was silently corrected. The mock uses explicit, testable formulas and surfaces the discrepancies as formal-review warnings. Original templates remain the controlled reference pending approval.
