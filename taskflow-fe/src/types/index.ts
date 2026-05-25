// === User ===
export interface BitrixUser {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo: string | null;
  department_ids: number[];
  active: boolean;
  work_position: string;
  date_register?: string;
}

// === Department ===
export interface BitrixDepartment {
  id: string;
  name: string;
  parent_id: string | null;
  head_user_id: string | null;
  sort: number;
}

// === Auth ===
export interface AuthUser {
  bitrix_id: string;
  name: string;
  email: string;
  department: number[];
  active: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    photo: string | null;
    department_ids: number[];
  };
}

// === API Response ===
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  message?: string;
}
