# ReliabilityOS

Predictive maintenance platform for oil and gas pipeline operators. Built as a full-stack demonstration of enterprise software architecture: multi-tenant backend, role-based access control, real-time alerting, and vendor data ingestion.

## Overview

ReliabilityOS gives pipeline operators a single system for monitoring asset health, managing sensor data from third-party vendors, and coordinating work across technician, manager, and admin roles. The core platform is built and verified end to end; the repository also contains additional exploratory components (see "Additional Components" below) that are not yet integrated into the live application.

## Core Platform (Built and Verified)

- **Multi-tenant backend**: separate per-organization databases with a shared control plane, built on PostgreSQL and Express.
- **Role-based access control**: technician, manager, and admin roles, enforced on both the API and the frontend.
- **Authentication flow**: admin-driven user invites, email verification, and a live-updating "waiting for role assignment" screen that automatically admits a user the moment an admin assigns their role, with no manual refresh required.
- **Vendor data import**: an admin-facing CSV upload pipeline for vendor-supplied sensor readings, asset specifications, and incident logs, with per-row validation and error reporting.
- **Real-time updates**: Socket.IO powers live alert and work order updates across connected clients.
- **Core operational views**: pipeline map, sensor health, work orders, alerts, PIG run comparison, ROI tracking, and compliance reporting.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend API | Node.js, Express, TypeScript, Socket.IO |
| Database | PostgreSQL (multi-tenant: control-plane + per-organization databases) |
| Authentication | JWT, role-based middleware |

## Getting Started

### Backend


The frontend expects the API to be running locally; see `frontend/src/services/api.ts` for the base URL configuration.

## Additional Components

The repository also includes the following, present as code but not currently wired into the live application:

- `backend/ai` and `backend/ai-service` — Python-based anomaly detection, remaining-useful-life prediction, and root-cause classification models.
- `edge` — a Python edge gateway for field sensor connectivity (MQTT bridge, offline buffering, local alarm rules).
- `simulator` — a synthetic sensor data generator for demo scenarios.

These represent the intended direction of the platform's predictive capabilities but are not yet connected to the core application's data flow.

## License

MIT — see `LICENSE`.