# Laboratory launch workflow

> The initial production scope uses a simplified Laboratory certificate-upload workflow. Detailed technician calibration worksheets and calculation functionality are deferred to a future Laboratory phase.

## Launch scope

Only Laboratory Managers are active. The owner-approved private roster contains one combined Pressure/Temperature manager and one Pressure manager; identities and credentials stay outside the public repository. Fabricated preview access uses the single Laboratory Manager demo identity. Laboratory User, Technician, Temperature Technician, Technical Signatory and Laboratory Administrator workspaces are `future_inactive`.

The launch path is:

1. A configured product requests **Yes — SANAS** or **Yes — Traceable**.
2. The customer selects **My Company** or **My Client** for that configured unit.
3. RFQ submission freezes the recipient name/address as a unit-level snapshot.
4. The order appears in the permitted manager's certificate queue.
5. The manager opens the order and uploads one final PDF for each physical unit, with certificate number, date, serial number and association confirmation.
6. A unit becomes **Certificate Uploaded**. The task remains active until all physical units are complete.
7. The completed task moves to **Completed Certificates** and remains searchable.
8. Authorised customers and internal users download the current certificate through the service layer; every upload, replacement and download is audited.

## Discipline scope

- Pressure manager: Pressure SANAS units only.
- Combined manager: Pressure SANAS and Temperature Traceable units.
- Managers with an explicit Temperature manager role: Temperature Traceable units.

## Replacement and privacy

Replacing a certificate requires a new PDF and reason. The prior version is marked `superseded`; it is not silently overwritten. Customers receive only the current customer-visible version for their own company/order. Production must use authenticated private object storage, backend MIME/signature/size validation, malware scanning, row-level company isolation and immutable audit storage.

## Deferred functionality

Receipt/stabilisation, inspection, booking-in, technician assignment, raw worksheets, calibration points, uncertainty calculations, method selection, technician sign-off, management raw-data review, draft compilation and external-signature orchestration are not exposed at launch. Historical domain material is retained only for future review and is not a production claim.
