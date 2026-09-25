"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  cancelPassengerRide,
  createPassengerRide,
  getPassengerRides,
  type DhakaZone,
  type PassengerRide,
  type RideStatus,
} from "../lib/api";
import {
  clearAuthSession,
  getAuthSession,
  type AuthSession,
} from "../lib/auth";

const ZONE_LABELS: Record<DhakaZone, string> = {
  BANANI: "Banani",
  GULSHAN_1: "Gulshan 1",
  GULSHAN_2: "Gulshan 2",
  MOHAKHALI: "Mohakhali",
  DHANMONDI: "Dhanmondi",
  MIRPUR: "Mirpur",
  UTTARA: "Uttara",
  FARMGATE: "Farmgate",
  BASHUNDHARA: "Bashundhara",
};

const ROUTES: Record<DhakaZone, DhakaZone[]> = {
  BANANI: ["MOHAKHALI", "GULSHAN_1", "GULSHAN_2", "BASHUNDHARA"],
  MOHAKHALI: ["GULSHAN_1", "GULSHAN_2"],
  GULSHAN_1: ["GULSHAN_2"],
  MIRPUR: ["FARMGATE", "DHANMONDI"],
  FARMGATE: ["DHANMONDI"],
  UTTARA: ["BANANI", "BASHUNDHARA"],
  GULSHAN_2: [],
  DHANMONDI: [],
  BASHUNDHARA: [],
};

const PICKUP_ZONES = (
  Object.keys(ROUTES) as DhakaZone[]
).filter((zone) => ROUTES[zone].length > 0);

const CANCELLABLE_STATUSES: RideStatus[] = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
];

const ACTIVE_STATUSES: RideStatus[] = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "STARTED",
];

