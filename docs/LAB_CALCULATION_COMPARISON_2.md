# Laboratory calculation comparison 2

Status: regression comparison for software review, not a SANAS approval statement.

| Workbook/sheet/cell | Application function | Spreadsheet relationship | Comparison | Review status |
| --- | --- | --- | --- | --- |
| Temperature DATA ENTRY reading groups | `calculateMeanReading` | Arithmetic mean of entered observations | Matching for approved numeric sample inputs within 1e-8 before display rounding | Automated regression passed |
| Temperature DATA ENTRY Type A cells | `calculateStandardError` | Sample standard deviation divided by square root of reading count | Application uses actual reading count; legacy six-reading workbook evidence includes a square-root-ten concern | Management decision required |
| Temperature Uncertainty M14/M15 and AH14/AH15 | `calculateUncertaintyBudget` | Sum of squared contributions then square root | Matching relationship for fabricated samples | Input/mapping approval required |
| Temperature Uncertainty M16/AH16 | `calculateUncertaintyBudget` | Combined uncertainty multiplied by coverage factor | Matching relationship for fabricated samples | Coverage factor approval required |
| Pressure DATA ENTRY result groups | `calculatePressurePoint` | UUT mean minus applied/reference pressure; correction is opposite sign | Matching named relationship for fabricated samples | Cell-by-cell historical dataset required |
| Pressure Uncertainty J6:J13 | no production equivalent approved | External `[1]reliability calculations` cells E34:E41 | Cannot reproduce because the linked workbook was not supplied as an authoritative source | Blocked for metrological approval |
| Blank SANAS templates | guarded validation | Cached `#DIV/0!` in empty input/output cells | Application rejects incomplete input instead of producing a certificate result | Behaviour approved only for mock safety |

The automated comparison process records spreadsheet source, formula, software function, results, difference and rounding. No unexplained formula was silently changed. Final approval remains with authorised Laboratory Management and the Technical Signatory.

