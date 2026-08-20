# Production Asset Allowlist

The Windows staging production build copies only the files explicitly declared in `scripts/production-assets.mjs`. A build validation fails if the generated artifact is missing an approved file or contains an unapproved file.

## Approved categories

- Official Rhomberg Connect logos, symbol, gauge mark, PWA icons and favicon
- Category imagery used by the product catalogue
- The WebP product images referenced by the current product catalogue
- The five customer-facing catalogue PDF candidates listed below

The complete machine-readable list is maintained once in `scripts/production-assets.mjs`; documentation must not become a second build authority.

## Public catalogue PDF review

| File | Apparent purpose | Packaging assessment |
| --- | --- | --- |
| `assets/datasheets/PBB-product-sheet.pdf` | PBB product information | Approved for the Windows staging static frontend. |
| `assets/datasheets/Pressure-gauge-ordering-guide.pdf` | Pressure gauge selection guidance | Approved for the Windows staging static frontend. |
| `assets/datasheets/RPT106-product-sheet.pdf` | RPT106 product information | Approved for the Windows staging static frontend. |
| `assets/datasheets/Temperature-ordering-guide.pdf` | Temperature instrument selection guidance | Approved for the Windows staging static frontend. |
| `assets/datasheets/Utility-gauge-overview.pdf` | Utility gauge overview | Approved for the Windows staging static frontend. |

Ericu approved these five documents for the staging static frontend on 20 August 2026. This staging approval does not automatically approve the documents for production or unrestricted external publication.

## Change control

Adding an asset requires all of the following:

1. Confirm that the production UI genuinely references it.
2. Obtain the appropriate branding, commercial and document-control approval.
3. Confirm that it contains no personal information, credentials, protected pricing, internal notes or restricted metadata.
4. Add its repository-relative path to `scripts/production-assets.mjs`.
5. Run the production build, artifact scanner and full tests.
6. Review the resulting release manifest and checksums.
