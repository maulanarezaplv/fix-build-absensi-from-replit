import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const TopLoadingBar = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setWidth(0);
    setVisible(true);

    // Gerak cepat ke 80% lalu berhenti menunggu halaman selesai
    rafRef.current = requestAnimationFrame(() => {
      setWidth(30);
      timerRef.current = setTimeout(() => setWidth(80), 50);
    });

    // Selesaikan ke 100% lalu hilang
    timerRef.current = setTimeout(() => {
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 300);
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none"
      style={{ background: "transparent" }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "linear-gradient(90deg, hsl(260,70%,60%), hsl(199,89%,55%), hsl(260,70%,60%))",
          backgroundSize: "200% 100%",
          animation: "loadingBarShimmer 1.2s linear infinite",
          transition: width === 100 ? "width 0.2s ease-out" : "width 0.4s ease-out",
          borderRadius: "0 2px 2px 0",
          boxShadow: "0 0 8px hsl(199,89%,60%), 0 0 3px hsl(260,70%,70%)",
        }}
      />
    </div>
  );
};

export default TopLoadingBar;
