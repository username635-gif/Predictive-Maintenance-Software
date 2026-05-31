export type RosRole = 'engineer';

export type RosSession = {
  authenticated: true;
  role: RosRole;
};

const ROS_SESSION_KEY = 'ros_session';

export function getRosSession(): RosSession | null {
  try {
    const raw = localStorage.getItem(ROS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (parsed && parsed.authenticated === true && (parsed.role === 'engineer' || parsed.role === 'Engineer')) {
      return { authenticated: true, role: 'engineer' };
    }

    return null;
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

