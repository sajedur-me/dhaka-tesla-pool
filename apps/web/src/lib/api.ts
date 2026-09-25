export type UserRole = "PASSENGER" | "DRIVER";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type LoginResponse = {
  user: AuthUser;
  token: string;
};

type ApiErrorResponse = {
  error?: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  } catch {
    throw new ApiError(
      "Unable to reach the ride service. Check that the API is running.",
      0,
    );
  }

  if (!response.ok) {
    let message = "Sign in failed. Please try again.";

    try {
      const body = (await response.json()) as ApiErrorResponse;

      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the safe fallback message when the API returns a non-JSON error.
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as LoginResponse;
}
