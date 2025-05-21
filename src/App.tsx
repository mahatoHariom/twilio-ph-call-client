import ReservationPage from "./components/ReservationPage";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 pt-8 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          VoIP Phone System
        </h1>

        <ReservationPage />
      </div>
    </div>
  );
}

export default App;
