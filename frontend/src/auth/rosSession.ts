export type UserRole = "technician" | "manager" | "admin";

export interface RosUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type RosSession = {
  token: string;
  user: RosUser;
};

const ROS_SESSION_KEY = "ros_session";

// Decodes the JWT payload client-side to read `exp` without verifying the
// signature (we can't verify without JWT_SECRET, which never reaches the
// browser). This is only used to proactively clear an obviously-expired
// token before making a request; the backend remains the real authority
// and will reject an invalid/expired token regardless.
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getRosSession(): RosSession | null {
  try {
    const raw = localStorage.getItem(ROS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const validUser =
      parsed &&
      parsed.user &&
      typeof parsed.token === "string" &&
      typeof parsed.user.id === "string" &&
      typeof parsed.user.email === "string" &&
      typeof parsed.user.name === "string" &&
      (parsed.user.role === "technician" ||
        parsed.user.role === "manager" ||
        parsed.user.role === "admin");

    if (!validUser) return null;

    const expiryMs = decodeJwtExpiryMs(parsed.token);
    if (expiryMs !== null && Date.now() >= expiryMs) {
      localStorage.removeItem(ROS_SESSION_KEY);
      return null;
    }

    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export function setRosSession(session: RosSession): void {
  localStorage.setItem(ROS_SESSION_KEY, JSON.stringify(session));
}

export function clearRosSession(): void {
  localStorage.removeItem(ROS_SESSION_KEY);
}

export function getAuthToken(): string | null {
  return getRosSession()?.token ?? null;
}
