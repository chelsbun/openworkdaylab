import { Router } from "express";
import { prisma } from "../db/prisma.js";

const r = Router();

/** GET /api/reports/benefits-cost */
r.get("/benefits-cost", async (req, res) => {
  const { from, to, dept } = req.query as any;
  const start = from ? new Date(from) : new Date("1970-01-01");
  const end = to ? new Date(to) : new Date();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select 
        w."workerId",
        w."firstName",
        w."lastName",
        w."department",
        (w."salary")::numeric as salary,
        date_part('year', age(now(), w."hireDate"))::int as years_of_service,
        coalesce(sum(e."employeePrem" + e."employerPrem"),0)::numeric as benefits_cost,
        (coalesce(sum(e."employeePrem" + e."employerPrem"),0) / nullif(w."salary",0))::numeric as pct_salary,
        ((w."salary") + coalesce(sum(e."employeePrem" + e."employerPrem"),0))::numeric as total_comp
     from "Worker" w
     left join "Enrollment" e on e."workerId" = w."workerId"
       and e."effectiveDate" between $1 and $2
     ${dept ? `where w."department" = $3` : ""}
     group by w.id
     order by w."lastName" asc`,
    ...(dept ? [start, end, dept] : [start, end])
  );

  if ((req.headers.accept || "").includes("text/csv")) {
    const header = "workerId,firstName,lastName,department,salary,years_of_service,benefits_cost,pct_salary,total_comp\n";
    const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = header + rows.map(r =>
      [r.workerId, r.firstName, r.lastName, r.department, r.salary, r.years_of_service, r.benefits_cost, r.pct_salary, r.total_comp]
        .map(q).join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=benefits_cost.csv");
    return res.send(csv);
  }

  return res.json(rows);
});

/** GET /api/reports/benefits-by-dept */
r.get("/benefits-by-dept", async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `with costs as (
      select w."department",
             w."salary"::numeric as salary,
             coalesce(sum(e."employeePrem" + e."employerPrem"),0)::numeric as benefits_cost
      from "Worker" w
      left join "Enrollment" e on e."workerId" = w."workerId"
      group by w.id
    )
    select department,
           count(*)::int as employees,
           sum(benefits_cost)::numeric as total_benefits_cost,
           avg(benefits_cost)::numeric as avg_benefits_per_employee,
           avg(salary)::numeric as avg_salary,
           avg(benefits_cost / nullif(salary,0))::numeric as avg_pct_salary
    from costs
    group by department
    order by total_benefits_cost desc`
  );
  res.json(rows);
});

/** GET /api/reports/benefits-trend?dept=Engineering */
r.get("/benefits-trend", async (req, res) => {
  const { dept } = req.query as any;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select date_trunc('month', e."effectiveDate")::date as month,
            ${dept ? `w."department" as department,` : ``}
            sum(e."employeePrem" + e."employerPrem")::numeric as benefits_cost
     from "Enrollment" e
     join "Worker" w on w."workerId" = e."workerId"
     ${dept ? `where w."department" = $1` : ``}
     group by ${dept ? `1,2` : `1`}
     order by 1 asc`,
    ...(dept ? [dept] : [])
  );
  res.json(rows);
});

export default r;
