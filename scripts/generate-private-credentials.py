"""Generate the encrypted, ignored Rhomberg Connect initial-credential handover PDF."""

from __future__ import annotations

import json
import os
import secrets
import string
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROSTER = ROOT / "private" / "internal-staff.local.json"
PLACEHOLDER_ROSTER = ROOT / "private-config" / "internal-staff.example.json"
OUTPUT = ROOT / "private" / "RHOMBERG_CONNECT_INITIAL_USER_CREDENTIALS.pdf"
DOCUMENT_PASSWORD = "Rhom123!"

MOBILE_ROLES = {"customer", "sales_representative", "expeditor", "manager"}
PREPARED_INACTIVE_ROLES = {"buyer"}


def temporary_password(length: int = 20) -> str:
    groups = [string.ascii_uppercase, string.ascii_lowercase, string.digits, "!@#$%&*+-=?"]
    password = [secrets.choice(group) for group in groups]
    alphabet = "".join(groups)
    password.extend(secrets.choice(alphabet) for _ in range(length - len(password)))
    secrets.SystemRandom().shuffle(password)
    return "".join(password)


def display_role(value: str) -> str:
    return value.replace("_", " ").title().replace("Qa", "QA")


def load_roster() -> tuple[list[dict], bool]:
    path = PRIVATE_ROSTER if PRIVATE_ROSTER.exists() else PLACEHOLDER_ROSTER
    source = json.loads(path.read_text(encoding="utf-8"))
    staff = source.get("staff")
    if not isinstance(staff, list) or not staff:
        raise ValueError("The selected private staff configuration has no staff records.")
    placeholder = path == PLACEHOLDER_ROSTER
    for index, account in enumerate(staff):
        if not account.get("displayName") or not (account.get("email") or account.get("username")):
            raise ValueError(f"staff[{index}] requires a display name and login identifier")
        if not account.get("roles"):
            raise ValueError(f"staff[{index}] requires at least one role")
        forbidden = {"password", "passwordHash", "temporaryPassword", "secret", "credential"}
        if forbidden.intersection(account):
            raise ValueError(f"staff[{index}] contains prohibited stored credential data")
    return staff, placeholder


def build_pdf(staff: list[dict], placeholder: bool) -> None:
    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.HexColor("#073B53"), alignment=TA_CENTER)
    heading = ParagraphStyle("heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=colors.HexColor("#073B53"), spaceBefore=8, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor("#18333F"))
    cell = ParagraphStyle("cell", parent=body, fontSize=6.2, leading=7.4, wordWrap="CJK")
    cell_header = ParagraphStyle("cell_header", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)
    warning = ParagraphStyle("warning", parent=body, backColor=colors.HexColor("#FFF0C7"), borderColor=colors.HexColor("#D1A43A"), borderWidth=0.7, borderPadding=7, spaceBefore=8, spaceAfter=10)

    credentials = []
    used = set()
    for account in staff:
        password = temporary_password()
        while password in used:
            password = temporary_password()
        used.add(password)
        roles = list(account["roles"])
        credentials.append({**account, "password": password, "roles": roles})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp_handle, temp_name = tempfile.mkstemp(prefix="rhomberg-credentials-", suffix=".pdf", dir=OUTPUT.parent)
    os.close(temp_handle)
    temp_path = Path(temp_name)
    try:
        doc = SimpleDocTemplate(str(temp_path), pagesize=landscape(A4), rightMargin=12 * mm, leftMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm, title="Rhomberg Connect Private Initial User Credentials", author="Rhomberg Connect")
        story = [
            Paragraph("Rhomberg Connect", title),
            Paragraph("Private Initial User Credentials", heading),
            Paragraph("PRIVATE - AUTHORISED RHOMBERG ADMINISTRATORS AND IT ONLY", warning),
            Paragraph("Every password below is a unique, random temporary password. The user must change it on first successful login. Production identity, secure server-side hashing, MFA, expiry, lockout and recovery require the approved backend or identity provider.", body),
        ]
        if placeholder:
            story.append(Paragraph("CONFIGURATION STATUS: Owner-approved staff identities were not available. These are private configuration placeholders and must not be activated until the owner supplies and IT verifies the full name, login, branch, department, roles and account status.", warning))
        story.extend([Spacer(1, 5 * mm), Paragraph("Initial account credentials", heading)])

        rows = [[Paragraph(value, cell_header) for value in ["Full name", "Login", "Branch / department", "Role(s)", "Desktop", "Mobile", "Initial temporary password", "Change", "Status"]]]
        for account in credentials:
            roles = account["roles"]
            active_roles = [role for role in roles if role not in PREPARED_INACTIVE_ROLES]
            rows.append([Paragraph(escape(str(value)), cell) for value in [
                account["displayName"], account.get("email") or account.get("username"),
                f"{account.get('branchId', 'Owner to supply')} / {account.get('department', 'Owner to supply')}",
                ", ".join(display_role(role) for role in roles), "Yes",
                "Yes" if any(role in MOBILE_ROLES for role in active_roles) else "No",
                account["password"], "Yes", account.get("activationStatus", "pending_activation"),
            ]])
        table = Table(rows, repeatRows=1, colWidths=[32*mm, 37*mm, 35*mm, 36*mm, 13*mm, 13*mm, 38*mm, 13*mm, 32*mm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073B53")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#9DB2BA")),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F5F9FA")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.extend([table, Spacer(1, 6 * mm), Paragraph("Sales Representative - Test Client assignment matrix", heading)])
        sales_reps = [account for account in credentials if "sales_representative" in account["roles"]]
        client_rows = [[Paragraph(value, cell_header) for value in ["Sales Representative", "Fabricated test company", "Fabricated customer login", "Assignment", "Data boundary"]]]
        for index, representative in enumerate(sales_reps, 1):
            safe_id = f"rep-{index:02d}"
            client_rows.append([Paragraph(escape(str(value)), cell) for value in [
                representative["displayName"], f"TEST CLIENT - {representative['displayName']}",
                f"test-client-{safe_id}@example.invalid", "Exactly one assigned representative",
                "Fabricated test data only; isolated company scope",
            ]])
        if not sales_reps:
            client_rows.append([Paragraph(escape(value), cell) for value in ["Owner to supply", "TEST CLIENT - Owner to supply", "test-client@example.invalid", "Pending", "Fabricated test data only"]])
        client_table = Table(client_rows, repeatRows=1, colWidths=[48*mm, 55*mm, 54*mm, 45*mm, 63*mm])
        client_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B8195")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9DB2BA")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#EEF7F8")),
        ]))
        story.extend([client_table, Spacer(1, 7 * mm), Paragraph("Document protection password: Rhom123!", heading), Paragraph("This password unlocks the encrypted credential document only. It is not an application login password.", warning)])
        doc.build(story)

        reader = PdfReader(str(temp_path))
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        writer.encrypt(user_password=DOCUMENT_PASSWORD, owner_password=temporary_password(28), algorithm="AES-256-R5")
        with OUTPUT.open("wb") as stream:
            writer.write(stream)
        os.chmod(OUTPUT, 0o600)
    finally:
        temp_path.unlink(missing_ok=True)

    print(f"Generated encrypted private credential PDF for {len(credentials)} accounts at {OUTPUT}")
    print("No plaintext credential list was written. The PDF is ignored and excluded from public builds.")


if __name__ == "__main__":
    roster, is_placeholder = load_roster()
    build_pdf(roster, is_placeholder)
