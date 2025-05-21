/* eslint-disable no-useless-catch */
import { reservationsApiClient } from "./apiClient";
import { reservationEndpoints } from "./apiEndpoints";
import type {
  CallReservation,
  CreateReservationDto,
} from "../types/reservation";

/**
 * Helper to check if a response contains ngrok authentication page
 */
const isNgrokError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.includes("Ngrok authentication required")
  );
};

/**
 * Create a new call reservation
 */
export const createReservation = async (
  data: CreateReservationDto
): Promise<CallReservation> => {
  try {
    const response = await reservationsApiClient.post(
      reservationEndpoints.create,
      data
    );
    return response.data.data;
  } catch (error) {
    if (isNgrokError(error)) {
      alert(
        "Ngrok authentication required. Please visit the ngrok URL in your browser and accept the terms."
      );
    }
    throw error;
  }
};

/**
 * Get all reservations for a specific user
 */
export const getUserReservations = async (
  username: string
): Promise<CallReservation[]> => {
  try {
    const response = await reservationsApiClient.get(
      reservationEndpoints.getByUser(username)
    );
    return response.data?.data || [];
  } catch (error) {
    if (isNgrokError(error)) {
      alert(
        "Ngrok authentication required. Please visit the ngrok URL in your browser and accept the terms."
      );
    }
    return [];
  }
};

/**
 * Get a specific reservation by ID
 */
export const getReservationById = async (
  id: number
): Promise<CallReservation | null> => {
  try {
    const response = await reservationsApiClient.get(
      reservationEndpoints.getById(id)
    );
    return response.data.data;
  } catch (error) {
    if (isNgrokError(error)) {
      alert(
        "Ngrok authentication required. Please visit the ngrok URL in your browser and accept the terms."
      );
    }
    return null;
  }
};

/**
 * Update a reservation
 */
export const updateReservation = async (
  id: number,
  data: Partial<CallReservation>
): Promise<CallReservation | null> => {
  try {
    const response = await reservationsApiClient.put(
      reservationEndpoints.update(id),
      data
    );
    return response.data.data;
  } catch (error) {
    if (isNgrokError(error)) {
      alert(
        "Ngrok authentication required. Please visit the ngrok URL in your browser and accept the terms."
      );
    }
    return null;
  }
};

/**
 * Start a call for a specific reservation
 * This updates the reservation status to "ongoing"
 */
export const startReservationCall = async (
  id: number
): Promise<CallReservation | null> => {
  return updateReservation(id, { status: "ongoing" });
};

/**
 * End a reservation call and update the status to completed
 * @param id Reservation ID
 * @param duration Call duration in seconds
 * @returns Updated reservation data
 */
export const endReservationCall = async (
  id: number,
  duration: number
): Promise<CallReservation> => {
  const callDuration = duration > 0 ? duration : 0;
  return updateReservation(id, {
    status: "completed",
    callDuration,
  }) as Promise<CallReservation>;
};

/**
 * Check and update all reservations that are past their end time
 * but still marked as ongoing
 */
export const updateExpiredReservations = async (): Promise<
  CallReservation[]
> => {
  try {
    const response = await reservationsApiClient.post("/update-expired");
    return response.data?.data || [];
  } catch (error) {
    if (isNgrokError(error)) {
      alert(
        "Ngrok authentication required. Please visit the ngrok URL in your browser and accept the terms."
      );
    }
    return [];
  }
};
