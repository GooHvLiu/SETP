# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.3] - 2026-11-18

Feature release for the dashboard trend contract.

### Added

- `GET /api/v1/dashboard/trend` returning exactly 7 ascending natural-day points, with missing days filled as `count: 0`.
- Dashboard trend only counts `operation_logs.category = "operation"`; login records are excluded.
- Unit coverage for the 7-day window builder and HTTP coverage for the 7-point contract plus the `dashBoard:list` 403 boundary.

### Changed

- Runtime logging stack moved to `pino` 10 and `pino-http` 11 together; `pino-http` 11 alone is incompatible with the previous `pino` 9 logger.
- README endpoint inventory now reports 78 TSOA endpoints and documents the dashboard trend capability.
- Release metadata and the generated OpenAPI contract now report `0.8.3`.

## [0.8.1] - 2026-11-17

Patch release for public install portability.

### Added

- `check:lockfile` static quality gate that rejects non-official registry URLs in `package-lock.json`.

### Changed

- Normalized every `resolved` URL in `package-lock.json` to `https://registry.npmjs.org`, so public installs no longer follow a regional mirror.
- Release metadata and the generated OpenAPI contract now report `0.8.1`.

## [0.8.0] - 2026-11-17

First public release of the Setp backend template.

### Added

- Node.js 20.19.0 and 24 compatibility job alongside the SQLite / MySQL / MariaDB test matrix.
- Node compatibility checks are enforced by the `develop` branch protection ruleset.
- Public documentation index and archive conventions under `docs/`.
- CodeQL SARIF upload to the repository Security tab.

### Changed

- Unified product naming as `Setp` across repository metadata, documentation and generated API contract.
- Updated `dotenv` to 18, `imapflow` to 2, `express-rate-limit` to 8 and `@types/multer` to 2.
- Dependabot and CI branch targeting now follow `develop` as the integration branch.
- README quick start now leads with SQLite and keeps the template usage guide in one place.

### Fixed

- Replaced deprecated `uuid` usage with `crypto.randomUUID`.
- Normalized IPv6 rate limit keys with `ipKeyGenerator` so IPv6 clients cannot bypass per-IP limits.
- Generated TSOA routes and OpenAPI artifacts before static checks in the compatibility CI job.

### Security

- Bounded the in-process permission cache to 10,000 entries with expired-entry cleanup and oldest-entry eviction.
- Documented the public `/uploads` directory policy, including the limits of response headers as access control.

## [0.5.0] - 2026-11-15

### Added

- Express + TypeScript + Prisma backend template with SQLite / MySQL / MariaDB support.
- Access / refresh token authentication, session revocation and RBAC menus, roles and permissions.
- System configuration center, dictionaries, operation logs, notifications, mail, help center, metrics and ops tasks.
- OpenAPI and handwritten route contract snapshots under `docs/api`.
- Dockerfile, Docker Compose, database migrations, seed data and CI matrix.
- MIT license, contribution guide, security policy and changelog.

### Changed

- Standardized response contract, error codes and request ID handling.
- Added database drift checks, backup / restore scripts and module generator.
