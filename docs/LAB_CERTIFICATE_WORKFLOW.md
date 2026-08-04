# Laboratory certificate workflow

Certificate states are draft, management review, approved for signature, awaiting signed certificate, signed uploaded and released. Draft and internal review PDFs are watermarked/classified and are never customer-visible. Final unsigned PDFs are signed outside the application using Rhomberg's approved PDF process.

On re-upload, the mock accepts PDF only, validates metadata, calculates SHA-256, creates an immutable version and supersedes—not deletes—the previous active version. A signature image is not cryptographic validation. Production must verify the signing certificate, trust chain, timestamp, revocation and document integrity server-side. Release requires management permission and an explicit `representative_only` or `customer_and_representative` rule. Every generation, upload, release and download is audited.
