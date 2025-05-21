import { useState, useEffect, useCallback } from "react";
import ReservationForm from "./ReservationForm";
import ReservationList from "./ReservationList";

const ReservationPage = () => {
  // State management
  const [username, setUsername] = useState<string>("");
  const [customUsername, setCustomUsername] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [defaultUsername, setDefaultUsername] = useState<string>("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Initialize username from localStorage or generate random one
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      setDefaultUsername(storedUsername);
    } else {
      const randomUsername = `user_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem("username", randomUsername);
      setUsername(randomUsername);
      setDefaultUsername(randomUsername);
    }
  }, []);

  // Event handlers
  const toggleForm = () => setShowForm(!showForm);

  const handleReservationSuccess = useCallback(() => {
    console.log("Reservation created successfully! Refreshing list...");
    setShowForm(false);
    setRefreshCounter((prev) => prev + 1);
  }, []);

  const handleRefreshNeeded = useCallback(() => {
    setShowForm(true);
  }, []);

  const forceRefresh = useCallback(() => {
    console.log("Manually refreshing reservation list");
    setRefreshCounter((prev) => prev + 1);
  }, []);

  // Username management
  const handleUsernameChange = useCallback(
    (newUsername: string) => {
      if (newUsername !== username) {
        console.log(`Changing username from ${username} to ${newUsername}`);
        setUsername(newUsername);
        localStorage.setItem("username", newUsername);
        setRefreshCounter((prev) => prev + 1);
      }
    },
    [username]
  );

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUsername = customUsername.trim();
    if (!newUsername || newUsername === username) return;
    handleUsernameChange(newUsername);
    setCustomUsername("");
  };

  const handleResetToDefault = useCallback(() => {
    if (username !== defaultUsername) {
      handleUsernameChange(defaultUsername);
    }
  }, [username, defaultUsername, handleUsernameChange]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header section */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Call Reservations</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleForm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            {showForm ? "Hide Form" : "New Reservation"}
          </button>
          <button
            onClick={forceRefresh}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
          >
            Refresh List
          </button>
        </div>
      </div>

      {/* User selection section */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">
              Current User:{" "}
            </span>
            <span className="font-semibold text-blue-600">{username}</span>
            {username !== defaultUsername && (
              <span className="ml-2 text-xs text-gray-500">
                (Default: {defaultUsername})
              </span>
            )}
          </div>
          {username !== defaultUsername && (
            <button
              onClick={handleResetToDefault}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Reset to Default User
            </button>
          )}
        </div>
        <form onSubmit={handleUsernameSubmit} className="flex items-center">
          <input
            type="text"
            value={customUsername}
            onChange={(e) => setCustomUsername(e.target.value)}
            placeholder="Enter a different username"
            className="flex-1 p-2 border border-gray-300 rounded mr-2"
          />
          <button
            type="submit"
            disabled={
              !customUsername.trim() || customUsername.trim() === username
            }
            className={`px-4 py-2 rounded ${
              !customUsername.trim() || customUsername.trim() === username
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            Switch User
          </button>
        </form>
      </div>

      {/* Reservation form (conditionally shown) */}
      {showForm && (
        <div className="mb-8">
          <ReservationForm
            username={username}
            onSuccess={handleReservationSuccess}
          />
        </div>
      )}

      {/* Reservation list */}
      <ReservationList
        username={username}
        onRefreshNeeded={handleRefreshNeeded}
        refreshTrigger={refreshCounter}
      />
    </div>
  );
};

export default ReservationPage;
