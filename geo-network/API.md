# Geo Intelligence API contract (draft v0.1)

All endpoints use authenticated organization membership, server-side authorization, request IDs, and idempotency keys on writes. Paths are proposed; no HTTP server is implemented yet.

| Endpoint | Behavior |
|---|---|
| `POST /v1/projects` | Create an organization-scoped project and geometry |
| `POST /v1/projects/{id}/datasets` | Register acquisition metadata, sensor, CRS and expected files |
| `POST /v1/datasets/{id}/upload-sessions` | Issue short-lived per-object upload grants with size/type constraints |
| `POST /v1/datasets/{id}/finalize` | Verify object existence, checksums and expected inventory; enqueue QC |
| `GET /v1/datasets/{id}/quality` | Return geotag, image-set, calibration and coverage checks |
| `POST /v1/datasets/{id}/jobs` | Create a versioned job for a supported workflow |
| `GET /v1/jobs/{id}` | Return status, bounded logs, progress and output references |
| `POST /v1/jobs/{id}/review` | Approve or reject outputs; privileged analyst only |
| `POST /v1/deliverables/{id}/publish` | Publish previously approved content to authorized clients |
| `GET /v1/projects/{id}/catalog` | Return authorized metadata and signed, expiring download links |

## Safety and scientific gates

1. Do not accept client-provided organization IDs as authorization proof. Resolve authorized memberships server-side.
2. Raw images and private products stay in private object storage; no public bucket URLs.
3. Each processing job records source asset IDs, checksums, workflow version, configuration, CRS, geoid/vertical datum where relevant, and output hashes.
4. QC failures cannot reach publication automatically. An authorized analyst must approve products.
5. Multispectral products need radiometric provenance and consistent band mappings; index maps must distinguish measured spectral response from inferred crop diagnoses.
6. Use independent checkpoints when making absolute positional-accuracy claims. GSD alone is not accuracy.
7. Long-running processing belongs to durable worker services, not request handlers or Edge Functions.
