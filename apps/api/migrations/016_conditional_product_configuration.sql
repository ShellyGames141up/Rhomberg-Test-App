-- Align persisted catalogue schemas with the configurator's conditional-field rules.
-- A custom range description is required only when the customer or representative
-- explicitly selects the custom-range option.

UPDATE app.products AS product
SET configuration_schema = (
  SELECT jsonb_agg(
    CASE
      WHEN field.value->>'key' = 'customRange'
        THEN jsonb_set(
          field.value,
          '{showWhen}',
          '{"key":"range","value":"Custom range - sales review"}'::jsonb,
          true
        )
      ELSE field.value
    END
    ORDER BY field.ordinality
  )
  FROM jsonb_array_elements(product.configuration_schema) WITH ORDINALITY AS field(value, ordinality)
)
WHERE product.configuration_schema @> '[{"key":"customRange"}]'::jsonb;
