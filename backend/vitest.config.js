import { defineConfig } from 'vitest/config';

// Plain Node unit tests for request-scoped logic (services/controllers as pure
// functions operating on their arguments) — not a full Workers-runtime simulation.
// Nothing under test here touches a Workers-only global, so this is sufficient
// without pulling in @cloudflare/vitest-pool-workers.
export default defineConfig({
    test: {
        environment: 'node'
    }
});
