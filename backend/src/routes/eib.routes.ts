import { Router } from "express";
import multer from "multer";
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../db/prisma.js";

const upload = multer({
  dest: "/tmp",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) return cb(new Error("Only .csv files allowed"));
    cb(null, true);
  }
});
const r = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static sample files
r.get("/samples/workers.csv", (_req, res) => res.sendFile(path.join(__dirname, "../public/samples/workers.csv")));
r.get("/samples/enrollments.csv", (_req, res) => res.sendFile(path.join(__dirname, "../public/samples/enrollments.csv")));
r.get("/samples/time_entries.csv", (_req, res) => res.sendFile(path.join(__dirname, "../public/samples/time_entries.csv")));

async function parseCsv(filePath: string) {
  const records: Record<string, any>[] = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }))
      .on("data", (row) => records.push(row))
      .on("error", reject)
      .on("end", () => resolve());
  });
  return records;
}
const asNumber = (v: any) => (v === undefined || v === null || v === "" ? null : (Number(v)));
const asDate = (v: any) => (!v ? null : (isNaN(new Date(v).getTime()) ? null : new Date(v)));

/**
 * POST /api/eib/import/workers
 * CSV: workerId,firstName,lastName,email,department,jobTitle,hireDate,birthDate,salary,managerId,status
 */
r.post("/import/workers", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const rows = await parseCsv(req.file.path);
    const errors: string[] = []; let imported = 0;

    for (const [i, row] of rows.entries()) {
      try {
        const workerId = String(row.workerId || "").trim();
        const email = String(row.email || "").trim();
        if (!workerId || !email) throw new Error("workerId and email required");

        const hireDate = asDate(row.hireDate);
        const birthDate = asDate(row.birthDate);
        const salary = asNumber(row.salary);
        if (!hireDate) throw new Error("invalid hireDate");
        if (!birthDate) throw new Error("invalid birthDate");
        if (salary === null || !Number.isFinite(salary)) throw new Error("invalid salary");

        const data = {
          workerId,
          firstName: String(row.firstName || "").trim(),
          lastName: String(row.lastName || "").trim(),
          email,
          department: String(row.department || "").trim(),
          jobTitle: String(row.jobTitle || "").trim(),
          hireDate, birthDate, salary,
          managerId: row.managerId ? String(row.managerId).trim() : null,
          status: String(row.status || "Active").trim(),
        };

        await prisma.worker.upsert({ where: { workerId }, update: data, create: data });
        await prisma.auditLog.create({ data: { actor: "integration@demo.local", action: "IMPORT", entity: "Worker", entityId: workerId, after: data as any, reason: "EIB import" }});
        imported++;
      } catch (e: any) { errors.push(`row ${i + 1}: ${e.message}`); }
    }
    return res.json({ imported, errors });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

/**
 * POST /api/eib/import/enrollments
 * CSV: workerId,planType,coverageLevel,employeePrem,employerPrem,effectiveDate
 */
r.post("/import/enrollments", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const rows = await parseCsv(req.file.path);
    const errors: string[] = []; let imported = 0;

    for (const [i, row] of rows.entries()) {
      try {
        const workerId = String(row.workerId || "").trim();
        if (!workerId) throw new Error("workerId required");
        const effectiveDate = asDate(row.effectiveDate);
        if (!effectiveDate) throw new Error("invalid effectiveDate");
        const employeePrem = asNumber(row.employeePrem);
        const employerPrem = asNumber(row.employerPrem);
        if (employeePrem === null || employerPrem === null) throw new Error("invalid employeePrem/employerPrem");

        const data = {
          workerId,
          planType: String(row.planType || "").trim(),
          coverageLevel: String(row.coverageLevel || "").trim(),
          employeePrem, employerPrem, effectiveDate,
        };

        await prisma.enrollment.create({ data });
        await prisma.auditLog.create({ data: { actor: "integration@demo.local", action: "IMPORT", entity: "Enrollment", entityId: workerId, after: data as any, reason: "EIB import" }});
        imported++;
      } catch (e: any) { errors.push(`row ${i + 1}: ${e.message}`); }
    }
    return res.json({ imported, errors });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

/**
 * POST /api/eib/import/time-entries
 * CSV: workerId,date,hours,timeType
 */
r.post("/import/time-entries", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const rows = await parseCsv(req.file.path);
    const errors: string[] = []; let imported = 0;

    for (const [i, row] of rows.entries()) {
      try {
        const workerId = String(row.workerId || "").trim();
        if (!workerId) throw new Error("workerId required");
        const date = asDate(row.date);
        if (!date) throw new Error("invalid date");
        const hours = asNumber(row.hours);
        if (hours === null || !Number.isFinite(hours)) throw new Error("invalid hours");

        const data = { workerId, date, hours, timeType: String(row.timeType || "Regular").trim() };
        await prisma.timeEntry.create({ data });
        await prisma.auditLog.create({ data: { actor: "integration@demo.local", action: "IMPORT", entity: "TimeEntry", entityId: workerId, after: data as any, reason: "EIB import" }});
        imported++;
      } catch (e: any) { errors.push(`row ${i + 1}: ${e.message}`); }
    }
    return res.json({ imported, errors });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default r;
