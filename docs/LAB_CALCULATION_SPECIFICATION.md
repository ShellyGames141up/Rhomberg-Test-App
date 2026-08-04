# Laboratory calculation specification

All calculations live in `src/domain/laboratoryCalibration.js`; UI components do not contain formula logic.

| Result | Definition |
|---|---|
| Mean | Sum of valid readings divided by reading count |
| Indication error | measured mean minus applied reference |
| Correction | applied reference minus measured mean |
| Repeatability | sample standard deviation, denominator `n - 1` |
| Standard error | sample standard deviation divided by square root of the actual reading count |
| Percent full scale | value divided by full-scale value, multiplied by 100 |
| Standard uncertainty | stated uncertainty divided by its approved divisor |
| Contribution | standard uncertainty multiplied by sensitivity coefficient |
| Combined uncertainty | root-sum-square of contributions |
| Effective degrees of freedom | Welch-Satterthwaite approximation |
| Expanded uncertainty | combined uncertainty multiplied by coverage factor |

Pressure outputs mean, corrected mean, indication error, correction, repeatability and percent full scale. Temperature outputs mean, corrected indication, correction, standard deviation and standard error. Intermediate calculations retain precision; explicit output rounding happens at the controlled result boundary. Inputs must be finite, ranges non-zero, and budgets non-empty.

Claimed uncertainty must never be better than the validated calculated capability. Method versions, raw-data revisions, standards and formula-review evidence are recorded with each result.