const STATUS_LABELS: Record<RideStatus, string> = {
  REQUESTED: "Requested",
  MATCHED: "Matched",
  ACCEPTED: "Accepted",
  DRIVER_ARRIVED: "Driver arrived",
  STARTED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatFare(poisha: number): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(poisha / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function RouteArrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 10h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8m4-3 3-3-3-3m3 3H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PassengerDashboard() {
  const router = useRouter();

  const [session] = useState<AuthSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getAuthSession();
  });
  const [rides, setRides] = useState<PassengerRide[]>([]);
  const [pickupZone, setPickupZone] =
    useState<DhakaZone>("BANANI");
  const [destinationZone, setDestinationZone] =
    useState<DhakaZone>("MOHAKHALI");
  const [seats, setSeats] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [cancellingRideId, setCancellingRideId] =
    useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRides = useCallback(async (activeSession: AuthSession) => {
    try {
      const nextRides = await getPassengerRides(
        activeSession.token,
      );

      setRides(nextRides);
      setError("");
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        (caughtError.status === 401 || caughtError.status === 403)
      ) {
        clearAuthSession();
        router.replace("/login?role=passenger");
        return;
      }

      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to load your rides.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!session || session.user.role !== "PASSENGER") {
      clearAuthSession();
      router.replace("/login?role=passenger");
      return;
    }

    const activeSession = session;
    let cancelled = false;

    async function initializeDashboard() {
      try {
        const nextRides = await getPassengerRides(
          activeSession.token,
        );

        if (cancelled) {
          return;
        }

        setRides(nextRides);
        setError("");
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        if (
          caughtError instanceof ApiError &&
          (caughtError.status === 401 || caughtError.status === 403)
        ) {
          clearAuthSession();
          router.replace("/login?role=passenger");
          return;
        }

        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load your rides.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initializeDashboard();

    return () => {
      cancelled = true;
    };
  }, [router, session]);

  const destinations = ROUTES[pickupZone];

  const activeRide = useMemo(
    () =>
      rides.find((ride) =>
        ACTIVE_STATUSES.includes(ride.status),
      ) ?? null,
    [rides],
  );

  const history = useMemo(
    () =>
      rides.filter(
        (ride) =>
          ride.status === "COMPLETED" ||
          ride.status === "CANCELLED",
      ),
    [rides],
  );

  function changePickup(nextPickup: DhakaZone) {
    const nextDestinations = ROUTES[nextPickup];

    setPickupZone(nextPickup);
    setDestinationZone(nextDestinations[0]);
    setError("");
    setNotice("");
  }

  async function handleCreateRide() {
    if (!session || isCreating) {
      return;
    }

    setIsCreating(true);
    setError("");
    setNotice("");

    try {
      await createPassengerRide(session.token, {
        pickupZone,
        destinationZone,
        seats,
      });

      await loadRides(session);
      setNotice(
        "Ride requested. Your fare was calculated securely by the server.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to request your ride.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCancel(ride: PassengerRide) {
    if (!session || cancellingRideId) {
      return;
    }

    setCancellingRideId(ride.rideId);
    setError("");
    setNotice("");

    try {
      await cancelPassengerRide(
        session.token,
        ride.rideId,
      );

      await loadRides(session);
      setNotice("Ride request cancelled.");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to cancel this ride.",
      );
    } finally {
      setCancellingRideId(null);
    }
  }

  function handleLogout() {
    clearAuthSession();
    router.replace("/login?role=passenger");
  }

  if (isLoading || !session) {
    return (
      <main className="dashboard-loading">
        <div className="dashboard-loading-mark">D</div>
        <p>Loading your rides...</p>
      </main>
    );
  }

  return (
    <main className="passenger-page">
      <header className="dashboard-header">
        <div className="dashboard-container dashboard-header-inner">
          <div className="dashboard-brand">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <div>
              <strong>Dhaka Tesla Pool</strong>
              <span>Passenger</span>
            </div>
          </div>

          <div className="dashboard-user">
            <div className="dashboard-user-copy">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>

            <div className="dashboard-avatar" aria-hidden="true">
              {session.user.name.charAt(0).toUpperCase()}
            </div>

            <button
              type="button"
              className="dashboard-logout"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-container passenger-content">
        <section className="passenger-welcome">
          <div>
            <p className="dashboard-eyebrow">Passenger dashboard</p>
            <h1>
              Where are you
              <br />
              <span>heading today?</span>
            </h1>
          </div>

          <p>
            Request a seat in Bullet. Compatible Dhaka trips can
            be pooled without exceeding its three-passenger
            capacity.
          </p>
        </section>

        {(error || notice) && (
          <div
            className={`dashboard-message ${
              error ? "dashboard-message-error" : ""
            }`}
            role={error ? "alert" : "status"}
          >
            <span>{error ? "!" : "✓"}</span>
            <p>{error || notice}</p>
          </div>
        )}

        <div className="passenger-main-grid">
          <section className="ride-request-card">
            <div className="dashboard-card-heading">
              <div>
                <p>New request</p>
                <h2>Plan your ride</h2>
              </div>

              <span className="capacity-badge">
                Up to 3 seats
              </span>
            </div>

            <div className="ride-form">
              <label className="dashboard-field">
                <span>Pickup</span>
                <select
                  value={pickupZone}
                  onChange={(event) =>
                    changePickup(event.target.value as DhakaZone)
                  }
                >
                  {PICKUP_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {ZONE_LABELS[zone]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="route-divider">
                <span />
                <RouteArrow />
                <span />
              </div>

              <label className="dashboard-field">
                <span>Destination</span>
                <select
                  value={destinationZone}
                  onChange={(event) => {
                    setDestinationZone(
                      event.target.value as DhakaZone,
                    );
                    setError("");
                    setNotice("");
                  }}
                >
                  {destinations.map((zone) => (
                    <option key={zone} value={zone}>
                      {ZONE_LABELS[zone]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="seat-picker-block">
                <div>
                  <span>Seats</span>
                  <small>Bullet carries 3 passengers maximum</small>
                </div>

                <div className="seat-picker">
                  {[1, 2, 3].map((seatCount) => (
                    <button
                      key={seatCount}
                      type="button"
                      className={
                        seats === seatCount
                          ? "seat-choice seat-choice-active"
                          : "seat-choice"
                      }
                      onClick={() => setSeats(seatCount)}
                    >
                      {seatCount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fare-note">
                <div>
                  <span>Estimated fare</span>
                  <strong>Calculated after request</strong>
                </div>
                <p>
                  Distance, base fare, and the pool discount are
                  calculated by the server.
                </p>
              </div>

              <button
                type="button"
                className="request-ride-button"
                disabled={isCreating}
                onClick={handleCreateRide}
              >
                {isCreating ? "Requesting..." : "Request ride"}
                {!isCreating ? <RouteArrow /> : null}
              </button>
            </div>
          </section>

          <aside className="current-ride-card">
            <div className="dashboard-card-heading">
              <div>
                <p>Current ride</p>
                <h2>
                  {activeRide
                    ? STATUS_LABELS[activeRide.status]
                    : "No active ride"}
                </h2>
              </div>

              {activeRide ? (
                <span
                  className={`ride-status ride-status-${activeRide.status.toLowerCase()}`}
                >
                  {STATUS_LABELS[activeRide.status]}
                </span>
              ) : null}
            </div>

            {activeRide ? (
              <>
                <div className="active-route">
                  <div className="active-route-stop">
                    <span className="active-dot active-dot-start" />
                    <div>
                      <small>Pickup</small>
                      <strong>
                        {ZONE_LABELS[activeRide.pickupZone]}
                      </strong>
                    </div>
                  </div>

                  <div className="active-route-line" />

                  <div className="active-route-stop">
                    <span className="active-dot" />
                    <div>
                      <small>Destination</small>
                      <strong>
                        {ZONE_LABELS[activeRide.destinationZone]}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="ride-metrics">
                  <div>
                    <span>Fare</span>
                    <strong>
                      {formatFare(activeRide.farePoisha)}
                    </strong>
                  </div>

                  <div>
                    <span>Seats</span>
                    <strong>{activeRide.seats}</strong>
                  </div>
                </div>

                <div className="ride-progress">
                  <span
                    className={
                      activeRide.status !== "REQUESTED"
                        ? "progress-step progress-step-done"
                        : "progress-step progress-step-current"
                    }
                  >
                    Request
                  </span>
                  <span
                    className={
                      ["MATCHED", "ACCEPTED", "DRIVER_ARRIVED", "STARTED"].includes(
                        activeRide.status,
                      )
                        ? "progress-step progress-step-done"
                        : "progress-step"
                    }
                  >
                    Match
                  </span>
                  <span
                    className={
                      ["DRIVER_ARRIVED", "STARTED"].includes(
                        activeRide.status,
                      )
                        ? "progress-step progress-step-done"
                        : "progress-step"
                    }
                  >
                    Arrival
                  </span>
                  <span
                    className={
                      activeRide.status === "STARTED"
                        ? "progress-step progress-step-current"
                        : "progress-step"
                    }
                  >
                    Ride
                  </span>
                </div>

                <p className="ride-created">
                  Requested {formatDate(activeRide.createdAt)}
                </p>

                {CANCELLABLE_STATUSES.includes(
                  activeRide.status,
                ) ? (
                  <button
                    type="button"
                    className="cancel-ride-button"
                    disabled={
                      cancellingRideId === activeRide.rideId
                    }
                    onClick={() => handleCancel(activeRide)}
                  >
                    {cancellingRideId === activeRide.rideId
                      ? "Cancelling..."
                      : "Cancel request"}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="empty-current-ride">
                <div className="empty-route-icon">
                  <RouteArrow />
                </div>
                <h3>Your next pool starts here.</h3>
                <p>
                  Choose a supported route and request up to three
                  seats. Your private fare will appear here.
                </p>
              </div>
            )}
          </aside>
        </div>

        <section className="ride-history-section">
          <div className="history-heading">
            <div>
              <p className="dashboard-eyebrow">Your activity</p>
              <h2>Ride history</h2>
            </div>

            <span>
              {history.length}{" "}
              {history.length === 1 ? "ride" : "rides"}
            </span>
          </div>

          {history.length > 0 ? (
            <div className="history-list">
              {history.map((ride) => (
                <article
                  className="history-row"
                  key={ride.id}
                >
                  <div className="history-route">
                    <div className="history-route-icon">
                      <RouteArrow />
                    </div>

                    <div>
                      <strong>
                        {ZONE_LABELS[ride.pickupZone]}
                        <span>→</span>
                        {ZONE_LABELS[ride.destinationZone]}
                      </strong>
                      <p>{formatDate(ride.createdAt)}</p>
                    </div>
                  </div>

                  <div className="history-meta">
                    <div>
                      <span>Seats</span>
                      <strong>{ride.seats}</strong>
                    </div>

                    <div>
                      <span>Fare</span>
                      <strong>{formatFare(ride.farePoisha)}</strong>
                    </div>

                    <span
                      className={`history-status history-status-${ride.status.toLowerCase()}`}
                    >
                      {STATUS_LABELS[ride.status]}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <p>
                Completed and cancelled rides will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
