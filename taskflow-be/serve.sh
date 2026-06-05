#!/bin/bash
# Run PHP built-in server with multiple workers for concurrent request handling.
#
# PHP_CLI_SERVER_WORKERS requires the --no-reload flag to work.
# Without it PHP logs:
#   "Unable to respect the 'PHP_CLI_SERVER_WORKERS' environment variable
#    without the '--no-reload' flag."
#
# We bypass `php artisan serve` (which doesn't forward --no-reload)
# and call the PHP built-in server directly with public/index.php as router.

export PHP_CLI_SERVER_WORKERS=4

echo "[serve] PHP_CLI_SERVER_WORKERS=$PHP_CLI_SERVER_WORKERS"
echo "[serve] Starting PHP built-in server at http://0.0.0.0:8000 (4 workers)"
echo "[serve] Press Ctrl+C to stop"

# public/index.php as the router handles ALL Laravel routes (not just static files)
# --no-reload keeps workers alive (required for PHP_CLI_SERVER_WORKERS)
php -S 0.0.0.0:8000 public/index.php --no-reload
