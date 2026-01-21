# AutoFlow — Invoice Approval & Audit System

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=render)](https://autoflow-vyvd.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**AutoFlow** is a secure, full-stack workflow automation platform designed to streamline invoice processing for enterprises. It features Role-Based Access Control (RBAC), immutable audit logging for SOC2 compliance, and real-time financial analytics.

> **Live Demo:** [https://autoflow-vyvd.onrender.com](https://autoflow-vyvd.onrender.com)  
> *Test Credentials located in "Installation" section below.*

---

## 📸 Screenshots

| Dashboard & KPIs | Role-Based Approval Queue |
|:---:|:---:|
| ![Dashboard]([[https://placehold.co/600x400?text=Dashboard+Screenshot](https://github.com/snmallick2401/AutoFlow-Invoice-Approval-Audit-Workflow-System/blob/main/public/assets/screencapture-autoflow-vyvd-onrender-dashboard-html-2026-01-21-22_57_17.png)](https://github.com/snmallick2401/AutoFlow-Invoice-Approval-Audit-Workflow-System/blob/main/public/assets/screencapture-autoflow-vyvd-onrender-dashboard-html-2026-01-21-22_57_17.png)) | ![Approvals](https://placehold.co/600x400?text=Approval+Queue) |

| Immutable Audit Logs | Interactive Analytics |
|:---:|:---:|
| ![Audit Logs](https://placehold.co/600x400?text=Audit+Log+Viewer) | ![Reports](https://placehold.co/600x400?text=Financial+Reports) |

---

## 🚀 Key Features

* **🛡️ Multi-Tier RBAC**: Granular access control for 4 distinct roles (**Admin, Finance, Manager, Employee**) preventing unauthorized access to sensitive financial data.
* **🔒 Immutable Audit Trails**: A tamper-proof, append-only ledger (`AuditLog` model) that records every user action (Login, Approve, Reject) with IP tracking for security compliance.
* **📊 Dynamic Dashboard**: Real-time aggregation of financial KPIs (Total Spend, Pending Approvals) using MongoDB Aggregation Pipelines.
* **⚡ Smart Environment Detection**: Frontend automatically switches between `localhost` and production APIs without manual code changes.
* **🔐 Secure Authentication**: JWT-based stateless authentication with bcrypt password hashing and robust middleware protection.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js (RESTful API)
* **Database:** MongoDB Atlas, Mongoose ODM
* **Frontend:** Vanilla JS (ES6+), HTML5, CSS3 (CSS Variables for Dark Mode)
* **Security:** Helmet.js, CORS, JSON Web Tokens (JWT), Bcrypt
* **Deployment:** Render (Cloud Hosting)

---

## 📂 Project Structure

```bash
AutoFlow/
├── src/
│   ├── controllers/      # Business logic (Auth, Invoices, Audits)
│   ├── middleware/       # RBAC guards & JWT verification
│   ├── models/           # Mongoose schemas (Immutable AuditLog)
│   └── routes/           # API route definitions
├── public/               # Responsive frontend (HTML/CSS/JS)
│   ├── js/api.js         # Centralized API wrapper
│   └── css/theme.css     # Dark/Light mode variables
└── server.js             # Application entry point
