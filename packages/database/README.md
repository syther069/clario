# @clario/database

PostgreSQL database schemas, migration management, and relational types for the Clario platform.

---

## Capabilities

- **Relational Schemas**: PostgreSQL schemas with foreign keys, checks, and partial unique indexes enforcing invariant safety.
- **Migration Engine**: Versioned bidirectional SQL migration runner (`migrator.up()`, `migrator.down()`).
- **Data Protection**: Envelope encryption references and Row Level Security (RLS) policies ensuring zero private financial data leaks.
- **3-Tier Hybrid Persistence**: Integrates with Clario's client-side L1 in-memory cache and L2 native IndexedDB (`clario_db`) offline cache with automatic queue reconciliation (`SyncQueueManager`).
- **In-Memory Testing**: Offline test harness using `pg-mem` for rapid local validation without external credentials.

---

## Build & Test

```bash
# Build package
pnpm --filter @clario/database build

# Run migration and isolation tests
pnpm --filter @clario/database test
```
