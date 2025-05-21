import { useState } from "react";
import type { FormEvent } from "react";
import type { CreateReservationDto } from "../types/reservation";
import { createReservation } from "../utils/reservationApi";

interface ReservationFormProps {
  username: string;
  onSuccess?: () => void;
}

// Input field props type definition
type FormFieldProps = {
  label: string;
  name: string;
  type: string;
  value: string;
  required?: boolean;
  placeholder?: string;
};

const ReservationForm = ({ username, onSuccess }: ReservationFormProps) => {
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateReservationDto>({
    username,
    reservationDate: today,
    startTime: "",
    endTime: "",
    phoneNumber: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.startTime || !formData.endTime || !formData.reservationDate) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createReservation(formData);

      // Reset form
      setFormData({
        ...formData,
        reservationDate: today,
        startTime: "",
        endTime: "",
        phoneNumber: "",
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create reservation"
      );
    } finally {
      setLoading(false);
    }
  };

  // Input field component to reduce repetition
  const FormField = ({
    label,
    name,
    type,
    value,
    required = false,
    placeholder = "",
  }: FormFieldProps) => (
    <div className={type === "time" ? "" : "mb-4"}>
      <label className="block text-gray-700 mb-1">
        {label} {required && "*"}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-gray-300 rounded"
        placeholder={placeholder}
        required={required}
      />
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Schedule a Call</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormField
          label="Phone Number"
          name="phoneNumber"
          type="text"
          value={formData.phoneNumber || ""}
          placeholder="e.g. +1234567890"
        />

        <FormField
          label="Date"
          name="reservationDate"
          type="date"
          value={formData.reservationDate}
          required
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            label="Start Time"
            name="startTime"
            type="time"
            value={formData.startTime}
            required
          />
          <FormField
            label="End Time"
            name="endTime"
            type="time"
            value={formData.endTime}
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 rounded ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? "Creating..." : "Create Reservation"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReservationForm;
