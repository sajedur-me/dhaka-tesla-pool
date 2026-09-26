export class DriverVehicleNotFoundError extends Error {
  constructor() {
    super("Driver vehicle not found");
    this.name = "DriverVehicleNotFoundError";
  }
}

export class DriverMustBeOnlineError extends Error {
  constructor() {
    super("Driver must be online");
    this.name = "DriverMustBeOnlineError";
  }
}

export class VehicleBusyError extends Error {
  constructor() {
    super(
      "Vehicle cannot change availability during an active ride",
    );
    this.name = "VehicleBusyError";
  }
}

export class RideRequestNotFoundError extends Error {
  constructor() {
    super("Ride request not found");
    this.name = "RideRequestNotFoundError";
  }
}

export class RideRequestUnavailableError extends Error {
  constructor() {
    super("Ride request is no longer available");
    this.name = "RideRequestUnavailableError";
  }
}

export class RideCapacityExceededError extends Error {
  constructor() {
    super("Ride request exceeds vehicle capacity");
    this.name = "RideCapacityExceededError";
  }
}

export class DriverAlreadyHasActiveRideError extends Error {
  constructor() {
    super("Driver already has an active ride");
    this.name = "DriverAlreadyHasActiveRideError";
  }
}
