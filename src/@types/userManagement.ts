export interface UserGroup {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  phone_number: string;
  global_dimension_1?: number | null;
  global_dimension_1_obj?: {id: number; code: string | null; description: string} | null;
  can_switch_branch?: boolean;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  user_groups?: UserGroup[];
  created_at: string;
  updated_at: string;
}

export interface UserFormValues {
  email: string;
  username: string;
  full_name: string;
  phone_number: string;
  password?: string;
  restaurant_pin?: string;
  global_dimension_1?: number | null;
  can_switch_branch?: boolean;
  user_group_ids?: number[];
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

export interface PaginatedUserResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface UserGroupListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserGroup[];
}
