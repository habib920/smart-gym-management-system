
# Smart Gym Management System

## 1. Project Overview

Smart Gym is a web-based gym management application designed to simplify gym operations through a user-friendly and responsive dashboard.

The application provides features for managing members, memberships, trainers, attendance, payments, workout plans, classes, bookings, fitness progress, equipment, and reports.

## 2. Features

### Dashboard
- View total members.
- Monitor active memberships.
- Track daily attendance.
- View available trainers.
- Display attendance and membership statistics.

### Member Management
- Add, edit, and delete member records.
- Assign membership plans.
- Monitor membership expiry.
- Search and manage member information.

### Trainer Management
- Add and manage trainers.
- Record trainer specialties.
- Track trainer availability.

### Attendance Management
- Record member attendance.
- Support QR-code check-in.
- Prevent duplicate daily check-ins.
- Prevent check-ins for expired memberships.

### Membership Management
- Manage Basic, Standard, and Premium plans.
- Track active and expired memberships.

### Payment Management
- Record member payments.
- Support different payment methods.
- View payment records and summaries.

### Workout Plans
- Create workout plans.
- Assign plans to members.
- Manage workout information.

### Classes and Bookings
- Create and manage fitness classes.
- Set class capacity.
- Register members for classes.
- Prevent duplicate bookings and over-capacity bookings.

### Progress and Goals
- Record member weight.
- Track fitness goals.
- Monitor progress and target dates.

### Equipment Management
- Record gym equipment.
- Monitor equipment conditions.
- Identify equipment requiring maintenance.

### Reports
- View gym management summaries.
- Export supported records as CSV files.

### Additional Features
- Role-based interfaces for Gym Manager, Reception Staff, Trainer, and Member.
- Search functionality.
- Notifications for important gym activities.
- Dark and light themes.
- Demo data management.
- Responsive design for different screen sizes.

## 3. Technology Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- Local Storage
- Session Storage
- SVG
- Git and GitHub

## 4. Project Structure

```text
smart-gym-management-system/
│
├── index.html
├── style.css
├── auth.css
├── features.css
├── script.js
├── auth.js
├── features.js
├── gym-hero.png
├── favicon.svg
└── README.md
```


## 5. Demo Accounts

The application provides demonstration accounts for different user roles.

| Role | Email | Password |
|---|---|---|
| Gym Manager | manager@smartgym.com | Manager123 |
| Reception Staff | reception@smartgym.com | Reception123 |
| Trainer | trainer@smartgym.com | Trainer123 |
| Member | member@smartgym.com | Member123 |

## 6. Account Roles

The application supports four roles:

- **Gym Manager:** Access to overall gym management features and settings.
- **Reception Staff:** Access to member management, memberships, attendance, and payments.
- **Trainer:** Access to assigned training and member-related features.
- **Member:** Access to personal membership, workout, and progress information.

The signed-in user's role is displayed in Settings as read-only.

## 7. Data Management

- Application records are stored in the browser's Local Storage.
- Sign-in sessions use browser storage.
- Data remains available in the same browser unless it is cleared or reset.
- The Gym Manager can reset application data through Settings.

## 8. QR Code Functionality

The application supports QR-code generation for member identification and attendance.

Members can use their QR codes for check-in. Camera scanning depends on browser support and camera permissions. Manual member-code entry is also available.

For camera access, run the application through HTTPS or localhost.

## 9. Responsive Design

The application uses responsive layouts to support desktop, tablet, and mobile screens.

CSS Grid and Flexbox are used to organize dashboard sections and interface components.

## 10. Project Status

The Smart Gym Management System frontend application includes the main gym management features, role-based interfaces, attendance workflows, and reporting functionality.

For more information about the project scope and implementation phases, see `PROJECT_PLAN.md`.
