# TaskFlow – Frontend (ReactJS + TypeScript)

## Yêu cầu hệ thống
- Node.js >= 18
- npm hoặc yarn

## Cài đặt & Chạy

```bash
# Cài dependencies
npm install

# Chạy development server
npm start
# App chạy tại: http://localhost:3000

# Build production
npm run build
```

## Tech Stack
- **Framework**: React 18 + TypeScript
- **UI Library**: Ant Design (antd)
- **Styling**: SCSS Modules
- **State Management**: Redux Toolkit + RTK Query
- **Routing**: React Router v6
- **Form**: React Hook Form + Yup validation
- **HTTP Client**: Axios
- **Charts**: Recharts (cho dashboard báo cáo)

## Cấu trúc thư mục (sau khi phát triển)
```
taskflow-fe/src/
├── assets/             # Images, icons, fonts
├── components/         # Shared components
│   ├── common/         # Button, Input, Modal...
│   └── layout/         # Header, Sidebar, Footer
├── pages/              # Các trang chính
│   ├── auth/           # Login, Register
│   ├── dashboard/      # Dashboard tổng quan
│   ├── projects/       # Quản lý dự án
│   ├── tasks/          # Quản lý task
│   ├── users/          # Quản lý người dùng
│   ├── evaluation/     # Đánh giá nhân viên
│   └── reports/        # Báo cáo thống kê
├── store/              # Redux store
│   └── slices/         # Redux slices
├── services/           # API calls (RTK Query)
├── hooks/              # Custom React hooks
├── utils/              # Helper functions
├── types/              # TypeScript type definitions
└── styles/             # Global SCSS variables, mixins
```
