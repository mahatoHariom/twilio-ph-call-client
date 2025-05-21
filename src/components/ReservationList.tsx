import { useState, useEffect, useCallback, useRef, memo } from "react";
import type { CallReservation } from "../types/reservation";
import {
  getUserReservations,
  endReservationCall,
  updateReservation,
  updateExpiredReservations,
} from "../utils/reservationApi";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

interface ReservationListProps {
  username: string;
  onRefreshNeeded?: () => void;
  refreshTrigger?: number;
}

const ReservationList = ({
  username,
  onRefreshNeeded,
  refreshTrigger = 0,
}: ReservationListProps) => {
  const [reservations, setReservations] = useState<CallReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [recoveredFromRefresh, setRecoveredFromRefresh] = useState(false);

  // Refs for persisting values between renders
  const refs = useRef({
    callTimer: null as number | null,
    callStartTime: null as number | null,
    duration: 0,
    activeCall: null as number | null,
    lastCallStatus: "",
    refreshTimer: null as number | null,
    hasInitiallyLoaded: false,
    prevUsername: username,
    lastRefreshTrigger: refreshTrigger,
  });

  const {
    makeCall,
    callStatus,
    callInfo,
    endCall,
    initialize,
    isInitialized,
    isMuted,
    toggleMute,
  } = useTwilioVoice();

  // Update ref when activeCall changes
  useEffect(() => {
    refs.current.activeCall = activeCall;
  }, [activeCall]);

  const fetchReservations = useCallback(async () => {
    console.log(`Fetching reservations for ${username}`);
    try {
      setLoading(true);
      await updateExpiredReservations();
      const data = await getUserReservations(username);
      console.log(`Got ${data.length} reservations`);
      setReservations(data || []);

      if (recoveredFromRefresh) {
        setRecoveredFromRefresh(false);
      }

      setError(null);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setError("Failed to load reservations");
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [username, recoveredFromRefresh]);

  // Handle refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== refs.current.lastRefreshTrigger) {
      console.log(`Fetching reservations due to refreshTrigger change`);
      fetchReservations();
      refs.current.lastRefreshTrigger = refreshTrigger;
    }
  }, [refreshTrigger, fetchReservations]);

  // Call cleanup function
  const cleanupCall = useCallback(
    async (saveStatus = false) => {
      const currentActiveCall = refs.current.activeCall;

      if (refs.current.callTimer) {
        clearInterval(refs.current.callTimer);
        refs.current.callTimer = null;
      }

      if (saveStatus && currentActiveCall !== null) {
        const finalDuration =
          refs.current.duration > 0 ? refs.current.duration : 0;
        try {
          await endReservationCall(currentActiveCall, finalDuration);
        } catch {
          // Silent error handling for cleanup
        } finally {
          // Reset all call-related state
          setActiveCall(null);
          refs.current.activeCall = null;
          setCallDuration(0);
          refs.current.callStartTime = null;
          refs.current.duration = 0;
        }
      } else {
        // Reset all call-related state without API call
        setActiveCall(null);
        setCallDuration(0);
        refs.current.callStartTime = null;
        refs.current.duration = 0;
        refs.current.activeCall = null;
      }

      fetchReservations();
    },
    [fetchReservations]
  );

  // Initialize Twilio when username changes
  useEffect(() => {
    const initializeTwilio = async () => {
      if (!isInitialized || refs.current.prevUsername !== username) {
        try {
          if (activeCall !== null && refs.current.prevUsername !== username) {
            endCall();
            await cleanupCall(true);
          }

          await initialize(username);
          refs.current.prevUsername = username;
        } catch {
          setError(
            "Failed to initialize call device. Please try refreshing the page."
          );
        }
      }
    };

    initializeTwilio();
  }, [initialize, isInitialized, username, activeCall, endCall, cleanupCall]);

  // Handle call status changes
  useEffect(() => {
    if (refs.current.lastCallStatus === "open" && callStatus !== "open") {
      cleanupCall(true);
    }
    refs.current.lastCallStatus = callStatus;

    if (callStatus === "open" && activeCall && !refs.current.callTimer) {
      startCallTimer();
    }
  }, [callStatus, cleanupCall, activeCall]);

  // Check for call end time
  useEffect(() => {
    if (!refs.current.activeCall || callStatus !== "open") return;

    const checkEndTime = () => {
      if (!refs.current.activeCall) return;

      const activeReservation = reservations.find(
        (res) => res.id === refs.current.activeCall
      );
      if (!activeReservation) return;

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      if (today !== activeReservation.reservationDate) return;

      const [hour, minute] = activeReservation.endTime.split(":").map(Number);
      const endTimeDate = new Date(now);
      endTimeDate.setHours(hour, minute, 0, 0);

      if (now >= endTimeDate) {
        endCall();
        cleanupCall(true);
      }
    };

    checkEndTime();
    const timerId = setInterval(checkEndTime, 5000);
    return () => clearInterval(timerId);
  }, [reservations, callStatus, endCall, cleanupCall]);

  // Timer for active calls
  const startCallTimer = () => {
    if (!refs.current.callStartTime) {
      refs.current.callStartTime = Date.now();
      refs.current.duration = 0;
    }

    if (!refs.current.callTimer) {
      refs.current.callTimer = window.setInterval(() => {
        if (refs.current.callStartTime) {
          refs.current.duration = Math.floor(
            (Date.now() - refs.current.callStartTime) / 1000
          );
          setCallDuration(refs.current.duration);

          // Check if we've reached the end time during an active call
          if (refs.current.activeCall) {
            const activeReservation = reservations.find(
              (res) => res.id === refs.current.activeCall
            );
            if (activeReservation) {
              const now = new Date();
              const today = now.toISOString().split("T")[0];

              if (today === activeReservation.reservationDate) {
                const [hour, minute] = activeReservation.endTime
                  .split(":")
                  .map(Number);
                const endTimeDate = new Date(now);
                endTimeDate.setHours(hour, minute, 0, 0);

                if (now >= endTimeDate) {
                  endCall();
                  cleanupCall(true);
                }
              }
            }
          }
        }
      }, 1000);
    }
  };

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (refs.current.callTimer) {
        clearInterval(refs.current.callTimer);
        refs.current.callTimer = null;
      }
      if (refs.current.refreshTimer) {
        clearInterval(refs.current.refreshTimer);
        refs.current.refreshTimer = null;
      }
    };
  }, []);

  // Handle recovery after page refresh
  useEffect(() => {
    const recoverFromRefresh = async () => {
      if (refs.current.hasInitiallyLoaded || !isInitialized) return;

      try {
        const data = await getUserReservations(username);
        const ongoingReservation = data.find((res) => res.status === "ongoing");

        if (ongoingReservation) {
          await updateReservation(ongoingReservation.id, {
            status: "completed",
            callDuration: ongoingReservation.callDuration || 0,
          });
          setRecoveredFromRefresh(true);
        }

        refs.current.hasInitiallyLoaded = true;
        fetchReservations();
      } catch {
        refs.current.hasInitiallyLoaded = true;
      }
    };

    if (isInitialized) {
      recoverFromRefresh();
    }
  }, [isInitialized, username, fetchReservations]);

  // Periodically refresh reservations
  useEffect(() => {
    fetchReservations();

    if (refs.current.refreshTimer) {
      clearInterval(refs.current.refreshTimer);
    }

    // Refresh less frequently during active calls
    const refreshInterval = activeCall ? 120000 : 60000;
    refs.current.refreshTimer = setInterval(fetchReservations, refreshInterval);

    return () => {
      if (refs.current.refreshTimer) {
        clearInterval(refs.current.refreshTimer);
        refs.current.refreshTimer = null;
      }
    };
  }, [fetchReservations, activeCall]);

  // Utility functions
  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Call management functions
  const handleStartCall = async (reservation: CallReservation) => {
    if (!reservation.phoneNumber) {
      alert("No phone number provided for this reservation");
      return;
    }

    if (!isInitialized) {
      try {
        await initialize(username);
      } catch {
        alert("Could not initialize call device. Please try again.");
        return;
      }
    }

    try {
      await updateReservation(reservation.id, { status: "ongoing" });
      setActiveCall(reservation.id);
      refs.current.activeCall = reservation.id;
      setCallDuration(0);
      refs.current.duration = 0;
      refs.current.callStartTime = Date.now();

      try {
        await makeCall(reservation.phoneNumber, "phone");
      } catch (callErr) {
        await updateReservation(reservation.id, { status: "scheduled" });
        setActiveCall(null);
        refs.current.activeCall = null;
        alert("Failed to establish call. Please try again.");
        throw callErr;
      }

      fetchReservations();
    } catch {
      setActiveCall(null);
      refs.current.activeCall = null;
      refs.current.callStartTime = null;
    }
  };

  const handleEndCall = async () => {
    if (activeCall === null) return;

    try {
      endCall();
      await cleanupCall(true);
      fetchReservations();
    } catch {
      if (activeCall) {
        try {
          await updateReservation(activeCall, { status: "completed" });
          fetchReservations();
        } catch {
          /* Silently ignore errors when updating reservation on cleanup */
        }
      }
      setActiveCall(null);
      refs.current.activeCall = null;
    }
  };

  // Check if a reservation can be called
  const isCallTimeValid = (reservation: CallReservation) => {
    if (activeCall !== null) return false;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (reservation.reservationDate !== today) return false;

    const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const validStatus =
      reservation.status === "scheduled" ||
      (reservation.status === "ongoing" && recoveredFromRefresh);

    return (
      validStatus &&
      currentTimeStr >= reservation.startTime &&
      currentTimeStr <= reservation.endTime
    );
  };

  if (loading && reservations.length === 0) {
    return <div className="text-center py-8">Loading reservations...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded">
        {error}
        <button
          className="ml-4 text-blue-600 underline"
          onClick={() => {
            setError(null);
            fetchReservations();
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-700">
              Your Call Reservations
            </h3>
            {reservations.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {reservations.length} reservation
                {reservations.length !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
          {loading && (
            <span className="text-sm text-gray-500">Refreshing...</span>
          )}
        </div>
      </div>

      {!reservations || reservations.length === 0 ? (
        <div className="bg-gray-50 p-6 text-center rounded-lg border border-gray-200">
          <p className="text-gray-600">No reservations found</p>
          <button
            className="mt-2 text-blue-600 underline"
            onClick={onRefreshNeeded}
          >
            Create your first reservation
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-200">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium text-gray-800">
                      Call on {formatDate(reservation.reservationDate)}
                    </h4>
                    <div className="text-sm text-gray-500">
                      <p>
                        Time: {reservation.startTime} - {reservation.endTime}
                      </p>
                      {reservation.phoneNumber && (
                        <p>Phone: {reservation.phoneNumber}</p>
                      )}
                      {reservation.callDuration !== null &&
                        reservation.callDuration > 0 &&
                        reservation.status === "completed" && (
                          <p>
                            Call Duration:{" "}
                            {formatDuration(reservation.callDuration)}
                          </p>
                        )}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${
                          reservation.status === "scheduled"
                            ? "bg-blue-100 text-blue-800"
                            : reservation.status === "ongoing"
                            ? "bg-green-100 text-green-800"
                            : reservation.status === "completed"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {reservation.status.charAt(0).toUpperCase() +
                          reservation.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start">
                    {isCallTimeValid(reservation) && (
                      <button
                        onClick={() => handleStartCall(reservation)}
                        disabled={
                          activeCall !== null ||
                          !reservation.phoneNumber ||
                          !isInitialized
                        }
                        className={`px-3 py-1 rounded text-white ${
                          activeCall !== null ||
                          !reservation.phoneNumber ||
                          !isInitialized
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600"
                        }`}
                      >
                        Start Call
                      </button>
                    )}
                  </div>
                </div>

                {activeCall === reservation.id && callStatus && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p>Call Status: {callStatus}</p>
                          {callStatus === "open" && (
                            <p>Duration: {formatDuration(callDuration)}</p>
                          )}
                          {callInfo && <p>Call Info: {callInfo}</p>}
                        </div>

                        {callStatus === "open" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={toggleMute}
                              className={`flex items-center px-3 py-1 rounded ${
                                isMuted
                                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                  : "bg-blue-500 hover:bg-blue-600 text-white"
                              }`}
                            >
                              {isMuted ? "Unmute" : "Mute"}
                            </button>
                            <button
                              onClick={handleEndCall}
                              className="flex items-center px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white"
                            >
                              End Call
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
            <button
              onClick={fetchReservations}
              disabled={loading}
              className={`text-blue-600 hover:text-blue-800 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Refreshing..." : "Refresh List"}
            </button>

            {activeCall && (
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Call in progress</span> -
                Auto-refresh reduced
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(ReservationList);
