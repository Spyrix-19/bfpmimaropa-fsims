# Remix of bfpmimaropa-fsims

database/c# api will be implementated later on so use centralized mock-data that will represent actual data.. 

# Fire Safety Inspection Monitoring System (FSIMS)

## Project Overview

Develop a modern, professional, responsive, and Progressive Web Application (PWA) called **Fire Safety Inspection Monitoring System (FSIMS)**.

The primary purpose of the system is to collect Fire Safety Inspection data from all Fire Stations and automatically generate **real-time graphical dashboards** for monitoring, reporting, and decision-making.

This is **NOT** a transaction-heavy system. It is primarily a **Monitoring Dashboard System**, where the dashboard is the heart of the application.

All encoded records must automatically update the dashboard without requiring manual computation.

The uploaded Excel workbook serves as the primary reference for inspection fields, monitoring categories, computations, accomplishments, and graphical reports. Use it as the basis for the database design, reports, and dashboard metrics.

---

# Technology Stack

Build the application using **only** the following technologies.

## Frontend

* React 19

* TypeScript

* Vite

* Tailwind CSS

* shadcn/ui

* React Router DOM

* React Hook Form

* Axios

* Recharts

* Lucide React

## Backend

* ASP.NET Core Web API (.NET 8)

* Entity Framework Core

* JWT Authentication

* RESTful API

## Database

* PostgreSQL

Do not use Next.js, Angular, Vue, Bootstrap, Material UI, Firebase, Supabase, Laravel, or any other frontend framework.

---

# Development Requirements

Generate production-ready code following enterprise-level best practices.

The application must be:

* Clean Architecture

* Modular

* Reusable

* Maintainable

* Scalable

* Responsive

* Accessible

* Secure

* Well documented

Use:

* Functional Components

* React Hooks

* TypeScript Interfaces

* Environment Variables

* Reusable Components

* Reusable Layouts

* Role-Based Routing

* Lazy Loading

* Code Splitting

---

# Application Theme

Design Style

* Modern

* Minimalist

* Professional

* Clean Interface

Color Theme

Primary

