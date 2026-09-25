type CapacityInput = {
  vehicleCapacity: number;
  occupiedSeats: number;
  requestedSeats: number;
};

export function canAccommodateSeats({
  vehicleCapacity,
  occupiedSeats,
  requestedSeats,
}: CapacityInput): boolean {
  if (
    !Number.isInteger(vehicleCapacity) ||
    !Number.isInteger(occupiedSeats) ||
    !Number.isInteger(requestedSeats) ||
    vehicleCapacity <= 0 ||
    occupiedSeats < 0 ||
    requestedSeats <= 0 ||
    occupiedSeats > vehicleCapacity
  ) {
    return false;
  }

  return occupiedSeats + requestedSeats <= vehicleCapacity;
}
