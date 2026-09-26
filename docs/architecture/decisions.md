# Architecture Decisions

This document records the main technical decisions implemented in Dhaka Tesla Pool, including the trade-offs behind them.

## 1. Architecture: Modular Monolith

Dhaka Tesla Pool uses a modular monolith consisting of:

- a Next.js web application
- a Fastify API
- a PostgreSQL database

The backend separates authentication, HTTP routes, domain rules, application services, and persistence concerns while remaining one deployable API.

### Why

The core engineering difficulty is transactional business logic: pooling, capacity, fares, authorization, lifecycle transitions, and concurrency.

Microservices would add deployment, networking, observability, distributed-data, and failure-handling complexity without improving those requirements.

### Trade-off

A larger production platform might eventually benefit from independently deployable services, but the assessment benefits more from a single strong transactional boundary.

## 2. Language: TypeScript

TypeScript is used across the frontend and backend.

### Why

Shared language and static typing make API contracts and domain concepts such as roles, ride states, zones, vehicle states, seat counts, and fares easier to reason about.

Runtime validation is still required because TypeScript types do not validate untrusted HTTP input.

## 3. Frontend: Next.js App Router

The frontend uses Next.js with the App Router and React.

### Why

Next.js provides routing, layouts, production builds, and a structured React application model while keeping the passenger and driver experiences in one web application.

### Trade-off

A plain React SPA would have less framework surface, but Next.js provides a clearer application structure for the assessment.

## 4. Backend: Fastify REST API

The backend uses Node.js with Fastify and exposes REST endpoints.

### Why Fastify

Fastify provides a small, performant HTTP layer without requiring the broader framework conventions of a larger backend framework.

The project keeps domain rules in explicit modules and services rather than embedding them in route handlers.

### Why REST

The main operations naturally map to commands and resources:

- authenticate
- request a ride
- cancel a request
- change vehicle availability
- accept a ride
- mark driver arrival
- start a ride
- complete a ride

GraphQL would add complexity without providing a meaningful advantage for this scope.

## 5. Database: PostgreSQL

PostgreSQL is the primary persistence and consistency layer.

### Why

Ride pooling is relational and concurrency-sensitive.

The application needs:

- transactions
- row-level locking
- relational constraints
- atomic membership updates
- consistent capacity checks

PostgreSQL provides these capabilities directly and predictably.

## 6. ORM: Prisma with Targeted SQL Locking

Prisma provides the primary database access layer, generated types, schema definition, migrations, and normal relational queries.

Raw SQL is used selectively where explicit PostgreSQL row locking is required.

### Why

Most persistence operations benefit from Prisma's type-safe application model.

Concurrency-sensitive seat allocation, however, requires explicit `SELECT ... FOR UPDATE` semantics. Using targeted SQL inside a Prisma transaction keeps normal persistence ergonomic without hiding the database mechanism required for correctness.

### Trade-off

This creates a small amount of database-specific SQL, so the concurrency implementation is PostgreSQL-aware.

That trade-off is intentional because correctness under contention is more important than pretending the persistence layer is database-agnostic.

## 7. Persistence Model: `Ride` + `RidePassenger`

The implementation uses four main persisted entities:

- `User`
- `Vehicle`
- `Ride`
- `RidePassenger`

A separate `RideRequest` table and `RidePool` table are not used.

### Why

A standalone request and a shared pool have overlapping lifecycle and routing concepts.

A new passenger initially receives:

```text
Ride
└── RidePassenger
```

If that request matches an existing pool, its `RidePassenger` record moves to the existing `Ride` and the now-empty standalone `Ride` is deleted.

This allows `Ride` to represent the shared lifecycle and vehicle assignment while `RidePassenger` stores passenger-specific:

- pickup
- destination
- seats
- fare
- status

### Trade-off

The meaning of `Ride` depends partly on its state and memberships rather than having separate request/pool tables.

The benefit is a smaller relational model with one canonical shared-ride aggregate.

## 8. Validation: Zod + Database Constraints

Zod validates request data at application boundaries.

Database constraints protect integrity rules that should remain true regardless of application behavior.

Examples include positive capacity, positive requested seats, and non-negative fares.

### Why

Validation belongs at more than one layer.

