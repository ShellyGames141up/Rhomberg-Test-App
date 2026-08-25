ALTER TABLE app.document_metadata ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE app.document_metadata ADD COLUMN supersedes_document_id uuid REFERENCES app.document_metadata(id);
ALTER TABLE app.document_metadata ADD COLUMN replacement_reason text;
CREATE INDEX document_metadata_order_kind_version_idx ON app.document_metadata(order_id,kind,version DESC) WHERE deleted_at IS NULL;
