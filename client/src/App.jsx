import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EventDashboard from "./pages/EventDashboard.jsx";
import RSVPPage from "./pages/RSVPPage.jsx";
import UploadGuests from "./pages/UploadGuests.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="main-header">
        <h1>הושבה כיד המלך</h1>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/events/:eventId" element={<EventDashboard />} />
          <Route path="/manage/:eventId" element={<UploadGuests />} />
          <Route path="/rsvp/:token" element={<RSVPPage />} />
        </Routes>
      </main>
    </div>
  );
}
