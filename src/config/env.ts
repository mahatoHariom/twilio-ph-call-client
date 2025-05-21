const parseBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
};

export const config = {
  api: {
    useNgrok: parseBooleanEnv(import.meta.env.VITE_USE_NGROK, false),
    ngrokUrl: import.meta.env.VITE_NGROK_URL || "",
    localUrl: import.meta.env.VITE_LOCAL_URL || "http://localhost:9000",
    /**
     * Base URL for all API calls
     */
    get baseUrl(): string {
      console.log(
        `Using ${this.useNgrok ? "NGROK" : "local"} URL for API calls`
      );
      return this.useNgrok ? this.ngrokUrl : this.localUrl;
    },
    /**
     * Full URL for Twilio API endpoints
     */
    get twilioUrl(): string {
      return `${this.baseUrl}/api/twilio`;
    },
    /**
     * Full URL for Reservation API endpoints
     */
    get reservationsUrl(): string {
      return `${this.baseUrl}/api/reservations`;
    },
  },
  features: {
    debug: parseBooleanEnv(import.meta.env.VITE_ENABLE_DEBUG, true),
  },
};

// Log configuration in development mode
if (import.meta.env.DEV) {
  console.log("App Configuration:", config);
}
