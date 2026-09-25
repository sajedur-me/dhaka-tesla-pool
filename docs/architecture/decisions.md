# Architecture Decisions

This document records the main technical decisions for Dhaka Tesla Pool and the trade-offs behind them.

## 1. Architecture: Modular Monolith

Dhaka Tesla Pool will use a modular monolith consisting of:

- A Next.js web application
- A Node.js API
- A PostgreSQL database

The backend will be organized into clear business modules such as authentication, passengers, drivers, vehicles, ride requests, pools, fares, and ride lifecycle management.

### Why

The assessment requires meaningful business rules around pooling, capacity, fares, authorization, state transitions, and concurrency, but it does not require the operational complexity of microservices.

A modular monolith keeps the system simple to run and test while maintaining clear domain boundaries.

### Alternative Considered

Microservices were rejected for the MVP because they would introduce unnecessary deployment, networking, observability, and distributed-data complexity without improving the core assessment requirements.

## 2. Language: TypeScript

TypeScript will be used across the frontend and backend.

### Why

Shared language and strong typing reduce accidental contract mismatches and make domain concepts such as ride states, seat counts, fares, and API payloads easier to reason about.

## 3. Frontend: Next.js App Router

The frontend will use Next.js with the App Router.

### Why

Next.js provides a structured React application model, routing, layouts, loading and error states, and a strong production build system while still satisfying the React requirement.

### Trade-off

A plain React application would have less framework complexity, but Next.js provides stronger application structure for this project.
## 4. Backend: Fastify

The API will use Node.js with Fastify.

### Why

Fastify is lightweight, performant, and well suited to a typed REST API without introducing the larger framework surface of NestJS.

### Alternative Considered

Express has a larger ecosystem and is widely familiar, while NestJS provides more built-in architecture. Fastify was selected because the project benefits from a small API layer while domain structure remains explicit in application code.

## 5. API Style: REST

The frontend and backend will communicate through REST endpoints.

### Why

The domain operations map naturally to resources and commands such as requesting a ride, accepting a pool, cancelling a request, and advancing ride status.

GraphQL would add unnecessary complexity for the current requirements.

## 6. Database: PostgreSQL

PostgreSQL will be the primary database.

### Why

Ride pooling contains relational data and requires strong consistency for seat capacity, ride membership, lifecycle state, and concurrent booking attempts.

PostgreSQL transactions and constraints make it a strong fit for these requirements.

## 7. ORM: Prisma

Prisma will provide the main database access layer and migrations.

### Why

Prisma provides a clear schema, generated TypeScript types, migrations, and productive relational querying.

For concurrency-sensitive operations, transaction-specific or raw SQL techniques may be used when stronger database-level control is required.

### Alternative Considered

Drizzle offers a SQL-oriented approach with excellent TypeScript support. Prisma was selected for its schema clarity and migration workflow, while retaining the option to use SQL where necessary.
## 8. Validation: Zod

Zod will validate data at application boundaries.

### Why

API input must not be trusted. Zod provides explicit runtime validation while integrating naturally with TypeScript.

Database constraints remain the final integrity boundary for rules that must never be violated.

## 9. Authentication

The MVP will use local email/password authentication with securely hashed passwords and short-lived JWT access tokens.

### Why

This keeps authentication reproducible in Docker and avoids depending on a third-party identity provider during evaluation.

A production system requiring features such as social login, MFA, or advanced account recovery could use a dedicated identity provider.

## 10. Money Representation

Money will be stored as integer poisha.

For example:

- BDT 120.50 = 12050 poisha
- BDT 75.00 = 7500 poisha

### Why

Integer storage avoids floating-point rounding errors and keeps fare calculations deterministic and testable.

## 11. Capacity and Concurrency

Vehicle capacity will be enforced by the backend within a database transaction.

Client-side availability is never authoritative.

When multiple passengers compete for the final available seat, the database transaction must ensure that only a valid booking succeeds and that occupied seats never exceed vehicle capacity.

The exact locking strategy will be finalized with the persistence model and verified through a concurrency test.
## 12. Containerization

Docker Compose will provide the local runtime baseline.

The project will include:

- Application container(s)
- PostgreSQL container
- Environment configuration example
- Database migrations
- Story-based seed data
- Health checks where practical

The target developer experience is:

```bash
docker compose up
## 13. Deployment

The application will target a free or free-tier public deployment where practical.

Regardless of hosting availability, Docker Compose will remain the reproducible deployment baseline for evaluators.
