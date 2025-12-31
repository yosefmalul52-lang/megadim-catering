export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'admin';
  isActive?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

export interface CreateUserRequest {
  name: string;
  phone: string;
  password: string;
  email?: string;
  role?: 'customer' | 'admin';
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: Omit<User, 'password'>;
  token?: string;
}

export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}
