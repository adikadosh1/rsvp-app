import { Suspense, lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import AdminShell from "./components/AdminShell.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.jsx"));
const EventDashboard = lazy(() => import("./pages/EventDashboard.jsx"));
const UploadGuests = lazy(() => import("./pages/UploadGuests.jsx"));
const RSVPPage = lazy(() => import("./pages/RSVPPage.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const StartOwner = lazy(() => import("./pages/StartOwner.jsx"));
const OwnerPortal = lazy(() => import("./pages/OwnerPortal.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));

function CrownMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M10 46h44v6H10v-6Zm4-24 10 12 8-14 8 14 10-12 6 18H8l6-18Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M16 16a4 4 0 1 0 0.001 0ZM32 10a4 4 0 1 0 0.001 0ZM48 16a4 4 0 1 0 0.001 0Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export default function App() {
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--scrollY", `${window.scrollY || 0}px`);
        raf = null;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="app-shell">
      <Suspense
        fallback={
          <div className="container">
            <section className="card">
              <div className="skeleton" style={{ height: 22, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 180 }} />
            </section>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/start" element={<StartOwner />} />
          <Route path="/owner/:ownerToken" element={<OwnerPortal />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route element={<AdminShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events/:eventId" element={<EventDashboard />} />
            <Route path="/manage/:eventId" element={<UploadGuests />} />
          </Route>

          <Route path="/rsvp/:token" element={<RSVPPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}
