import { DEMO_USER } from "./demo-data";

export function getDemoSession() {
  return {
    user: {
      id: DEMO_USER.id,
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      emailVerified: DEMO_USER.emailVerified,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
