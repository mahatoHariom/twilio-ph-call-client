import { useState, useEffect } from "react";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

// Common button styles for consistency
const buttonClass =
  "px-4 py-2 bg-white border border-gray-300 text-black rounded hover:bg-gray-50";
const disabledButtonClass =
  "px-4 py-2 bg-gray-100 border border-gray-300 text-gray-400 rounded cursor-not-allowed";
const actionButtonClass = "px-4 py-2 rounded text-white font-medium";

const VoipCall = () => {
  const [destination, setDestination] = useState<string>("");
  const [callAttempts, setCallAttempts] = useState<number>(0);
  const [lastCalledDestination, setLastCalledDestination] =
    useState<string>("");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callTimer, setCallTimer] = useState<number | null>(null);

  // Phone number validation regex (basic international format)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  const {
    callStatus,
    error,
    isMuted,
    isInitialized,
    callInfo,
    remoteIdentity,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useTwilioVoice();

  // Format call duration as MM:SS
  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Auto-initialize with a random username when the component mounts
  useEffect(() => {
    const autoInitialize = async () => {
      if (!isInitialized && callStatus !== "initializing") {
        // Generate a random username
        const randomUsername = `user_${Math.floor(Math.random() * 10000)}`;
        console.log(
          `Auto-initializing with random username: ${randomUsername}`
        );

        try {
          await initialize(randomUsername);
          console.log("Auto-initialization completed");
        } catch (error) {
          console.error("Auto-initialization error:", error);
        }
      }
    };

    autoInitialize();
  }, [isInitialized, callStatus, initialize]);

  // Handle call timer for active calls
  useEffect(() => {
    // Start timer when call is open
    if (callStatus === "open") {
      if (callTimer === null) {
        const timer = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
        setCallTimer(timer);
      }
    } else {
      // Clear timer when call ends
      if (callTimer !== null) {
        window.clearInterval(callTimer);
        setCallTimer(null);

        // Reset duration when call is fully closed
        if (callStatus === "closed" || callStatus === "ready") {
          setCallDuration(0);
        }
      }
    }

    return () => {
      if (callTimer !== null) {
        window.clearInterval(callTimer);
      }
    };
  }, [callStatus, callTimer]);

  // Enhanced useEffect for more detailed logging of call state changes
  useEffect(() => {
    console.log(`VoipCall - Call status changed to: ${callStatus}`);
    console.log(`VoipCall - Call info: ${callInfo}`);
    console.log(`VoipCall - Remote identity: ${remoteIdentity}`);

    // Special handling for certain call states
    if (callStatus === "ringing") {
      console.log("Call is now ringing, waiting for remote party to answer...");
    } else if (callStatus === "open") {
      console.log("Call is now open and connected");
    }
  }, [callStatus, callInfo, remoteIdentity]);

  // Reset call attempts when destination changes
  useEffect(() => {
    if (destination !== lastCalledDestination) {
      setCallAttempts(0);
    }
  }, [destination, lastCalledDestination]);

  const handleMakeCall = async () => {
    if (!destination) return;

    // Prevent rapid multiple call attempts
    if (callStatus === "connecting" || callStatus === "ringing") {
      console.log("Call already in progress, please wait...");
      return;
    }

    console.log(`Attempting to call destination: ${destination}`);
    try {
      setCallAttempts((prev) => prev + 1);
      setLastCalledDestination(destination);
      console.log("About to call makeCall method from useTwilioVoice");

      await makeCall(destination, "phone");
      console.log("makeCall method completed");
    } catch (error) {
      console.error("Call error in VoipCall component:", error);
      // Display more detailed error information to the user
      alert(
        `Failed to make call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const renderDestinationInput = () => (
    <div className="mb-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          className="px-3 py-2 border border-gray-300 rounded w-full"
          placeholder="Enter phone number (e.g., +1234567890)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={!isInitialized}
        />

        <button
          className={
            !isInitialized ||
            !destination.trim() ||
            callStatus === "connecting" ||
            callStatus === "ringing" ||
            !phoneRegex.test(destination)
              ? disabledButtonClass
              : `${actionButtonClass} bg-green-500 hover:bg-green-600 flex items-center justify-center`
          }
          onClick={handleMakeCall}
          disabled={
            !isInitialized ||
            !destination.trim() ||
            callStatus === "connecting" ||
            callStatus === "ringing" ||
            !phoneRegex.test(destination)
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          {callStatus === "connecting" || callStatus === "ringing"
            ? "Connecting..."
            : "Call"}
        </button>

        {destination && !phoneRegex.test(destination) && (
          <div className="text-red-500 text-sm">
            Invalid phone number format
          </div>
        )}
      </div>
    </div>
  );

  const renderCallControls = () => {
    switch (callStatus) {
      case "pending":
        return (
          <div className="flex flex-col items-center mt-4 p-4 border border-gray-200 rounded-lg">
            <div className="text-center mb-4">
              <div className="text-blue-600 font-medium">
                {remoteIdentity || "Unknown caller"}
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-green-500 hover:bg-green-600 flex items-center`}
                onClick={answerCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Answer
              </button>
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600 flex items-center`}
                onClick={rejectCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Reject
              </button>
            </div>
          </div>
        );

      case "open":
      case "connecting":
      case "reconnecting":
        return (
          <div className="flex flex-col items-center mt-4 p-4 border border-gray-200 rounded-lg">
            <div className="text-center mb-4">
              {callStatus === "connecting" ? (
                <div className="font-medium">
                  <div className="animate-pulse flex justify-center mb-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full mx-1"></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full mx-1 animate-delay-100"></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full mx-1 animate-delay-200"></div>
                  </div>
                  Connecting...
                </div>
              ) : callStatus === "reconnecting" ? (
                <div className="font-medium text-yellow-600">
                  Reconnecting...
                </div>
              ) : (
                <>
                  <div className="font-medium text-lg">
                    <span className="text-blue-600">
                      {remoteIdentity || "..."}
                    </span>
                  </div>
                  <div className="text-sm font-medium mt-1">
                    {formatCallDuration(callDuration)}
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600 flex items-center`}
                onClick={endCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                End
              </button>
              <button
                className={`${buttonClass} ${
                  isMuted ? "bg-yellow-50 border-yellow-300" : ""
                } flex items-center`}
                onClick={toggleMute}
              >
                {isMuted ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Unmute
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Mute
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-md bg-white overflow-hidden max-w-md w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {callStatus === "initializing" && (
        <div className="text-center p-4">
          <div className="animate-pulse flex justify-center mb-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full mx-1"></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full mx-1 animate-delay-100"></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full mx-1 animate-delay-200"></div>
          </div>
          <div className="text-sm text-gray-500">Initializing...</div>
        </div>
      )}

      {isInitialized &&
        !["open", "pending", "connecting"].includes(callStatus) &&
        renderDestinationInput()}

      {/* Call controls for different states */}
      {(callStatus === "pending" ||
        callStatus === "open" ||
        callStatus === "connecting" ||
        callStatus === "reconnecting") &&
        renderCallControls()}

      {/* Call duration display */}
      {callStatus === "open" && (
        <div className="mt-4 text-center">
          <div className="text-xl font-mono font-medium">
            {formatCallDuration(callDuration)}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoipCall;
