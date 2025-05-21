export interface CallReservation {
  id: number;
  username: string;
  reservationDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: ReservationStatus;
  phoneNumber: string | null;
  callDuration: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus =
  | "scheduled"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface CreateReservationDto {
  username: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  phoneNumber?: string;
}