Zod provides useful API errors, while database constraints provide a final integrity boundary.

## 9. Authentication: JWT + bcrypt

The MVP uses local email/password authentication.

Passwords are hashed with bcrypt and authenticated API requests use JWT access tokens.

### Why

The approach is reproducible in Docker and does not depend on an external identity provider during evaluation.

Role authorization is enforced by the API for `PASSENGER` and `DRIVER` operations.

### Browser Storage Trade-off

The assessment web client stores the JWT in `sessionStorage`.

This is simple for a separated local web/API setup, but JavaScript-readable token storage has an XSS exposure trade-off.

A production system would preferably use a hardened same-origin authentication design with secure `HttpOnly` and `SameSite` cookies, together with additional account-security controls.

## 10. Money Representation: Integer Poisha

Money is stored as integer poisha.

Examples:

```text
BDT 120.50 = 12,050 poisha
BDT 88.00  = 8,800 poisha
```

### Why

Integer storage avoids floating-point currency errors and makes fare calculations deterministic and testable.

Each `RidePassenger` owns its own `farePoisha`, preserving individual fares inside a shared pool.

## 11. Fare Model: Deterministic Server-Side Pricing

The MVP uses:

```text
base fare       = 5,000 poisha
per-km rate     = 2,000 poisha
pool discount   = 20%
```

The API calculates the fare from a predefined route distance.

The browser does not submit an authoritative fare.

### Why

The assessment requires understandable and testable individual fares, not a production ride-hailing pricing engine.

A deterministic formula makes correctness easy to demonstrate.

## 12. Routing: Predefined Dhaka Zones and Corridors

The MVP does not use a commercial mapping service.

Supported routes use predefined directed distances, and pooling compatibility uses predefined Dhaka corridors.

### Why

The engineering focus is pooling and transactional correctness rather than map integration.

This approach also keeps tests deterministic and removes network/API-key dependencies from the evaluator setup.

### Trade-off

The system does not account for:

- live traffic
- actual road geometry
- dynamic ETAs
- route deviations
- arbitrary addresses

Those would require a different routing model in a production service.

## 13. Pool Matching: Automatic Compatible Join

A passenger request is created as a standalone `REQUESTED` ride and then automatically attempts matching.

A compatible request can join an existing pool when:

- the pool has an assigned vehicle
- the vehicle is online
- the pool remains open for matching
- route compatibility succeeds
- sufficient capacity remains

Open matching states are:

```text
REQUESTED
MATCHED
ACCEPTED
```

### Accepted Pool Behavior

A later compatible passenger may join an already `ACCEPTED` pool.

That passenger becomes `ACCEPTED`, and the parent ride remains `ACCEPTED`.

### Why

Requiring the driver to manually re-accept every later passenger would add UI interaction without improving the deterministic pooling model.

The accepted ride must also never regress to `MATCHED` when a new passenger joins.

## 14. Capacity and Concurrency: Lock, Then Revalidate

Vehicle capacity is authoritative only on the backend.

The important invariant is:

```text
sum(active passenger seats) <= vehicle.capacity
```

For a contested pool match, the application performs the operation inside a PostgreSQL transaction.

The service:

1. locks the standalone request `Ride`
2. identifies a compatible candidate
3. locks the candidate `Ride`
4. revalidates its state and vehicle assignment
5. locks the `Vehicle`
6. revalidates that the vehicle is online
7. recalculates occupied seats
8. verifies the new request still fits
9. moves the membership atomically
10. removes the empty standalone ride

The row locks use `SELECT ... FOR UPDATE`.

### Why Recheck After Locking

An earlier availability read can become stale while another transaction is running.

Capacity therefore must be recalculated after the protected rows are locked.

This prevents two concurrent requests from both claiming Bullet's final available seat.

### Verification

The automated test suite includes:

- lower-level concurrent pool matching
- final-seat contention against an accepted pool
- concurrent production `createRideRequest()` calls

The production-path test starts with two of Bullet's three seats occupied and sends two simultaneous one-seat requests. Only one joins the pool; the other remains a standalone `REQUESTED` ride.

## 15. Driver Active-Ride Invariant

A driver must not accept multiple unrelated active rides.

