OpenWorkdayLab

OpenWorkdayLab is a portfolio project that simulates a lightweight HR and workforce management system.
It demonstrates backend engineering, database design, and analytics reporting with modern tooling such as Node.js, Express, Prisma, and PostgreSQL.

This project is designed to showcase practical experience building Workday-style reporting tools and provides HR-focused data models such as employees, benefits, time entries, and cost analysis.

🚀 Features

API-Driven Backend

Built with Express + Node.js

Structured endpoints under /api

Database Modeling

Prisma ORM with a PostgreSQL database

Schema includes workers, enrollments, and time_entries

Seeding with Realistic Data

seed.ts generates thousands of rows of realistic HR data

Workers, enrollments, and time entries for performance testing

Analytics & Reporting

Example report: Benefits Cost Analysis

Exposes both JSON and CSV download (Accept: text/csv)

Calculates % of salary spent on benefits and total compensation

📂 Project Structure
OpenWorkdayLab/
│
├── backend/                # Backend service
│   ├── prisma/             # Database schema
│   ├── src/
│   │   ├── db/             # Prisma client & seed
│   │   ├── reports/        # Report logic (e.g., benefits-cost)
│   │   ├── index.ts        # Express entry point
│   └── package.json
│
└── README.md

🛠️ Tech Stack

Node.js + Express – API & routing

Prisma ORM – Database modeling & migrations

PostgreSQL – Relational database

TypeScript – Strongly-typed backend

pnpm – Fast, reliable package manager

⚡ Getting Started
1. Clone the repo
git clone https://github.com/chelsbun/openworkdaylab.git
cd openworkdaylab/backend

2. Install dependencies
pnpm install

3. Set up the database
pnpm prisma migrate reset

4. Seed with sample data
pnpm seed

5. Start the backend
pnpm dev


Backend runs on http://localhost:8080

📊 Example API Endpoints
Benefits Cost Report

JSON

GET /api/reports/benefits-cost


CSV Download

curl -H "Accept: text/csv" http://localhost:8080/api/reports/benefits-cost -o benefits.csv

🎯 Why This Project?

This project is inspired by Workday’s HR analytics tools.
It demonstrates the ability to:

Model HR/business data in a relational database

Build API-first applications with reporting features

Export analytics in multiple formats (JSON, CSV)

Handle realistic data volumes for scalability

It serves as both a portfolio piece and a learning lab for enterprise HR software concepts.

📌 Future Enhancements

Authentication & role-based access

Additional reports (turnover, time tracking, payroll)

Frontend dashboard with charts/visuals

👩‍💻 Author

Chelsea Bonyata

BS Computer Science (in progress) – University of Houston-Downtown

Interests: HR Tech, Database Engineering, Enterprise Software
