# Responsive UI Guidelines

Rhomberg Connect uses one shared responsive system across Customer, Sales, Technical, Planning, Laboratory, Quality Assurance, Dispatch, Management, Audit, Archive and Administration workspaces.

## Data displays

- Large desktop: complete tables or aligned operational rows.
- Tablet: compressed columns, reduced spacing and horizontal scrolling only inside the data region when required.
- Mobile: one record per card, labelled values, full-width actions and no page-level horizontal scrolling.

The shared `responsive-data-display` CSS contract also targets the established role-specific queue and table classes. New data views should use semantic table markup when the relationship is tabular, add `data-label` to mobile table cells, keep essential identifiers visible, and move secondary detail into an expandable section.

Actions must remain keyboard accessible, touch targets should be at least 44 px, and status must never be communicated by colour alone. Long references may wrap, but currency, dates and short numeric values should remain intact where space permits.

## Forms

- Desktop forms use two columns when fields are naturally related; dense operational scope selectors may use three.
- Tablet forms use one or two columns based on the available field width.
- Mobile forms always use one column. Full-width fields and actions return to normal flow rather than retaining desktop grid spans.

Never keep paired fields side by side when either label, input value, help text or validation message becomes cramped. Text areas, document inputs, confirmation statements and important actions should span the available width.
