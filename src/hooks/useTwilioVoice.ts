import { useState, useCallback, useRef, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import apiClient from "../utils/apiClient";
import type { CallStatus } from "../types";

interface TokenResponse {
  token: string;
  identity: string;
}

interface TwilioCall extends Call {
  on(
    event:
      | "accept"
      | "disconnect"
      | "cancel"
      | "reject"
      | "error"
      | "warning"
      | "reconnecting"
      | "reconnected"
      | "ringing",
    listener: (arg?: unknown) => void
  ): this;
  parameters: Record<string, string>;
}

interface TwilioDevice extends Device {
  on(
    event: "registered" | "unregistered" | "tokenWillExpire" | "tokenExpired",
    listener: () => void
  ): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "incoming", listener: (call: Call) => void): this;
}

const TOKEN_REFRESH_INTERVAL = 59 * 60 * 1000;

export const useTwilioVoice = () => {
  const [state, setState] = useState<{
    identity: string;
    callStatus: CallStatus;
    error: string;
    isMuted: boolean;
    isInitialized: boolean;
    callInfo: string;
    remoteIdentity: string;
  }>({
    identity: "",
    callStatus: "closed",
    error: "",
    isMuted: false,
    isInitialized: false,
    callInfo: "",
    remoteIdentity: "",
  });

  const deviceRef = useRef<TwilioDevice | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);
  const tokenRef = useRef<string>("");
  const tokenRefreshTimerRef = useRef<number | null>(null);
  const cleanupCallResourcesRef = useRef<() => void>(() => {});

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const cleanupCallResources = useCallback(() => {
    console.log("Cleaning up call resources");

    if (activeCallRef.current) {
      try {
        if (activeCallRef.current.status() !== "closed") {
          console.log("Disconnecting active call");
          activeCallRef.current.disconnect();
        } else {
          console.log("Call already closed, no need to disconnect");
        }

        if (deviceRef.current) {
          try {
            console.log("Releasing audio resources");
            deviceRef.current.audio?.outgoing(false);
            deviceRef.current.audio?.incoming(false);
            console.log("Audio resources released");
          } catch (err) {
            console.warn("Error releasing device audio:", err);
          }
        }
      } catch (err) {
        console.log("Error during call cleanup:", err);
      }

      console.log("Clearing active call reference");
      activeCallRef.current = null;
    } else {
      console.log("No active call to clean up");
    }

    updateState({ isMuted: false, remoteIdentity: "" });
  }, [updateState]);

  cleanupCallResourcesRef.current = cleanupCallResources;

  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }

      cleanupCallResourcesRef.current();

      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
          deviceRef.current = null;
        } catch (err) {
          console.warn("Error destroying device:", err);
        }
      }
    };
  }, []);

  const handleError = useCallback(
    (error: unknown, prefix: string) => {
      const errorMessage = `${prefix}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(errorMessage);
      updateState({ error: errorMessage, callStatus: "error" });
      return errorMessage;
    },
    [updateState]
  );

  const updateCallStatus = useCallback(
    (status: CallStatus, info: string = "") => {
      updateState({
        callStatus: status,
        callInfo: info,
        ...(status === "ready" ? { error: "" } : {}),
      });
    },
    [updateState]
  );

  const checkActiveCall = useCallback(() => {
    if (!activeCallRef.current) throw new Error("No active call");
    return activeCallRef.current;
  }, []);

  const getToken = useCallback(
    async (userIdentity: string): Promise<TokenResponse> => {
      try {
        const { data } = await apiClient.post("/token", {
          identity: userIdentity,
        });
        return data;
      } catch (error) {
        throw new Error(
          `Failed to fetch token: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    []
  );

  const setupTokenRefresh = useCallback(
    (identity: string) => {
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
      }

      tokenRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          console.log("Refreshing Twilio token...");
          const { token } = await getToken(identity);
          tokenRef.current = token;

          if (deviceRef.current) {
            await deviceRef.current.updateToken(token);
            console.log("Token refreshed successfully");
          }

          setupTokenRefresh(identity);
        } catch (error) {
          console.error("Failed to refresh token:", error);

          tokenRefreshTimerRef.current = window.setTimeout(() => {
            setupTokenRefresh(identity);
          }, 60000);
        }
      }, TOKEN_REFRESH_INTERVAL);
    },
    [getToken]
  );

  const extractClientIdentity = useCallback(
    (parameters: Record<string, string>) => {
      const from = parameters.From || "";
      if (from.startsWith("client:")) {
        return from.substring(7);
      }
      return from || "unknown";
    },
    []
  );

  const setupCallListeners = useCallback(
    (call: TwilioCall) => {
      console.log("Setting up call listeners for call:", call);

      call.on("ringing", () => {
        console.log("Remote device is ringing");
        updateCallStatus("ringing", "Ringing...");
      });

      call.on("accept", () => {
        console.log("Call accepted");
        updateCallStatus("open", "Connected");
      });

      call.on("error", (error) => {
        console.error("Call error:", error);
        handleError(error, "Call error");
        cleanupCallResources();

        setTimeout(() => updateCallStatus("ready", ""), 500);
      });

      call.on("warning", (warning) => {
        console.warn("Call warning:", warning);
        updateState({ callInfo: `Warning: ${warning}` });
      });

      call.on("reconnecting", (error) => {
        console.warn("Call reconnecting due to:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        updateCallStatus("reconnecting", `Reconnecting: ${errorMsg}`);
      });

      call.on("reconnected", () => {
        console.log("Call reconnected successfully");
        updateCallStatus("open", "Call reconnected");
      });

      ["disconnect", "cancel", "reject"].forEach((event) => {
        call.on(event as "disconnect" | "cancel" | "reject", () => {
          console.log(`Call ${event} event received`);

          updateCallStatus(
            "closed",
            event === "disconnect" ? "Call ended" : "Call rejected"
          );

          cleanupCallResources();

          setTimeout(() => {
            updateCallStatus("ready", "");
          }, 300);
        });
      });
    },
    [updateCallStatus, updateState, handleError, cleanupCallResources]
  );

  const initialize = useCallback(
    async (userIdentity: string) => {
      console.log("Starting device initialization for identity:", userIdentity);
      updateState({
        identity: userIdentity,
        error: "",
        callStatus: "initializing",
      });

      try {
        if (deviceRef.current) {
          console.log("Destroying existing device");
          deviceRef.current.destroy();
          deviceRef.current = null;
        }

        cleanupCallResources();

        console.log("Requesting token from server...");
        const { token } = await getToken(userIdentity);

        if (!token) {
          throw new Error("Received empty token from server");
        }

        console.log("Token received successfully");
        tokenRef.current = token;

        console.log("Creating new Twilio device...");

        try {
          console.log("Requesting microphone permissions...");
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          console.log(
            "Microphone permission granted with enhanced echo cancellation:",
            stream.getAudioTracks()
          );

          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error("Error requesting microphone permission:", err);
          throw new Error(
            "Microphone access is required. Please allow access and try again."
          );
        }

        const device = new Device(token, {
          logLevel: "debug",
          maxAverageBitrate: 16000,

          allowIncomingWhileBusy: true,
        }) as TwilioDevice;

        console.log("Device created, setting up event listeners...");
        deviceRef.current = device;

        device.on("registered", () => {
          console.log("Device registered successfully");
          updateCallStatus("ready");
        });

        device.on("error", (error: Error) => {
          console.error("Device error:", error);
          updateCallStatus("error", `Error: ${error.message}`);
        });

        device.on("incoming", (incomingCall: Call) => {
          console.log("Incoming call received");

          cleanupCallResources();

          activeCallRef.current = incomingCall as TwilioCall;

          const callerIdentity = extractClientIdentity(
            (incomingCall as TwilioCall).parameters
          );
          console.log("Incoming call from:", callerIdentity);

          updateState({ remoteIdentity: callerIdentity });

          updateCallStatus("pending", `From: ${callerIdentity}`);
          setupCallListeners(activeCallRef.current);
        });

        setupTokenRefresh(userIdentity);

        console.log("Registering device with Twilio...");

        try {
          await device.register();
          console.log("Device registration completed successfully");
          updateState({ isInitialized: true });
        } catch (regError) {
          console.error("Device registration error:", regError);
          throw new Error(
            `Failed to register device: ${
              regError instanceof Error ? regError.message : "Unknown error"
            }`
          );
        }
      } catch (error) {
        const errorMsg = `Initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(errorMsg);

        console.error("Error details:", error);

        updateState({
          error: errorMsg,
          callStatus: "error",
          isInitialized: false,
        });

        if (deviceRef.current) {
          try {
            deviceRef.current.destroy();
          } catch (e) {
            console.warn("Error destroying device during recovery:", e);
          }
          deviceRef.current = null;
        }

        throw error;
      }
    },
    [
      getToken,
      setupCallListeners,
      updateCallStatus,
      updateState,
      cleanupCallResources,
      extractClientIdentity,
      setupTokenRefresh,
    ]
  );

  const makeCall = useCallback(
    async (to: string, callType: "direct" | "phone" = "direct") => {
      if (!deviceRef.current) throw new Error("Device not initialized");

      try {
        cleanupCallResources();

        console.log(`Making ${callType} call to: ${to}`);

        if (callType === "phone") {
          updateCallStatus("connecting", `Calling number ${to}...`);
        } else {
          updateCallStatus("connecting", `Calling ${to}...`);
        }

        updateState({ remoteIdentity: to });

        let formattedTo;
        if (callType === "phone") {
          formattedTo = to;
          console.log(`Formatted phone number destination: ${formattedTo}`);
        } else {
          formattedTo = to.startsWith("client:") ? to : `client:${to}`;
          console.log(`Formatted 1:1 call destination: ${formattedTo}`);
        }

        console.log("Initiating call with device...");
        const call = await deviceRef.current.connect({
          params: {
            To: formattedTo,
            From: state.identity,
          },
        });

        if (!call) {
          throw new Error("Failed to create call - null call object returned");
        }

        activeCallRef.current = call as TwilioCall;
        console.log("Call initiated, setting up listeners...");
        setupCallListeners(activeCallRef.current);
      } catch (error) {
        cleanupCallResources();
        updateCallStatus("ready");
        handleError(error, "Error making call");
        throw error;
      }
    },
    [
      state.identity,
      updateCallStatus,
      updateState,
      handleError,
      cleanupCallResources,
      setupCallListeners,
    ]
  );

  const answerCall = useCallback(() => {
    try {
      console.log("Answering call");

      checkActiveCall().accept();
    } catch (error) {
      handleError(error, "Failed to answer call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const rejectCall = useCallback(() => {
    try {
      console.log("Rejecting call");
      checkActiveCall().reject();
    } catch (error) {
      handleError(error, "Failed to reject call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const endCall = useCallback(() => {
    try {
      console.log("Ending call");
      checkActiveCall().disconnect();
    } catch (error) {
      handleError(error, "Failed to end call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const toggleMute = useCallback(() => {
    try {
      const call = checkActiveCall();
      const newMuteState = !state.isMuted;
      call.mute(newMuteState);
      console.log(`Call ${newMuteState ? "muted" : "unmuted"}`);
      updateState({ isMuted: newMuteState });
    } catch (error) {
      handleError(error, "Failed to toggle mute");
    }
  }, [checkActiveCall, handleError, state.isMuted, updateState]);

  return {
    identity: state.identity,
    isInitialized: state.isInitialized,
    callStatus: state.callStatus,
    isMuted: state.isMuted,
    error: state.error,
    callInfo: state.callInfo,
    remoteIdentity: state.remoteIdentity,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  };
};
