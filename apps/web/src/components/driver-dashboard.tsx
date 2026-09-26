"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  acceptDriverRideRequest,
  completeDriverRide,
  getDriverActiveRide,
  getDriverRequests,
  getDriverRideHistory,
  getDriverVehicle,
  markDriverArrived,
  startDriverRide,
  updateDriverVehicleStatus,
  type DhakaZone,
  type DriverRide,
  type DriverRideRequest,
  type DriverVehicle,
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

const STATUS_LABELS: Record<RideStatus, string> = {
  REQUESTED: "Requested",
  MATCHED: "Matched",
  ACCEPTED: "Accepted",
  DRIVER_ARRIVED: "Driver arrived",
  STARTED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getRideSeatCount(
  ride: DriverRide | DriverRideRequest,
): number {
  return ride.passengers.reduce(
    (total, passenger) => total + passenger.seats,
    0,
  );
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

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 15.5h14m-13.5 0v2m13-2v2M4 13l1.8-5.1A2 2 0 0 1 7.7 6.5h8.6a2 2 0 0 1 1.9 1.4L20 13v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V13Zm1.5 0h13M7 12h.01M17 12h.01"
        stroke="currentColor"
        strokeWidth="1.6"
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

export function DriverDashboard() {
  const router = useRouter();

  const [session] = useState<AuthSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getAuthSession();
  });

  const [vehicle, setVehicle] =
    useState<DriverVehicle | null>(null);
  const [requests, setRequests] =
    useState<DriverRideRequest[]>([]);
  const [activeRide, setActiveRide] =
    useState<DriverRide | null>(null);
  const [history, setHistory] =
    useState<DriverRide[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isChangingStatus, setIsChangingStatus] =
    useState(false);
  const [acceptingRideId, setAcceptingRideId] =
    useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] =
    useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleAuthError = useCallback(
    (caughtError: unknown): boolean => {
      if (
        caughtError instanceof ApiError &&
        (caughtError.status === 401 ||
          caughtError.status === 403)
      ) {
        clearAuthSession();
        router.replace("/login?role=driver");
        return true;
      }

      return false;
    },
    [router],
  );

  const loadDashboard = useCallback(
    async (activeSession: AuthSession) => {
      try {
        const [
          nextVehicle,
          nextActiveRide,
          nextHistory,
        ] = await Promise.all([
          getDriverVehicle(activeSession.token),
          getDriverActiveRide(activeSession.token),
          getDriverRideHistory(activeSession.token),
        ]);

        let nextRequests: DriverRideRequest[] = [];

        if (nextVehicle.status === "ONLINE") {
          try {
            nextRequests = await getDriverRequests(
              activeSession.token,
            );
          } catch (caughtError) {
            if (handleAuthError(caughtError)) {
              return;
            }

            throw caughtError;
          }
        }

        setVehicle(nextVehicle);
        setActiveRide(nextActiveRide);
        setHistory(nextHistory);
        setRequests(nextRequests);
        setError("");
      } catch (caughtError) {
        if (handleAuthError(caughtError)) {
          return;
        }

        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load the driver dashboard.",
        );
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    if (!session || session.user.role !== "DRIVER") {
      clearAuthSession();
      router.replace("/login?role=driver");
      return;
    }

    const activeSession = session;
    let cancelled = false;

    void (async () => {
      await loadDashboard(activeSession);

      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDashboard, router, session]);

  const occupiedSeats = useMemo(() => {
    if (!activeRide) {
      return 0;
    }

    return getRideSeatCount(activeRide);
  }, [activeRide]);

  const availableSeats = Math.max(
    (vehicle?.capacity ?? 0) - occupiedSeats,
    0,
  );

  async function handleVehicleStatus() {
    if (
      !session ||
      !vehicle ||
      vehicle.status === "ON_RIDE"
    ) {
      return;
    }

    const nextStatus =
      vehicle.status === "ONLINE"
        ? "OFFLINE"
        : "ONLINE";

    setIsChangingStatus(true);
    setError("");
    setNotice("");

    try {
      const nextVehicle =
        await updateDriverVehicleStatus(
          session.token,
          nextStatus,
        );

      setVehicle(nextVehicle);

      if (nextStatus === "ONLINE") {
        const nextRequests =
          await getDriverRequests(session.token);

        setRequests(nextRequests);
        setNotice(
          "Bullet is online. New ride requests are now visible.",
        );
      } else {
        setRequests([]);
        setNotice(
          "Bullet is offline. You will not receive new ride requests.",
        );
      }
    } catch (caughtError) {
      if (handleAuthError(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to update Bullet's status.",
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleAccept(requestRideId: string) {
    if (!session) {
      return;
    }

    setAcceptingRideId(requestRideId);
    setError("");
    setNotice("");

    try {
      await acceptDriverRideRequest(
        session.token,
        requestRideId,
      );

      await loadDashboard(session);

      setNotice(
        "Ride accepted. The passenger is now in your active pool.",
      );
    } catch (caughtError) {
      if (handleAuthError(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to accept this ride request.",
      );

      await loadDashboard(session);
    } finally {
      setAcceptingRideId(null);
    }
  }

  async function handleRideTransition(
    action: "arrive" | "start" | "complete",
  ) {
    if (!session || !activeRide) {
      return;
    }

    setIsTransitioning(true);
    setError("");
    setNotice("");

    try {
      if (action === "arrive") {
        await markDriverArrived(
          session.token,
          activeRide.id,
        );
      }

      if (action === "start") {
        await startDriverRide(
          session.token,
          activeRide.id,
        );
      }

      if (action === "complete") {
        await completeDriverRide(
          session.token,
          activeRide.id,
        );
      }

      await loadDashboard(session);

      if (action === "arrive") {
        setNotice(
          "Arrival confirmed. Your passengers have been notified.",
        );
      }

      if (action === "start") {
        setNotice(
          "Ride started. Bullet is now marked as on ride.",
        );
      }

      if (action === "complete") {
        setNotice(
          "Ride completed. Bullet is ready for the next pool.",
        );
      }
    } catch (caughtError) {
      if (handleAuthError(caughtError)) {
        return;
      }

      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to update the ride.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }

  function handleLogout() {
    clearAuthSession();
    router.replace("/login?role=driver");
  }

  if (
    !session ||
    session.user.role !== "DRIVER" ||
    isLoading
  ) {
    return (
      <main className="driver-page">
        <div className="driver-loading">
          <div className="driver-loading-mark">
            <CarIcon />
          </div>
          <strong>Loading Bullet...</strong>
          <span>Preparing your driver dashboard.</span>
        </div>
      </main>
    );
  }

  const driverName = session.user.name;
  const firstName =
    driverName.trim().split(/\s+/)[0] || driverName;

  const vehicleStatusLabel =
    vehicle?.status === "ON_RIDE"
      ? "On ride"
      : vehicle?.status === "ONLINE"
        ? "Online"
        : "Offline";

  let transitionAction:
    | "arrive"
    | "start"
    | "complete"
    | null = null;
  let transitionLabel = "";

  if (activeRide?.status === "ACCEPTED") {
    transitionAction = "arrive";
    transitionLabel = "Mark as arrived";
  } else if (
    activeRide?.status === "DRIVER_ARRIVED"
  ) {
    transitionAction = "start";
    transitionLabel = "Start ride";
  } else if (activeRide?.status === "STARTED") {
    transitionAction = "complete";
    transitionLabel = "Complete ride";
  }

  return (
    <main className="driver-page">
      <header className="driver-header">
        <div className="driver-container driver-header-inner">
          <button
            type="button"
            className="driver-brand"
            onClick={() => router.push("/")}
            aria-label="Dhaka Tesla Pool home"
          >
            <span className="driver-brand-mark">
              <CarIcon />
            </span>
            <span>
              <strong>Dhaka Tesla Pool</strong>
              <small>Driver console</small>
            </span>
          </button>

          <div className="driver-user">
            <div className="driver-user-copy">
              <strong>{driverName}</strong>
              <span>Pool driver</span>
            </div>

            <span className="driver-avatar">
              {getInitials(driverName)}
            </span>

            <button
              type="button"
              className="driver-logout"
              onClick={handleLogout}
            >
              <LogoutIcon />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="driver-container driver-content">
        <section className="driver-welcome">
          <div>
            <p className="driver-eyebrow">
              Driver dashboard
            </p>
            <h1>Good morning, {firstName}.</h1>
            <p>
              Manage Bullet, build a safe pool, and keep
              every passenger moving through Dhaka.
            </p>
          </div>

          <div
            className={`driver-live-status driver-live-status-${(
              vehicle?.status ?? "OFFLINE"
            ).toLowerCase()}`}
          >
            <span />
            {vehicleStatusLabel}
          </div>
        </section>

        {error ? (
          <div
            className="driver-message driver-message-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className="driver-message driver-message-success"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <section className="driver-overview-grid">
          <article className="driver-card driver-active-card">
            <div className="driver-card-heading">
              <div>
                <p className="driver-eyebrow">
                  Current assignment
                </p>
                <h2>Active pool</h2>
              </div>

              {activeRide ? (
                <span
                  className={`driver-ride-status driver-ride-status-${activeRide.status.toLowerCase()}`}
                >
                  {STATUS_LABELS[activeRide.status]}
                </span>
              ) : null}
            </div>

            {activeRide ? (
              <>
                <div className="driver-active-route">
                  <div>
                    <span>Pickup</span>
                    <strong>
                      {ZONE_LABELS[activeRide.pickupZone]}
                    </strong>
                  </div>

                  <div className="driver-route-line">
                    <span />
                    <RouteArrow />
                    <span />
                  </div>

                  <div>
                    <span>Pool direction</span>
                    <strong>
                      {
                        ZONE_LABELS[
                          activeRide.destinationZone
                        ]
                      }
                    </strong>
                  </div>
                </div>

                <div className="driver-passenger-list">
                  {activeRide.passengers.map(
                    (passenger) => (
                      <div
                        className="driver-passenger"
                        key={passenger.id}
                      >
                        <span className="driver-passenger-avatar">
                          {getInitials(
                            passenger.passenger.name,
                          )}
                        </span>

                        <div className="driver-passenger-main">
                          <strong>
                            {passenger.passenger.name}
                          </strong>
                          <span>
                            {
                              ZONE_LABELS[
                                passenger.pickupZone
                              ]
                            }
                            {" → "}
                            {
                              ZONE_LABELS[
                                passenger.destinationZone
                              ]
                            }
                          </span>
                        </div>

                        <div className="driver-passenger-seats">
                          <strong>
                            {passenger.seats}
                          </strong>
                          <span>
                            {passenger.seats === 1
                              ? "seat"
                              : "seats"}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="driver-progress">
                  <span
                    className={
                      activeRide.status === "ACCEPTED"
                        ? "driver-progress-step driver-progress-current"
                        : "driver-progress-step driver-progress-done"
                    }
                  >
                    Accepted
                  </span>

                  <span
                    className={
                      activeRide.status ===
                      "DRIVER_ARRIVED"
                        ? "driver-progress-step driver-progress-current"
                        : activeRide.status ===
                            "STARTED"
                          ? "driver-progress-step driver-progress-done"
                          : "driver-progress-step"
                    }
                  >
                    Arrival
                  </span>

                  <span
                    className={
                      activeRide.status === "STARTED"
                        ? "driver-progress-step driver-progress-current"
                        : "driver-progress-step"
                    }
                  >
                    Ride
                  </span>
                </div>

                {transitionAction ? (
                  <button
                    type="button"
                    className="driver-primary-action"
                    disabled={isTransitioning}
                    onClick={() =>
                      void handleRideTransition(
                        transitionAction,
                      )
                    }
                  >
                    {isTransitioning
                      ? "Updating ride..."
                      : transitionLabel}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="driver-empty-active">
                <span className="driver-empty-icon">
                  <RouteArrow />
                </span>
                <h3>No active pool yet.</h3>
                <p>
                  Go online and accept a passenger request
                  to start building Bullet&apos;s next pool.
                </p>
              </div>
            )}
          </article>

          <aside className="driver-card driver-vehicle-card">
            <div className="driver-card-heading">
              <div>
                <p className="driver-eyebrow">
                  Your vehicle
                </p>
                <h2>{vehicle?.name ?? "Bullet"}</h2>
              </div>

              <span className="driver-tesla-badge">
                Tesla
              </span>
            </div>

            <div className="driver-car-visual">
              <div className="driver-car-body">
                <span className="driver-car-window" />
                <span className="driver-car-wheel driver-car-wheel-left" />
                <span className="driver-car-wheel driver-car-wheel-right" />
              </div>
            </div>

            <div className="driver-capacity">
              <div>
                <span>Pool capacity</span>
                <strong>
                  {occupiedSeats} /{" "}
                  {vehicle?.capacity ?? 3}
                </strong>
              </div>

              <div className="driver-seat-dots">
                {Array.from({
                  length: vehicle?.capacity ?? 3,
                }).map((_, index) => (
                  <span
                    key={index}
                    className={
                      index < occupiedSeats
                        ? "driver-seat-dot driver-seat-dot-filled"
                        : "driver-seat-dot"
                    }
                  />
                ))}
              </div>

              <p>
                {availableSeats}{" "}
                {availableSeats === 1
                  ? "seat"
                  : "seats"}{" "}
                available
              </p>
            </div>

            <div className="driver-vehicle-status-row">
              <div>
                <span>Vehicle status</span>
                <strong>{vehicleStatusLabel}</strong>
              </div>

              <span
                className={`driver-status-dot driver-status-dot-${(
                  vehicle?.status ?? "OFFLINE"
                ).toLowerCase()}`}
              />
            </div>

            <button
              type="button"
              className={
                vehicle?.status === "ONLINE"
                  ? "driver-status-button driver-status-button-offline"
                  : "driver-status-button"
              }
              disabled={
                isChangingStatus ||
                vehicle?.status === "ON_RIDE"
              }
              onClick={() =>
                void handleVehicleStatus()
              }
            >
              {isChangingStatus
                ? "Updating..."
                : vehicle?.status === "ON_RIDE"
                  ? "Ride in progress"
                  : vehicle?.status === "ONLINE"
                    ? "Go offline"
                    : "Go online"}
            </button>
          </aside>
        </section>

        <section className="driver-requests-section">
          <div className="driver-section-heading">
            <div>
              <p className="driver-eyebrow">
                Nearby demand
              </p>
              <h2>Available requests</h2>
            </div>

            <span>
              {vehicle?.status === "ONLINE"
                ? `${requests.length} ${
                    requests.length === 1
                      ? "request"
                      : "requests"
                  }`
                : vehicle?.status === "ON_RIDE"
                  ? "Paused during ride"
                  : "Go online to view"}
            </span>
          </div>

          {vehicle?.status === "ON_RIDE" ? (
            <div className="driver-section-empty">
              <h3>Bullet is currently on a ride.</h3>
              <p>
                New passenger requests are paused until the
                active ride is completed.
              </p>
            </div>
          ) : vehicle?.status === "OFFLINE" ? (
            <div className="driver-section-empty">
              <h3>Bullet is offline.</h3>
              <p>
                Go online when you are ready to receive
                passenger requests.
              </p>
            </div>
          ) : requests.length > 0 ? (
            <div className="driver-request-list">
              {requests.map((request) => {
                const requestSeats =
                  getRideSeatCount(request);

                return (
                  <article
                    className="driver-request-row"
                    key={request.id}
                  >
                    <div className="driver-request-person">
                      <span className="driver-passenger-avatar">
                        {getInitials(
                          request.passengers[0]
                            ?.passenger.name ??
                            "Passenger",
                        )}
                      </span>

                      <div>
                        <strong>
                          {request.passengers
                            .map(
                              (passenger) =>
                                passenger.passenger.name,
                            )
                            .join(", ")}
                        </strong>
                        <span>
                          Requested{" "}
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="driver-request-route">
                      <strong>
                        {
                          ZONE_LABELS[
                            request.pickupZone
                          ]
                        }
                      </strong>
                      <RouteArrow />
                      <strong>
                        {
                          ZONE_LABELS[
                            request.destinationZone
                          ]
                        }
                      </strong>
                    </div>

                    <div className="driver-request-seats">
                      <span>Seats</span>
                      <strong>{requestSeats}</strong>
                    </div>

                    <button
                      type="button"
                      className="driver-accept-button"
                      disabled={
                        acceptingRideId === request.id ||
                        Boolean(activeRide)
                      }
                      onClick={() =>
                        void handleAccept(request.id)
                      }
                    >
                      {acceptingRideId === request.id
                        ? "Accepting..."
                        : activeRide
                          ? "Pool active"
                          : "Accept"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="driver-section-empty">
              <h3>No waiting requests right now.</h3>
              <p>
                You are online. New passenger requests
                will appear here when they become
                available.
              </p>
            </div>
          )}
        </section>

        <section className="driver-history-section">
          <div className="driver-section-heading">
            <div>
              <p className="driver-eyebrow">
                Recent activity
              </p>
              <h2>Ride history</h2>
            </div>

            <span>
              {history.length}{" "}
              {history.length === 1
                ? "completed ride"
                : "completed rides"}
            </span>
          </div>

          {history.length > 0 ? (
            <div className="driver-history-list">
              {history.map((ride) => (
                <article
                  className="driver-history-row"
                  key={ride.id}
                >
                  <div className="driver-history-route">
                    <span className="driver-history-icon">
                      <RouteArrow />
                    </span>

                    <div>
                      <strong>
                        {ZONE_LABELS[ride.pickupZone]}
                        <span>→</span>
                        {
                          ZONE_LABELS[
                            ride.destinationZone
                          ]
                        }
                      </strong>
                      <p>
                        {formatDate(
                          ride.completedAt ??
                            ride.updatedAt,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="driver-history-meta">
                    <div>
                      <span>Passengers</span>
                      <strong>
                        {ride.passengers.length}
                      </strong>
                    </div>

                    <div>
                      <span>Seats</span>
                      <strong>
                        {getRideSeatCount(ride)}
                      </strong>
                    </div>

                    <span className="driver-history-complete">
                      Completed
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="driver-section-empty">
              <p>
                Completed pools will appear here after
                your first trip.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
