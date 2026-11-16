# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-11-15

### Added

- Express + TypeScript + Prisma + TSOA backend template with SQLite / MySQL / MariaDB support.
- Access / refresh token authentication, session revocation and RBAC menus, roles and permissions.
- System configuration center, dictionaries, operation logs, notifications, mail, help center, metrics and ops tasks.
- OpenAPI and handwritten route contract snapshots under `docs/api`.
- Dockerfile, Docker Compose, database migrations, seed data and CI matrix.
- MIT license, contribution guide, security policy and changelog.

### Changed

- Standardized response contract, error codes and request ID handling.
- Added database drift checks, backup / restore scripts and module generator.
