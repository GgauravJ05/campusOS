import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/login";
import AdminDashboard from "./pages/AdminDashboard";
import VenueAvailability from "./pages/VenueAvailability";
import Events from "./pages/Events";
import ProtectedRoute from "./pages/ProtectedRoute";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/venues"
          element={
            <ProtectedRoute>
              <VenueAvailability />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <Events />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;