# Production-server recovery artifacts

Captured from the production repository on 2026-11-14.

These are historical recovery and investigation artifacts, not approved
production patches.

## Python scripts

The four Python files are historical patch-installer scripts. They may
modify source files or invoke Git/subprocess operations. Do not execute
them. In particular, the embedded patch in
playground_life_security_fixer.py did not apply cleanly to the current
tracked source during the preliminary check.

## Dated source snapshots

The `.before-*` files are historical copies. They must not be copied over
current source files without a separate review and explicit approval.

## Excluded material

This archive intentionally excludes environment files, generated build
directories, `.security-patch-backups`, the clinic-admin password reset
utility, and test snapshots containing password-related fixtures.

Automated credential-pattern scans found no matches in the included
source files. Such scans are screening only and cannot guarantee that
every file is free of sensitive information.

No production source files or running services were changed to create
this archive.
