# TODO

- [ ] Fix TopBar sign-out button overlap with "Sim Leak" indicator.
  - [ ] Reflow sign-out to the right of "Sim Leak" with 16px gap.
  - [ ] Remove absolute positioning.
  - [ ] Add responsive fallback: icon-only logout button (lucide icon, #9BA3B2, 16px, tooltip "Sign out") when horizontal space is constrained.
  - [ ] Ensure click still clears ros_session and redirects to /login (via existing onSignOut).
- [ ] Run frontend typecheck/build to verify no TS/React errors.

