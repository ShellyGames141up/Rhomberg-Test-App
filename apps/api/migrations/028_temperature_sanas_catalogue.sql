-- Temperature instruments are SANAS-approved.  Older catalogue rows used the
-- retired Traceable field, which left the live RFQ form out of sync with the
-- current workflow.  Normalise the stored schemas without changing historical
-- RFQ/order snapshots.
UPDATE app.products
SET configuration_schema = (
  SELECT jsonb_agg(
    CASE
      WHEN field->>'key' = 'traceability' THEN
        jsonb_set(
          jsonb_set(field, '{key}', '"sanas"'::jsonb),
          '{label}', '"SANAS calibration"'::jsonb
        ) || jsonb_build_object('options', jsonb_build_array('No SANAS certificate', 'SANAS calibration required'))
      ELSE field
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(configuration_schema) WITH ORDINALITY AS fields(field, ord)
)
WHERE configuration_schema @> '[{"key":"traceability"}]'::jsonb;

UPDATE app.products
SET configuration_schema = (
  SELECT jsonb_agg(
    CASE
      WHEN field->>'key' IN ('certificateRecipientType', 'certificateClientName', 'certificateAddressLine1', 'certificateAddressLine2', 'certificateCity', 'certificateProvince', 'certificatePostalCode', 'certificateCountry', 'certificateContact', 'certificateCustomerReference')
        AND field->'showWhen'->>'key' = 'traceability'
      THEN jsonb_set(field, '{showWhen,key}', '"sanas"'::jsonb)
      ELSE field
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(configuration_schema) WITH ORDINALITY AS fields(field, ord)
)
WHERE configuration_schema::text LIKE '%traceability%';

INSERT INTO app.audit_events(event_type, action, entity_type, entity_id, outcome, correlation_id, details)
VALUES ('catalogue.temperature_sanas_normalised', 'normalise_temperature_certification', 'catalogue', 'temperature', 'success', 'migration-028',
        jsonb_build_object('retiredOption', 'Traceable', 'replacement', 'SANAS'));
