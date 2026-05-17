import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AdminShell from "./components/AdminShell.jsx";
import BackButton from "./components/BackButton.jsx";
import PageFade from "./components/PageFade.jsx";

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
const About = lazy(() => import("./pages/About.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Pricing = lazy(() => import("./pages/Pricing.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <PageFade key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
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
    </PageFade>
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
      <BackButton />
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
        <AnimatedRoutes />
      </Suspense>
    </div>
  );
}
