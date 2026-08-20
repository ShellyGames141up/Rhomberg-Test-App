export function createPostgresBootstrapRepository(pool) {
  return Object.freeze({
    async getBootstrapState() {
      const result = await pool.query('SELECT completed_at FROM app.platform_bootstrap_state WHERE singleton = true');
      return result.rows[0] || null;
    },
    async hasAdministrator() {
      const result = await pool.query(`SELECT EXISTS (
        SELECT 1 FROM app.user_roles role
        JOIN app.users user_record ON user_record.id = role.user_id
        WHERE role.role_code = 'administrator' AND role.revoked_at IS NULL
          AND user_record.status = 'active' AND user_record.deleted_at IS NULL
      ) AS exists`);
      return Boolean(result.rows[0]?.exists);
    },
    async initialiseAdministrator(command) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('rhomberg-connect-initial-administrator', 0))");
        const state = await client.query('SELECT 1 FROM app.platform_bootstrap_state WHERE singleton = true');
        if (state.rowCount) {
          await client.query('ROLLBACK');
          return { status: 'already_initialised' };
        }
        const administrator = await client.query(`SELECT 1 FROM app.user_roles role
          JOIN app.users user_record ON user_record.id = role.user_id
          WHERE role.role_code = 'administrator' AND role.revoked_at IS NULL
            AND user_record.status = 'active' AND user_record.deleted_at IS NULL LIMIT 1`);
        if (administrator.rowCount) {
          const error = new Error('An Administrator exists without completed bootstrap state.');
          error.code = 'UNSAFE_BOOTSTRAP_REFUSED';
          throw error;
        }
        await client.query(`INSERT INTO app.users
          (id, username, email, display_name, password_hash, identity_provider, status)
          VALUES ($1, $2, NULL, $3, $4, 'local_password', 'active')`,
        [command.userId, command.username, command.displayName, command.passwordHash]);
        await client.query("INSERT INTO app.user_roles (user_id, role_code) VALUES ($1, 'administrator')", [command.userId]);
        await client.query('INSERT INTO app.platform_bootstrap_state (administrator_user_id) VALUES ($1)', [command.userId]);
        await client.query(`INSERT INTO app.audit_events
          (event_type, actor_user_id, actor_role, company_id, action, entity_type, entity_id, outcome, correlation_id, details)
          VALUES ('platform.initial_administrator_created', $1::uuid, 'administrator', NULL, 'initialise_platform', 'user', ($1::uuid)::text, 'success', $2, '{"bootstrapVersion":1}'::jsonb)`,
        [command.userId, command.correlationId]);
        await client.query('COMMIT');
        return { status: 'created' };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
