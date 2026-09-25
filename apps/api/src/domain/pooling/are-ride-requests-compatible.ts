import {
  DHAKA_CORRIDORS,
  type PoolingZone,
} from "./dhaka-corridors.js";

type RideRequest = {
  pickupZone: PoolingZone;
  destinationZone: PoolingZone;
};

export function areRideRequestsCompatible(
  firstRequest: RideRequest,
  secondRequest: RideRequest,
): boolean {
  if (firstRequest.pickupZone !== secondRequest.pickupZone) {
    return false;
  }

  return DHAKA_CORRIDORS.some((corridor) => {
    const pickupIndex = corridor.indexOf(firstRequest.pickupZone);
    const firstDestinationIndex = corridor.indexOf(
      firstRequest.destinationZone,
    );
    const secondDestinationIndex = corridor.indexOf(
      secondRequest.destinationZone,
    );

    return (
      pickupIndex >= 0 &&
      firstDestinationIndex > pickupIndex &&
      secondDestinationIndex > pickupIndex
    );
  });
}
