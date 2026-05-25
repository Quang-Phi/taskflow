# TaskFlow – Backend (Laravel)

## Yêu cầu hệ thống
- PHP >= 8.2
- Composer
- MySQL >= 8.0
- Node.js (cho asset compilation nếu cần)

## Cài đặt

```bash
# 1. Cài PHP (macOS với Homebrew)
brew install php@8.2
brew link php@8.2 --force

# 2. Cài Composer
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# 3. Cài các dependencies
composer install

# 4. Copy file env
cp .env.example .env

# 5. Generate app key
php artisan key:generate

# 6. Tạo database MySQL tên: taskflow
# Sau đó chạy migration
php artisan migrate --seed

# 7. Chạy server
php artisan serve
# Server sẽ chạy tại: http://localhost:8000
```

## Cấu trúc thư mục
```
taskflow-be/
├── app/
│   ├── Http/
│   │   ├── Controllers/    # API Controllers
│   │   ├── Middleware/     # Auth, Role middleware
│   │   ├── Requests/       # Form validation
│   │   └── Resources/      # API Response transformers
│   ├── Models/             # Eloquent Models
│   ├── Services/           # Business logic layer
│   └── Policies/           # Authorization policies
├── database/
│   ├── migrations/         # Database schema
│   ├── seeders/            # Seed data
│   └── factories/          # Model factories
├── routes/
│   └── api.php             # API routes
└── tests/                  # Feature & Unit tests
```
