#!/bin/sh

# Cache configurations
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run database migrations automatically
php artisan migrate --force

# Run database seeders automatically
php artisan db:seed --force

# Continue with the container start command
exec "$@"
