# CAGE Geo Intelligence Network — Foundation

This is an **isolated foundation** for CAGE's future multi-tenant geospatial platform. It does not change the existing offline Crop Intelligence desktop application, connect to a production Supabase project, or run photogrammetry.

## Included

- `supabase/migrations/001_geo_foundation.sql`: organizations, memberships, projects, missions, datasets, assets, processing jobs, quality checks, analysis runs, deliverables and audit events, with row-level security.
- `src/job-state.mjs`: deterministic processing-job transition rules and retry policy.
- `tests/job-state.test.mjs`: transition, retry and permission-independent state tests.
- `API.md`: initial ingestion/processing API contract and publication gates.

## Validation

Run `node --test geo-network/tests/*.test.mjs` from the repository root. Review and apply the SQL in a **new** Supabase project after obtaining its credentials. Do not apply it to the live CAGE Operations Hub.

## Not implemented yet

Authentication endpoints, signed object-storage uploads, upload checksum verification, processing workers, photogrammetry, STAC catalog, AI inference, billing and client-facing web screens. These need separate implementation and integration testing before deployment.
