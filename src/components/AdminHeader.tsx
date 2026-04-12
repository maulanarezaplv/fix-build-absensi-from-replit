import { memo, useState, useEffect } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar, Clock, Moon, Sun, PanelLeft } from "lucide-react";

interface AdminHeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

// Clock isolated in its own component so it re-renders every second without
// affecting the rest of AdminHeader or its siblings.
const LiveClock = memo(() => {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate text-xs sm:hidden">
          {format(time, "EEE, dd MMM yyyy", { locale: idLocale })}
        </span>
        <span className="truncate text-xs md:text-sm hidden sm:inline">
          {format(time, "EEEE, dd MMMM yyyy", { locale: idLocale })}
        </span>
      </div>

      <span className="text-border hidden xs:block">|</span>

      <div className="flex items-center gap-1.5 font-mono text-xs md:text-sm">
        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{format(time, "HH:mm:ss")}</span>
      </div>
    </>
  );
});
LiveClock.displayName = "LiveClock";

const AdminHeader = memo(({ onToggleSidebar }: AdminHeaderProps) => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="h-12 flex items-center justify-between px-3 md:px-4 border-b border-border bg-card text-sm text-muted-foreground flex-shrink-0">
      {/* Tombol toggle sidebar — hanya tampil di desktop */}
      <button
        onClick={onToggleSidebar}
        className="hidden md:flex p-1.5 rounded-lg hover:bg-muted transition-colors"
        title="Menu"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      {/* Placeholder agar layout header tidak geser di HP */}
      <span className="md:hidden w-8" />

      <div className="flex items-center gap-2 md:gap-4 min-w-0 overflow-hidden">
        <LiveClock />

        <button
          onClick={toggleDark}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title={dark ? "Mode Siang" : "Mode Malam"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
});
AdminHeader.displayName = "AdminHeader";

export default AdminHeader;
