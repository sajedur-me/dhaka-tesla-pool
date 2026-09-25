import type {
  AuthUser,
  LoginResponse,
} from "./api";

const TOKEN_KEY = "dhaka-tesla-pool.token";
const USER_KEY = "dhaka-tesla-pool.user";

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export function saveAuthSession(session: LoginResponse): void {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getAuthSession(): AuthSession | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const rawUser = sessionStorage.getItem(USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser;

    if (
      !user.id ||
      !user.email ||
      (user.role !== "PASSENGER" && user.role !== "DRIVER")
    ) {
      clearAuthSession();
      return null;
    }

    return {
      token,
      user,
    };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
