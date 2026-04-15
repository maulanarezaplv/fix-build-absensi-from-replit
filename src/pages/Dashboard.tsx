import { useQuery } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle2, Clock, Stethoscope, XCircle, Zap, FileText, CalendarDays, ChevronRight, BarChart3, ClipboardCheck, QrCode } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
};

const Dashboard = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();

  const todayDayNameFull = format(new Date(), "EEEE", { locale: idLocale });
  const dayNameMap: Record<string, string> = {
    senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis",
    jumat: "Jumat", sabtu: "Sabtu", minggu: "Minggu",
  };
  const todayPiketDay = Object.entries(dayNameMap).find(([k]) => todayDayNameFull.toLowerCase().includes(k))?.[1] || "";

  const { data: myPiketAssignments = [] } = useQuery({
    queryKey: ["my-piket-dashboard", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("guru_piket_assignments")
        .select("*")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user?.id && !isAdmin,
    staleTime: 5 * 60_000,
  });

  const isGuruOnPiketToday = isAdmin || (myPiketAssignments as any[]).some((a: any) => a.day_of_week === todayPiketDay);

  useRealtimeSubscription("students", [["student-count"]]);
  useRealtimeSubscription("attendance_records", [["today-stats", today], ["yearly-chart"]]);

  const { data: studentCount = 0 } = useQuery({
    queryKey: ["student-count"],
    queryFn: async () => {
      const { count } = await supabase.from("students").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: todayStats = { hadir: 0, izin: 0, sakit: 0, alpa: 0 } } = useQuery({
    queryKey: ["today-stats", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("status")
        .eq("date", today);
      const records = data ?? [];
      return {
        hadir: records.filter(r => r.status === "hadir").length,
        izin: records.filter(r => r.status === "izin").length,
        sakit: records.filter(r => r.status === "sakit").length,
        alpa: records.filter(r => r.status === "alpa").length,
      };
    },
  });

  const { data: yearlyData = [] } = useQuery({
    queryKey: ["yearly-chart", currentYear],
    queryFn: async () => {
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      const { data } = await supabase
        .from("attendance_records")
        .select("status, date")
        .gte("date", startDate)
        .lte("date", endDate);
      const records = data ?? [];
      const byMonth: Record<number, { Hadir: number; Izin: number; Sakit: number; Alpa: number }> = {};
      for (let m = 0; m < 12; m++) {
        byMonth[m] = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
      }
      records.forEach(r => {
        const month = new Date(r.date).getMonth();
        if (r.status === "hadir") byMonth[month].Hadir++;
        else if (r.status === "izin") byMonth[month].Izin++;
        else if (r.status === "sakit") byMonth[month].Sakit++;
        else if (r.status === "alpa") byMonth[month].Alpa++;
      });
      return MONTHS_SHORT.map((name, i) => ({ name, ...byMonth[i] }));
    },
  });

  const statusCards = [
    { label: "HADIR", value: todayStats.hadir, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", hoverBg: "group-hover:bg-emerald-500/20", ring: "group-hover:ring-emerald-500/30" },
    { label: "IZIN",  value: todayStats.izin,  icon: Clock,        color: "text-blue-500",    bg: "bg-blue-500/10",    hoverBg: "group-hover:bg-blue-500/20",    ring: "group-hover:ring-blue-500/30" },
    { label: "SAKIT", value: todayStats.sakit, icon: Stethoscope,  color: "text-amber-500",   bg: "bg-amber-500/10",   hoverBg: "group-hover:bg-amber-500/20",   ring: "group-hover:ring-amber-500/30" },
    { label: "ALPA",  value: todayStats.alpa,  icon: XCircle,      color: "text-red-500",     bg: "bg-red-500/10",     hoverBg: "group-hover:bg-red-500/20",     ring: "group-hover:ring-red-500/30" },
  ];

  const quickLinks = [
    { label: "Validasi Absen",  desc: "Setujui izin & sakit siswa", icon: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600", to: "/admin/validation" },
    { label: "Laporan Harian",  desc: "Rekap absensi hari ini",     icon: FileText,       color: "bg-warning/10 text-warning",         to: "/admin/reports" },
    { label: "Rekap Bulanan",   desc: "Rekapitulasi per bulan",     icon: CalendarDays,   color: "bg-blue-500/10 text-blue-600",        to: "/admin/rekap" },
    { label: "Kelola Absen",    desc: "Atur jam & hari absensi",    icon: Clock,          color: "bg-info/10 text-info",                to: "/admin/settings" },
    { label: "Scan Absensi",    desc: "Scan QR & input kehadiran",  icon: QrCode,         color: "bg-primary/10 text-primary",          to: "/admin/history" },
  ];

  const guruQuickLinksBase = [
    { label: "Validasi Absen",  desc: "Setujui izin & sakit siswa", icon: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600", to: "/admin/validation" },
    { label: "Laporan Harian",  desc: "Rekap absensi hari ini",     icon: FileText,       color: "bg-warning/10 text-warning",         to: "/admin/reports" },
    { label: "Rekap Bulanan",   desc: "Rekapitulasi per bulan",     icon: CalendarDays,   color: "bg-blue-500/10 text-blue-600",        to: "/admin/rekap" },
  ];
  const guruQuickLinks = isGuruOnPiketToday
    ? [...guruQuickLinksBase, { label: "Scan Absensi", desc: "Scan QR & input kehadiran", icon: QrCode, color: "bg-primary/10 text-primary", to: "/admin/history" }]
    : guruQuickLinksBase;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
          <p className="font-bold text-sm mb-2">{label}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs py-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const greeting = getGreeting();
  const userName = (user as any)?.name || (user as any)?.username || "Admin";
  const hasChartData = yearlyData.some((d: any) =>
    (d.Hadir || 0) + (d.Izin || 0) + (d.Sakit || 0) + (d.Alpa || 0) > 0
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground leading-tight">
          {greeting},{" "}
          <span className="bg-gradient-to-r from-[hsl(260,75%,55%)] to-[hsl(199,89%,48%)] bg-clip-text text-transparent">
            {userName}
          </span>{" "}
          👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Berikut ringkasan kehadiran siswa hari ini
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="col-span-2 sm:col-span-1 border-none bg-gradient-to-br from-[hsl(220,80%,60%)] to-[hsl(199,89%,48%)] text-white relative overflow-hidden group cursor-default transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Siswa</p>
                <p className="text-3xl font-extrabold mt-1">{studentCount}</p>
                <div className="absolute -right-3 -bottom-3 opacity-20 transition-all duration-500 group-hover:opacity-30 group-hover:scale-110 group-hover:-rotate-12">
                  <Users className="h-16 w-16" />
                </div>
              </CardContent>
            </Card>
            {statusCards.map(({ label, value, icon: Icon, color, bg, hoverBg, ring }) => (
              <Card key={label} className="col-span-1 border-none shadow-sm group cursor-default transition-all duration-300 hover:shadow-md hover:scale-[1.03]">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${bg} ${hoverBg} ring-0 group-hover:ring-4 ${ring} transition-all duration-300 group-hover:scale-110`}>
                    <Icon className={`h-4 w-4 ${color} transition-transform duration-300 group-hover:scale-110`} />
                  </div>
                  <p className="text-2xl font-extrabold transition-colors duration-300">{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold">Grafik Kehadiran Tahunan</h2>
              </div>
              {hasChartData ? (
                <div className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={yearlyData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaHadir" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(142,71%,45%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaIzin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(199,89%,48%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(199,89%,48%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaSakit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaAlpa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(0,84%,60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0,84%,60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="Hadir" stroke="hsl(142,71%,42%)" strokeWidth={2.5} fill="url(#areaHadir)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="Izin"  stroke="hsl(199,89%,45%)" strokeWidth={2.5} fill="url(#areaIzin)"  dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="Sakit" stroke="hsl(38,92%,48%)"  strokeWidth={2.5} fill="url(#areaSakit)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="Alpa"  stroke="hsl(0,84%,58%)"   strokeWidth={2.5} fill="url(#areaAlpa)"  dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-semibold text-muted-foreground">Belum ada data kehadiran</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Grafik akan tampil setelah data absensi {currentYear} tersedia
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Card className="border-none shadow-sm h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <span className="font-bold text-sm">Akses Cepat</span>
                  <p className="text-[10px] text-muted-foreground">
                    {isAdmin ? "Menu pintasan admin" : "Menu pintasan guru"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {(isAdmin ? quickLinks : guruQuickLinks).map(({ label, desc, icon: Icon, color, to }) => (
                  <button
                    key={label}
                    onClick={() => navigate(to)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all text-left group border border-transparent hover:border-border"
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} shrink-0 transition-transform group-hover:scale-105`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
