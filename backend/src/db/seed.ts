// backend/src/db/seed.ts
import { prisma } from "./prisma.js";
import { faker } from "@faker-js/faker";

faker.seed(42); // deterministic, repeatable data

// You can tweak volumes here (or via env vars)
const NUM_WORKERS = Number(process.env.SEED_WORKERS || 1000); // 500–2000 works fine
const MAX_ENROLL_MONTHS_MIN = 12;
const MAX_ENROLL_MONTHS_MAX = 24;
const TIME_DAYS_MIN = 60;
const TIME_DAYS_MAX = 120;

const DEPTS = ["Engineering", "Finance", "Sales", "HR", "IT", "Marketing", "Operations", "Support"];
const PLANS = ["Medical", "Dental", "Vision"];
const COV   = ["Employee", "Employee+Spouse", "Employee+Children", "Family"];

function chunk<T>(arr: T[], size = 1000) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

async function main() {
  console.log("🔄 Clearing tables…");
  // Delete children first due to FK constraints
  await prisma.$transaction([
    prisma.businessProcess.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.worker.deleteMany(),
  ]);

  console.log(`👷 Seeding ${NUM_WORKERS} workers…`);
  const workers = Array.from({ length: NUM_WORKERS }).map((_, i) => {
    const workerId = `W${1000 + i}`;
    const first = faker.person.firstName();
    const last  = faker.person.lastName();
    const dept  = faker.helpers.arrayElement(DEPTS);
    const job   = faker.person.jobTitle();
    const hireDate = faker.date.past({ years: 8 });     // hired within last ~8 years
    const birthDate = faker.date.birthdate({ min: 22, max: 60, mode: "age" });
    const salary = faker.number.int({ min: 55000, max: 190000 });

    return {
      workerId,
      firstName: first,
      lastName: last,
      // ✅ Guarantee unique emails to satisfy @unique constraint
      email: `${first}.${last}.${workerId}@example.com`.toLowerCase(),
      department: dept,
      jobTitle: job,
      hireDate,
      birthDate,
      salary,
      status: "Active" as const,
    };
  });

  for (const batch of chunk(workers, 500)) {
    await prisma.worker.createMany({ data: batch, skipDuplicates: true });
  }
  console.log("✅ Workers seeded.");

  // ---------------- Enrollments ----------------
  console.log("📦 Seeding enrollments (monthly premiums) …");
  const enrollments: {
    workerId: string;
    planType: string;
    coverageLevel: string;
    employeePrem: number;
    employerPrem: number;
    effectiveDate: Date;
  }[] = [];

  for (const w of workers) {
    const planCount = faker.number.int({ min: 1, max: 3 });
    const chosenPlans = faker.helpers.arrayElements(PLANS, planCount);
    const months = faker.number.int({ min: MAX_ENROLL_MONTHS_MIN, max: MAX_ENROLL_MONTHS_MAX });

    // Start sometime in last ~2 years
    const start = faker.date.past({ years: 2 });

    for (const plan of chosenPlans) {
      for (let m = 0; m < months; m++) {
        const dt = new Date(start);
        dt.setMonth(start.getMonth() + m);

        const coverageLevel = faker.helpers.arrayElement(COV);
        const employeePrem  = faker.number.int({ min: 100, max: 400 });  // monthly
        const employerPrem  = faker.number.int({ min: 300, max: 1200 }); // monthly

        enrollments.push({
          workerId: w.workerId,
          planType: plan,
          coverageLevel,
          employeePrem,
          employerPrem,
          effectiveDate: dt,
        });
      }
    }
  }

  for (const batch of chunk(enrollments, 1000)) {
    await prisma.enrollment.createMany({ data: batch });
  }
  console.log(`✅ Enrollments seeded. Rows: ${enrollments.length}`);

  // ---------------- Time Entries ----------------
  console.log("⏱️  Seeding time entries …");
  const timeEntries: {
    workerId: string;
    date: Date;
    hours: number;
    timeType: string;
  }[] = [];

  for (const w of workers) {
    const days = faker.number.int({ min: TIME_DAYS_MIN, max: TIME_DAYS_MAX });
    const start = faker.date.past({ years: 1 });

    for (let d = 0; d < days; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + d);
      if (isWeekend(dt)) continue;

      const isOT = faker.number.int({ min: 1, max: 15 }) === 1; // ~6–7% OT days
      timeEntries.push({
        workerId: w.workerId,
        date: dt,
        hours: isOT ? 10 : 8,
        timeType: isOT ? "OT" : "Regular",
      });
    }
  }

  for (const batch of chunk(timeEntries, 2000)) {
    await prisma.timeEntry.createMany({ data: batch });
  }
  console.log(`✅ Time entries seeded. Rows: ${timeEntries.length}`);

  // ---------------- Audit Log Summary ----------------
  await prisma.auditLog.create({
    data: {
      actor: "seed@system",
      action: "SEED",
      entity: "System",
      entityId: "-",
      after: { workers: workers.length, enrollments: enrollments.length, timeEntries: timeEntries.length } as any,
      reason: "Initial demo dataset",
    }
  });

  console.log("🎉 Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
