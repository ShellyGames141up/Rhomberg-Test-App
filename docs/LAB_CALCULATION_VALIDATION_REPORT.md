# Laboratory calculation validation report

Status: **mock implementation verified; technical approval outstanding**.

Automated tests cover mean, indication error, correction, sample standard deviation, standard error, uncertainty combination, effective degrees of freedom, rounding, method separation, standard range/branch matching and invalid workflow transitions. Fabricated examples are used in committed tests. Private comparison of the supplied completed workbooks confirmed the general mean/error/repeatability structure but found the missing reliability-workbook links and Temperature reading-count inconsistency documented in `LAB_TEMPLATE_ANALYSIS.md`.

Before production, authorised Laboratory Management and Technical Signatories must decide and record:

1. approved formula and revision for every method;
2. the controlled source for coverage factors/reliability values;
3. the Temperature repeatability count and standard-error denominator;
4. approved uncertainty sources, distributions, divisors and degrees of freedom;
5. rounding and significant-figure rules per certificate field;
6. range limits and reference-standard suitability rules;
7. acceptance limits and claimed measurement capabilities;
8. certificate wording, signatory rules and SANAS/Traceable applicability.

Production release is blocked until approved golden datasets pass independently reviewed expected results with tolerances, evidence and sign-off.
