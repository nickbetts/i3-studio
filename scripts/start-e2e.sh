#!/bin/sh
set -eu
AUTH_URL=http://localhost:3107
export AUTH_URL
exec pnpm exec next start . --port 3107
