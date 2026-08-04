// Curl-verified 2026-08-03 against live erp -- GET /api/v1/users/me:
// {"id","fullName","email","phone","roles":string[] (codes, e.g. "ADMIN"),
//  "isActive","status"}
export interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  roles: string[];
  isActive: boolean;
  status: string;
}

// erp's PUT /api/v1/users/{id} (UpdateUserRequest) also accepts roleIds and
// isActive, but UserServiceImpl.updateUser only touches those when they're
// explicitly non-null/non-empty (verified in source) -- so a self-service
// profile edit can safely send just fullName + phone without silently
// wiping the caller's own roles or active status. There is no separate
// self-service endpoint (no PUT /users/me); this reuses the general
// employee-management PUT /users/{id}, which requires USER_UPDATE --
// not every employee will have that, handled as a 403 in the UI.
export interface UpdateProfileRequest {
  fullName: string;
  phone?: string;
}
