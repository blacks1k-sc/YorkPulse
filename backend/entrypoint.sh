#!/bin/sh
# entrypoint.sh — Run migrations then start the server.
#
# WHY a separate entrypoint script instead of CMD shell form:
#   CMD ["sh", "-c", "alembic ... && uvicorn ..."] uses a shell wrapper.
#   The shell process becomes PID 1 and intercepts SIGTERM from ECS, but
#   never forwards it to uvicorn — causing a 30-second forced kill on every
#   deploy/scale-down instead of a graceful shutdown.
#
#   With exec "$@" at the end of this script, the shell is REPLACED by
#   uvicorn (exec replaces the current process). Uvicorn becomes PID 1 and
#   receives SIGTERM directly — graceful shutdown works correctly.
#
# WHY alembic runs here and not as a separate ECS task:
#   Running migrations as a one-off task before the service update is the
#   safer pattern for production (ensures DB is migrated before any new
#   code handles requests). For this project, running it at container start
#   is acceptable: migrations are idempotent and the ECS health check
#   (--start-period=40s) gives the container time to complete before
#   traffic is routed to it.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec "$@"
