/**
 * API Endpoints for the application
 * This file centralizes all API endpoints to ensure consistency
 */

// Twilio endpoints
export const twilioEndpoints = {
  token: "token",
  voice: "voice",
  incoming: "incoming",
  status: "status",
};

// Reservation endpoints
export const reservationEndpoints = {
  create: "",
  list: "",
  getByUser: (username: string) => `/user/${username}`,
  getById: (id: number) => `/${id}`,
  update: (id: number) => `/${id}`,
};

// Export all endpoints for convenience
export default {
  twilio: twilioEndpoints,
  reservations: reservationEndpoints,
};