Driver acceptance locks the driver's vehicle before checking whether that vehicle already owns a ride in one of these states:

```text
ACCEPTED
DRIVER_ARRIVED
STARTED
```

If such a ride exists, the independent acceptance is rejected.

### Why the Vehicle Is Locked First

Two simultaneous accept requests from the same driver could otherwise both observe no existing active ride.

Serializing the operations on the vehicle row ensures the second transaction sees the result of the first.

Compatible passengers should join the existing pool rather than creating independent active rides for the same vehicle.

## 16. Ride Lifecycle: Explicit State Machine

Ride transitions are explicitly defined and validated.

Primary progression:

```text
REQUESTED
→ MATCHED
→ ACCEPTED
→ DRIVER_ARRIVED
→ STARTED
→ COMPLETED
```

Cancellation is supported only from valid pre-completion states.

`COMPLETED` and `CANCELLED` are terminal.

### Why

Lifecycle state is business data, not presentation state.

Explicit transitions prevent clients from skipping required stages or moving completed rides backwards.

## 17. Privacy: Shape Data at the API Boundary

Passenger fare privacy is enforced in backend queries and response projections.

Passengers receive their own ride membership and fare information.

Driver active/history queries deliberately do not select passenger `farePoisha`.

### Why

Sensitive or private data should not be sent to a client merely because the UI currently hides it.

Excluding the field at the server boundary produces a stronger privacy guarantee.

## 18. Vehicle State

Vehicles use:

```text
OFFLINE
ONLINE
ON_RIDE
```

Jashim must take Bullet online before normal request acceptance/matching operations.

When a ride starts, Bullet becomes `ON_RIDE`.

When the ride completes, Bullet returns to `ONLINE`.

### Why

Vehicle availability is separate from ride lifecycle state.

This prevents a vehicle that is offline or currently executing a ride from being treated as freely available.

## 19. Docker Compose as the Reproducible Runtime

Docker Compose is the evaluator-friendly runtime baseline.

The stack contains:

- PostgreSQL
- a one-shot database initialization service
- Fastify API
- Next.js web application

Startup dependencies are health-aware:

```text
PostgreSQL healthy
        ↓
migrations + story seed complete
        ↓
API healthy
        ↓
web starts
```

### Why

The evaluator should not need to manually create tables, remember migration commands, or construct the story data before using the application.

The target command is:

```bash
docker compose up --build
```

## 20. Deterministic Story Seed

The seed creates:

- Jashim
- Nusrat
- Rafiq
- Shirin
- Bullet

Bullet is assigned to Jashim with capacity `3` and starts `OFFLINE`.

The seed can be run repeatedly without intentionally creating duplicate story users or vehicles.

### Why

A deterministic seed makes the assessment demo reproducible and provides known accounts for browser-level testing.

It intentionally does not pre-create rides, so the evaluator can exercise the actual application flow.

## 21. Testing Strategy: Domain + Integration + Concurrency

Testing is not limited to HTTP happy paths.

The suite covers:

- pure domain rules
- authentication and authorization
- passenger routes
- driver routes
- database-backed services
- cancellation
- lifecycle transitions
- story integration
- privacy boundaries
- capacity races
- driver acceptance races

At the current assessment milestone, the API regression suite contains:

```text
25 test files
185 passing tests
```

### Why

The most important risks in this application are business-rule and concurrency failures.

Those need executable verification rather than relying only on manual UI testing.

## 22. Container and Deployment Scope

Docker Compose is the reproducible deployment baseline for the assessment.

A public hosted deployment is optional and should not change the domain architecture.

### Trade-off

The current Docker images prioritize straightforward reproducibility over aggressive image-size optimization.

A production deployment could further optimize build layers, runtime dependencies, secrets management, observability, TLS, and infrastructure configuration.

## 23. Deliberate MVP Boundaries

The following are intentionally outside the current scope:

- real-time GPS
- live traffic
- commercial map APIs
- arbitrary pickup addresses
- payment processing
- dynamic surge pricing
- push notifications
- MFA
- password recovery
- refresh-token rotation
- multi-region infrastructure
- microservices

These are product and infrastructure expansions, not requirements for demonstrating the core pooling, lifecycle, privacy, and concurrency behavior.
