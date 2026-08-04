// Client-side fetch wrapper. Every call goes to this app's own
// /api/backend/* route (same origin, cookie-authenticated), never directly
// to erp -- see ARCHITECTURE.md section 2. Mirrors erp's real response
// envelope shapes, confirmed live:
//   success: {"success":true,"data":T,"message"?,"timestamp"}
//   error:   {"success":false,"error":{"code","message","fieldErrors"},"timestamp"}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors: ApiFieldError[] | null;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class ApiRequestError extends Error {
  code: string;
  fieldErrors: ApiFieldError[] | null;
  status: number;

  constructor(status: number, body: ApiError) {
    super(body.error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = body.error.code;
    this.fieldErrors = body.error.fieldErrors;
  }
}

// erp's list endpoints return one of two paginated shapes depending on
// module (confirmed live across the audit): a Spring Page-style envelope
// ({content,totalElements,totalPages,...}) or a lighter PageResponse
// ({content,page,size,totalElements,totalPages,first,last}). Both carry
// `content`+`totalElements`+`totalPages` in common; consume through this
// shared shape rather than assuming either specific one.
export interface PagedResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number;
  page?: number;
  size?: number;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    throw new ApiRequestError(response.status, body as ApiError);
  }

  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
