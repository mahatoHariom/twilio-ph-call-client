import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { config } from "../config/env";

// Log configuration for debugging
console.log("API Client Configuration:", {
  baseUrl: config.api.baseUrl,
  useNgrok: config.api.useNgrok,
  ngrokUrl: config.api.ngrokUrl,
  localUrl: config.api.localUrl,
  twilioUrl: config.api.twilioUrl,
  reservationsUrl: config.api.reservationsUrl,
});

// Helper function to normalize URL paths
const normalizePath = (path: string): string => {
  // Remove leading slash if it exists
  return path.startsWith("/") ? path.slice(1) : path;
};

// Helper to check if a response is an ngrok auth page
const isNgrokAuthPage = (data: unknown): boolean => {
  if (
    typeof data === "string" &&
    data.includes("ngrok-free.app") &&
    data.includes("<!DOCTYPE html>")
  ) {
    console.error("Received ngrok authentication page instead of API response");
    return true;
  }
  return false;
};

// Create a base axios instance with common configuration
const createApiClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "69420",

    },
  });

  // Request interceptor for adding auth token or other headers
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Normalize the URL path to prevent double slashes
      if (config.url) {
        config.url = normalizePath(config.url);
      }

      // Enhanced logging with full URL
      const fullUrl = `${config.baseURL}/${config.url || ""}`.replace(
        /([^:]\/)\/+/g,
        "$1"
      );
      console.log(
        `API Request: ${config.method?.toUpperCase()} ${fullUrl}`,
        config.data
      );
      return config;
    },
    (error: AxiosError) => {
      console.error("API Request Error:", error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor for handling common errors
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Extract the full URL for better logging
      const fullUrl = `${response.config.baseURL}/${
        response.config.url || ""
      }`.replace(/([^:]\/)\/+/g, "$1");

      // Check if the response is an ngrok auth page
      if (isNgrokAuthPage(response.data)) {
        console.error(`Ngrok authentication required for ${fullUrl}`);
        // Create a custom error to be handled by the application
        const error = new Error(
          "Ngrok authentication required. Please open your browser to the ngrok URL and accept the terms."
        );
        return Promise.reject(error);
      }

      console.log(
        `API Response: ${response.status} for ${fullUrl}`,
        response.data
      );
      return response;
    },
    (error: AxiosError) => {
      if (error.response) {
        const status = error.response.status;
        const fullUrl =
          error.config?.baseURL && error.config?.url
            ? `${error.config.baseURL}/${error.config.url}`.replace(
                /([^:]\/)\/+/g,
                "$1"
              )
            : "unknown endpoint";

        // Check if the error response is an ngrok auth page
        if (error.response.data && isNgrokAuthPage(error.response.data)) {
          console.error(`Ngrok authentication required for ${fullUrl}`);
          error.message =
            "Ngrok authentication required. Please open your browser to the ngrok URL and accept the terms.";
          return Promise.reject(error);
        }

        if (status === 401) {
          console.error(
            `Authentication error for ${fullUrl}:`,
            error.response.data
          );
        } else if (status === 403) {
          console.error(
            `Permission denied for ${fullUrl}:`,
            error.response.data
          );
        } else if (status === 404) {
          console.error(
            `Resource not found for ${fullUrl}:`,
            error.response.data
          );
        } else if (status >= 500) {
          console.error(`Server error for ${fullUrl}:`, error.response.data);
        }
      } else if (error.request) {
        console.error("Network error - No response received:", error.message);
        console.error("Request details:", {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          fullUrl:
            error.config?.baseURL && error.config?.url
              ? `${error.config.baseURL}/${error.config.url}`.replace(
                  /([^:]\/)\/+/g,
                  "$1"
                )
              : "unknown",
        });
      } else {
        console.error("Request configuration error:", error.message);
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create API clients for different endpoints
const apiClient = createApiClient(config.api.baseUrl);
export const twilioApiClient = createApiClient(config.api.twilioUrl);

// Use local URL for reservations API to avoid ngrok authentication issues
// while still using ngrok for Twilio which needs public URLs for webhooks
export const reservationsApiClient = createApiClient(
  `${config.api.baseUrl}/api/reservations`
);

export default apiClient;
