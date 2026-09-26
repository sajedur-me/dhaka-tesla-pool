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

export type VehicleStatus = "OFFLINE" | "ONLINE" | "ON_RIDE";

export type DriverVehicle = {
  id: string;
  name: string;
  capacity: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
};

export type DriverRidePassenger = {
  id: string;
  passengerId: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  seats: number;
  status: RideStatus;
  passenger: {
    id: string;
    name: string;
  };
};

export type DriverRide = {
  id: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  status: RideStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    name: string;
    capacity: number;
    status: VehicleStatus;
  } | null;
  passengers: DriverRidePassenger[];
};

export type DriverRideRequest = {
  id: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  status: RideStatus;
  createdAt: string;
  passengers: Array<{
    id: string;
    pickupZone: DhakaZone;
    destinationZone: DhakaZone;
    seats: number;
    status: RideStatus;
    passenger: {
      id: string;
      name: string;
    };
  }>;
};

type DriverVehicleResponse = {
  vehicle: DriverVehicle;
};

type DriverRequestsResponse = {
  requests: DriverRideRequest[];
};

type DriverActiveRideResponse = {
  ride: DriverRide | null;
};

type DriverRideHistoryResponse = {
  rides: DriverRide[];
};

export async function getDriverVehicle(
  token: string,
): Promise<DriverVehicle> {
  const response = await authenticatedFetch(
    "/driver/vehicle",
    token,
  );

  const body =
    (await response.json()) as DriverVehicleResponse;

  return body.vehicle;
}

export async function updateDriverVehicleStatus(
  token: string,
  status: "ONLINE" | "OFFLINE",
): Promise<DriverVehicle> {
  const response = await authenticatedFetch(
    "/driver/vehicle/status",
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    },
  );

  const body =
    (await response.json()) as DriverVehicleResponse;

  return body.vehicle;
}

export async function getDriverRequests(
  token: string,
): Promise<DriverRideRequest[]> {
  const response = await authenticatedFetch(
    "/driver/requests",
    token,
  );

  const body =
    (await response.json()) as DriverRequestsResponse;

  return body.requests;
}

export async function acceptDriverRideRequest(
  token: string,
  rideId: string,
): Promise<void> {
  await authenticatedFetch(
    `/driver/requests/${rideId}/accept`,
    token,
    {
      method: "POST",
    },
  );
}

export async function getDriverActiveRide(
  token: string,
): Promise<DriverRide | null> {
  const response = await authenticatedFetch(
    "/driver/rides/active",
    token,
  );

  const body =
    (await response.json()) as DriverActiveRideResponse;

  return body.ride;
}

export async function getDriverRideHistory(
  token: string,
): Promise<DriverRide[]> {
  const response = await authenticatedFetch(
    "/driver/rides/history",
    token,
  );

  const body =
    (await response.json()) as DriverRideHistoryResponse;

  return body.rides;
}

async function transitionDriverRide(
  token: string,
  rideId: string,
  action: "arrive" | "start" | "complete",
): Promise<void> {
  await authenticatedFetch(
    `/driver/rides/${rideId}/${action}`,
    token,
    {
      method: "POST",
    },
  );
}

export async function markDriverArrived(
  token: string,
  rideId: string,
): Promise<void> {
  await transitionDriverRide(
    token,
    rideId,
    "arrive",
  );
}

export async function startDriverRide(
  token: string,
  rideId: string,
): Promise<void> {
  await transitionDriverRide(
    token,
    rideId,
    "start",
  );
}

export async function completeDriverRide(
  token: string,
  rideId: string,
): Promise<void> {
  await transitionDriverRide(
    token,
    rideId,
    "complete",
  );
}
