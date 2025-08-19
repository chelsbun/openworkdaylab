# OpenWorkdayLab – Update
Adds EIB imports for **Enrollments** and **Time Entries** and upgrades the UI.

## Update instructions (if you ran the previous version)
1. Stop the running dev server (Ctrl+C in the backend window).
2. Replace your `backend/src/routes/eib.routes.ts` with the updated one.
3. Replace `backend/src/public/index.html` with the updated one.
4. Add the two sample files into `backend/src/public/samples/`:
   - `enrollments.csv`
   - `time_entries.csv`
5. Ensure `cors` and its types are installed:
   ```powershell
   pnpm add cors
   pnpm add -D @types/cors
   ```
6. Start again:
   ```powershell
   pnpm dev
   ```

> New endpoints:
- `POST /api/eib/import/enrollments` (CSV headers: workerId,planType,coverageLevel,employeePrem,employerPrem,effectiveDate)
- `POST /api/eib/import/time-entries` (CSV headers: workerId,date,hours,timeType)

Use the UI to upload all three CSVs, then run the Benefits Cost report.
