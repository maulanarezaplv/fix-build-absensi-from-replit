import PDFDocument from "pdfkit";
import { storage } from "./storage";

const STATUS_LABEL: Record<string, string> = {
  hadir: "H",
  sakit: "S",
  izin: "I",
  alpa: "A",
};

const STATUS_COLOR: Record<string, string> = {
  H: "#16a34a",
  S: "#d97706",
  I: "#2563eb",
  A: "#dc2626",
};

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export async function generateMonthlyRecapPdf(
  classId: string,
  year: number,
  month: number,
  schoolName: string
): Promise<Buffer> {
  const cls = (await storage.getClasses()).find(c => c.id === classId);
  if (!cls) throw new Error("Kelas tidak ditemukan");

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [studentRows, attendanceRows] = await Promise.all([
    storage.getStudents(classId),
    storage.getAttendance({ classId, startDate, endDate }),
  ]);

  const attendanceMap: Record<string, Record<number, string>> = {};
  for (const rec of attendanceRows as any[]) {
    const sid = rec.student_id;
    const day = parseInt(rec.date.slice(8, 10));
    const st = STATUS_LABEL[rec.status] || rec.status?.slice(0, 1).toUpperCase() || "?";
    if (!attendanceMap[sid]) attendanceMap[sid] = {};
    attendanceMap[sid][day] = st;
  }

  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const monthLabel = `${MONTHS_ID[month - 1]} ${year}`;

  const marginX = 28;
  const marginY = 32;
  const pageWidth = 841.89;
  const pageHeight = 595.28;

  const colNoW = 22;
  const colNameW = 130;
  const colSumW = 18;
  const numSumCols = 4;
  const sumColsW = colSumW * numSumCols;
  const dayColW = (pageWidth - marginX * 2 - colNoW - colNameW - sumColsW) / days.length;

  const headerH = 52;
  const rowH = 16;
  const tableTop = marginY + headerH + 4;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const font = (size: number, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    };

    // ── Background ──
    doc.rect(0, 0, pageWidth, pageHeight).fill("#f8fafc").stroke();
    doc.rect(marginX - 6, marginY - 6, pageWidth - (marginX - 6) * 2, pageHeight - (marginY - 6) * 2)
      .fill("white").stroke("#e2e8f0");

    // ── Header ──
    font(11, true);
    doc.fillColor("#1e293b").text("REKAP ABSENSI BULANAN", marginX, marginY, { width: pageWidth - marginX * 2, align: "center" });
    font(9);
    doc.fillColor("#475569").text(schoolName, marginX, marginY + 14, { width: pageWidth - marginX * 2, align: "center" });
    font(8.5);
    doc.fillColor("#64748b").text(`Kelas: ${cls.name}  |  ${monthLabel}`, marginX, marginY + 26, { width: pageWidth - marginX * 2, align: "center" });

    // ── Divider ──
    doc.moveTo(marginX, marginY + headerH - 4).lineTo(pageWidth - marginX, marginY + headerH - 4)
      .strokeColor("#cbd5e1").lineWidth(0.5).stroke();

    // ── Table header row ──
    let x = marginX;
    const thY = tableTop;

    const drawHeaderCell = (text: string, w: number, xPos: number, align: "left" | "center" = "center") => {
      doc.rect(xPos, thY, w, rowH).fill("#1e293b").stroke();
      font(6.5, true);
      doc.fillColor("white").text(text, xPos + 1, thY + (rowH - 6.5) / 2, { width: w - 2, align });
    };

    drawHeaderCell("No", colNoW, x); x += colNoW;
    drawHeaderCell("Nama Siswa", colNameW, x, "left"); x += colNameW;
    days.forEach(d => { drawHeaderCell(String(d), dayColW, x); x += dayColW; });
    drawHeaderCell("H", colSumW, x); x += colSumW;
    drawHeaderCell("S", colSumW, x); x += colSumW;
    drawHeaderCell("I", colSumW, x); x += colSumW;
    drawHeaderCell("A", colSumW, x);

    // ── Student rows ──
    studentRows.forEach((student: any, idx: number) => {
      const rowY = tableTop + rowH + idx * rowH;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? "#f8fafc" : "white";

      const statusMap = attendanceMap[student.id] || {};
      let hCount = 0, sCount = 0, iCount = 0, aCount = 0;

      let rx = marginX;
      doc.rect(rx, rowY, colNoW, rowH).fill(rowBg).stroke("#e2e8f0");
      font(6.5);
      doc.fillColor("#374151").text(String(idx + 1), rx + 1, rowY + (rowH - 6.5) / 2, { width: colNoW - 2, align: "center" });
      rx += colNoW;

      doc.rect(rx, rowY, colNameW, rowH).fill(rowBg).stroke("#e2e8f0");
      font(6.5);
      doc.fillColor("#374151").text(student.name, rx + 2, rowY + (rowH - 6.5) / 2, { width: colNameW - 4, align: "left", lineBreak: false });
      rx += colNameW;

      days.forEach(d => {
        const st = statusMap[d];
        const cellBg = st ? (STATUS_COLOR[st] + "18") : rowBg;
        doc.rect(rx, rowY, dayColW, rowH).fill(cellBg).stroke("#e2e8f0");
        if (st) {
          font(6.5, true);
          doc.fillColor(STATUS_COLOR[st] || "#374151").text(st, rx + 1, rowY + (rowH - 6.5) / 2, { width: dayColW - 2, align: "center" });
          if (st === "H") hCount++;
          else if (st === "S") sCount++;
          else if (st === "I") iCount++;
          else if (st === "A") aCount++;
        }
        rx += dayColW;
      });

      const drawSumCell = (count: number, color: string) => {
        doc.rect(rx, rowY, colSumW, rowH).fill(rowBg).stroke("#e2e8f0");
        font(6.5, true);
        doc.fillColor(color).text(String(count || ""), rx + 1, rowY + (rowH - 6.5) / 2, { width: colSumW - 2, align: "center" });
        rx += colSumW;
      };
      drawSumCell(hCount, STATUS_COLOR.H);
      drawSumCell(sCount, STATUS_COLOR.S);
      drawSumCell(iCount, STATUS_COLOR.I);
      drawSumCell(aCount, STATUS_COLOR.A);
    });

    // ── Legend ──
    const legendY = tableTop + rowH + studentRows.length * rowH + 8;
    font(7);
    doc.fillColor("#64748b").text("Keterangan: H = Hadir  |  S = Sakit  |  I = Izin  |  A = Alpa", marginX, legendY);

    doc.end();
  });
}
