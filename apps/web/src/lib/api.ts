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

export type DhakaZone =
  | "BANANI"
  | "GULSHAN_1"
  | "GULSHAN_2"
  | "MOHAKHALI"
  | "DHANMONDI"
  | "MIRPUR"
  | "UTTARA"
  | "FARMGATE"
  | "BASHUNDHARA";

export type RideStatus =
  | "REQUESTED"
  | "MATCHED"
  | "ACCEPTED"
  | "DRIVER_ARRIVED"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

export type PassengerRide = {
  id: string;
  rideId: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  seats: number;
  farePoisha: number;
  status: RideStatus;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  ride: {
    driverId: string | null;
    vehicleId: string | null;
    status: RideStatus;
    startedAt: string | null;
    completedAt: string | null;
  };
};

type ApiErrorResponse = {
  error?: string;
};

type PassengerRidesResponse = {
  rides: PassengerRide[];
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

async function readError(response: Response): Promise<ApiError> {
  let message = "Request failed. Please try again.";

  try {
    const body = (await response.json()) as ApiErrorResponse;

    if (body.error) {
      message = body.error;
    }
  } catch {
    // Keep the safe fallback when the API does not return JSON.
  }

  return new ApiError(message, response.status);
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
    throw await readError(response);
  }

  return (await response.json()) as LoginResponse;
}

async function authenticatedFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError(
      "Unable to reach the ride service. Check that the API is running.",
      0,
    );
  }

  if (!response.ok) {
    throw await readError(response);
  }

  return response;
}

export async function getPassengerRides(
  token: string,
): Promise<PassengerRide[]> {
  const response = await authenticatedFetch(
    "/passenger/rides",
    token,
  );

  const body = (await response.json()) as PassengerRidesResponse;

  return body.rides;
}

export async function createPassengerRide(
  token: string,
  input: {
    pickupZone: DhakaZone;
    destinationZone: DhakaZone;
    seats: number;
  },
): Promise<void> {
  await authenticatedFetch("/passenger/rides", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function cancelPassengerRide(
  token: string,
  rideId: string,
): Promise<void> {
  await authenticatedFetch(
    `/passenger/rides/${rideId}/cancel`,
    token,
    {
      method: "POST",
    },
  );
}
