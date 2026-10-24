import { createAuthClient } from "better-auth/react";

// No baseURL needed: the browser talks to the same origin as the page.
export const authClient = createAuthClient();