Blue (#2563EB)

Support

* Light Mode

* Dark Mode

UI

* Rounded Cards

* Glassmorphism Login Modal

* Soft Shadows

* Smooth Animations

* Responsive Dashboard

* Interactive Charts

---

# System Objective

The objective of the system is to provide a centralized platform for monitoring Fire Safety Inspection accomplishments.

The system must transform encoded inspection records into graphical reports and statistics automatically.

Workflow

Inspection Data

↓

Database

↓

Dashboard

↓

Charts

↓

Reports

---

# Public Dashboard

The landing page is accessible without authentication.

Do NOT display a Login button.

Instead, display only:

* Dashboard

* Statistics

* Summary Cards

* Graphical Reports

* Rankings

To access the system,

Press

CTRL + /

A Login Modal must appear.

---

# Login Modal

Fields

* Email

* Password

* Remember Me

Buttons

* Login

* Forgot Password

Forgot Password

Since this feature is not yet implemented,

display

"Forgot Password is temporarily unavailable. Please contact the System Administrator."

---

# User Roles

## Super Admin

Full system access.

Can manage:

* Entire Region

* Provinces

* Municipalities

* Stations

* Users

* Reports

* Dashboard

* System Settings

---

## Administrator

Limited to assigned Province.

Can

* View Province Dashboard

* Encode Inspection Records

* Edit Province Records

* Export Reports

Cannot access records from other provinces.

---

## Encoder

Limited to assigned Fire Station.

Can

* Encode Inspection Records

* Edit Own Records

* View Station Dashboard

Cannot access other stations.

---

# Dashboard

The Dashboard is the primary feature of the system.

It must update automatically whenever inspection records are created, edited, or deleted.

No manual computation.

Everything is generated directly from the database.

---

# Dashboard Summary Cards

Display

* Total Target Inspections

* Total Actual Inspections

* Completion Rate

* Total FSEC

* Total FSIC

* Total NTC

* Total NOD

* Total NTCV

* Total Closure Cases

---

# Graphical Reports

Generate interactive charts using Recharts.

### Target vs Actual Inspection

Bar Chart

Grouped by

* Region

* Province

* Municipality

* Station

---

### Inspection Category Distribution

Pie Chart

Generate dynamically from database categories.

---

### Monthly Inspection Trend

Line Chart

Monthly accomplishments.

---

### Provincial Performance

Horizontal Bar Chart

Rank Provinces.

---

### Station Performance

Horizontal Bar Chart

Top Performing Fire Stations.

---

### Compliance Monitoring

Donut Chart

Display

* FSEC

* FSIC

* NTC

* NOD

* NTCV

* Closure

---

### Issuance Monitoring

Stacked Bar Chart

Compare

* Manual

* FSIS

Grouped by

* Semester

* Year

---

### Completion Rate

Gauge Chart

Display regional accomplishment percentage.

---

### Regional Comparison

Bar Chart

Compare all Provinces.

---

# Dashboard Filters

Every graph updates automatically.

Filters

* Year

* Semester

* Month

* Province

* Municipality

* Station

* Inspection Category

Role-based filtering must apply automatically.

---

# Inspection Module

Provide a single Inspection Encoding Form.

Inspection Information

* Inspection Date

* Province

* Municipality

* Station

* Inspector

* Establishment Name

* Occupancy Type

* Inspection Category

Inspection Data

* Target

* Actual

Compliance

* FSEC

* FSIC

* NTC

* NOD

* NTCV

* Closure

Remarks

Status

Saving a record immediately updates all dashboard statistics and graphs.

---

# Records Management

Provide a searchable and filterable records page.

Functions

* Add

* Edit

* Delete

* Search

* Filter

* Export to Excel

* Export to PDF

* Print

---

# User Management

Super Admin

* Create User

* Edit User

* Delete User

* Activate User

* Deactivate User

* Reset Password

* Assign Province

* Assign Station

* Assign Role

Administrator

* Manage Encoder accounts within assigned Province.

---

# Reports

Generate reports by

* Province

* Municipality

* Station

* Inspection Category

* Month

* Quarter

* Year

Support

* Excel

* PDF

* Print

---

# Audit Trail

Automatically log

* Login

* Logout

* Create

* Update

* Delete

* Export

* Password Reset

Store

* User

* Date

* Time

* IP Address

* Browser

* Action

---

# Responsive Design

The application must follow a **Mobile-First** design.

Support

* Desktop

* Tablet

* Mobile

Desktop

* Tables

* Multi-column layout

* Dashboard grid

Tablet

* Responsive grid

* Adaptive forms

Mobile

* Responsive Cards

* Touch-friendly controls

* Optimized forms

* Vertical dashboard cards

* Responsive charts

Tables should automatically switch to **Card View** on smaller screens when appropriate.

Allow users to switch between Table View and Card View.

All pages must remain fully functional on mobile devices.

---

# Progressive Web App (PWA)

The application must be fully PWA-ready.

Features

* Installable on Desktop and Mobile

* Service Worker

* Web App Manifest

* Offline support for static assets

* Splash Screen

* Application Icons

* Home Screen installation

* Offline detection

* Background synchronization (when applicable)

* Automatic updates

* Fast loading through caching

The application should behave like a native mobile application when installed.

---

# Performance

Optimize for performance.

* Lazy Loading

* Code Splitting

* Optimized Assets

* Efficient API Calls

* Fast Rendering

* Smooth Animations

Target excellent performance even on low-end Android devices.

---

# Accessibility

Follow WCAG best practices.

Support

* Keyboard Navigation

* Screen Readers

* High Contrast

* Responsive Typography

* Touch Targets (44×44 minimum)

* Semantic HTML

---

# Final Goal

Develop a production-ready Fire Safety Inspection Monitoring System that is simple, modern, responsive, secure, and easy to maintain.

The application must prioritize **graphical monitoring and analytics** over complex transaction processing. Every encoded inspection record should immediately update the dashboard, charts, KPIs, rankings, and reports, providing management with real-time insights at the Regional, Provincial, and Station levels.

The final output should include a clean folder structure, reusable React components,  normalized PostgreSQL database schema, role-based authentication, responsive UI, PWA support, and a professional dashboard suitable for deployment in a government environment.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8d4def2d-dc44-4e7d-963d-1857205aa236).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
