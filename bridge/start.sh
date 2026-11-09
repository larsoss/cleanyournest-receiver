#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then echo 'Maak eerst bridge/.env aan (kopieer .env.example).'; exit 1; fi
set -a
# .env is an admin-owned shell environment file; protect permissions (chmod 600).
. ./.env
set +a
exec python3 server.py
