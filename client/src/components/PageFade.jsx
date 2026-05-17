import { useLocation } from "react-router-dom";

export default function PageFade({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}
