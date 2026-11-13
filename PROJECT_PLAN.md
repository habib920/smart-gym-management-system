Smart Gym Management System
Project Plan
1. Project Overview
Smart Gym is a responsive, browser-based gym management dashboard designed to demonstrate how common gym operations can be organized in one interface. It provides workflows for managing members, memberships, trainers, attendance, payments, workout plans, classes, bookings, fitness progress, equipment, and reports.

The project is implemented using HTML, CSS, and vanilla JavaScript, with application records stored in the browser.
2. Objectives
- Build a responsive and accessible dashboard for common gym-management tasks.
- Provide clear workflows for creating, viewing, updating, and deleting supported records.
- Demonstrate membership status checks and attendance validation.
- Provide QR-based member identification and attendance check-in.
- Demonstrate role-specific pages, forms, and actions for four user roles.
- Provide useful dashboard summaries, notifications, search, and CSV exports.
- Keep the application organized into dashboard logic, authentication, and additional features.
3. Target Users and Demo Roles
The interface demonstrates four roles:
Role	Intended responsibilities in the demo
Gym Manager	Access the full dashboard, manage records, view reports, and manage demo data
Reception Staff	Register and edit members, record attendance and payments, and manage bookings
Trainer	View gym members, manage own classes, create workout plans, check in members, and record progress
Member	View personal attendance, payments, workout plans, classes, and progress; book classes and record personal progress


Each signed-in user sees the interface and actions associated with their assigned role. The role is displayed as read-only in Settings.
4. Project Scope and Features
4.1 Dashboard
- Display total members, active memberships, today's attendance, and available trainers.
- Display weekly attendance and membership-plan distribution.
- Display attendance activity by time of day and selected reporting period.
4.2 Member and Membership Management
- Add, edit, and delete member records.
- Store member name, phone number, plan, start date, and expiry date.
- Determine active or expired membership from the expiry date.
- Highlight memberships expiring within seven days.
- Prevent duplicate phone numbers, including common Ethiopian number formats.
4.3 Trainer Management
- Add trainer profiles with specialty, phone number, and availability.
- Display trainer records and availability.
4.4 Attendance and QR Check-in
- Record manual attendance.
- Generate a QR code for each member and display/print the member QR card.
- Accept a typed member code or scan a QR code using a supported camera/browser.
- Reject check-ins for expired memberships and duplicate same-day check-ins.
4.5 Payments
- Record payment amount, member, purpose, date, and payment method.
- Display payment history and total recorded payments.
4.6 Workout Plans
- Create workout plans and assign them to members.
- Store plan name, goal, and schedule.
4.7 Classes and Bookings
- Create classes with a date, trainer, and capacity.
- Book active members into classes.
- Prevent duplicate bookings and bookings beyond class capacity.
- Allow supported booking cancellation.
4.8 Progress and Fitness Goals
- Record member weight, goal, target date, and record date.
- Display progress records.
4.9 Equipment
- Add equipment records with condition and notes.
- Identify equipment marked as needing maintenance or out of service.
4.10 Reports and Additional Features
- Display summary counts for members, payments, attendance, and workout plans.
- Export supported report data as CSV.
- Search pages and supported records.
- Display notifications for membership expiry, full classes, and equipment issues.
- Load and remove demonstration data.
- Support dark and light themes.
5. Technology Stack
Technology	Purpose
HTML5	Semantic page structure, forms, tables, and navigation
CSS3	Layout, responsive design, themes, and component styling
Vanilla JavaScript (ES6+)	Application logic, validation, data operations, routing, and interactions
localStorage	Persist application records in the current browser
sessionStorage / localStorage	Store the demo sign-in session
SVG	Interface icons and generated QR-code graphics
Git and GitHub	Source control and project submission


No framework, package manager, or build step is required.
6. Final Project File Structure
smart-gym-management-system/
├── index.html
├── style.css
├── auth.css
├── features.css
├── script.js
├── auth.js
├── features.js
├── gym-hero.png
└── favicon.svg
File responsibilities
- index.html — application markup, dashboard sections, forms, and script/style references.
- style.css — main dashboard styling, responsive layout, and themes.
- auth.css — login screen, profile menu, member summary, and authentication-related styling.
- features.css — QR check-in and notifications styling.
- script.js — core data model, localStorage persistence, dashboard rendering, forms, validation, navigation, search, and reports.
- auth.js — demo accounts, sign-in/session handling, role rules, role-specific wording, and UI restrictions.
- features.js — QR generation and scanning, duplicate-phone validation, expiring-membership indicators, notifications, and demo-data load/remove functions.
- gym-hero.png — background image referenced by the CSS.
- favicon.svg — browser tab icon referenced by index.html.
QR generation, scanning, and demo-data functions are handled by features.js.
7. Implementation Plan
Week 1 — Project Setup and Interface
- Define the project scope and user roles.
- Set up the HTML page structure and navigation.
- Build the responsive dashboard shell and visual theme.
- Add the main dashboard panels and page sections.
Week 2 — Core Management Workflows
- Implement member and trainer management.
- Implement attendance and membership-status checks.
- Implement payment, workout, class, booking, progress, and equipment forms.
- Add browser-based data persistence and form validation.
- Implement dashboard summaries and reports.
Week 3 — Authentication and Additional Features
- Add the demo sign-in screen and role-specific interface.
- Add QR generation, QR card display/printing, and check-in scanning/manual code entry.
- Add notifications and expiring-membership indicators.
- Add duplicate-phone validation.
- Add demo-data loading/removal, global search, and CSV exports.
- Add dark/light theme behavior and role-specific wording.
- Display the signed-in account role as read-only in Settings.
Week 4 — Testing, Refinement, and Submission
- Test the interface at desktop, tablet, and mobile widths.
- Test all demo roles and their visible pages, forms, and actions.
- Test form validation, membership expiry, attendance restrictions, booking capacity, and duplicate bookings.
- Test QR generation, manual code entry, camera permission handling, and fallback behavior.
- Test browser data persistence, demo-data removal, reset behavior, and CSV exports.
- Fix visual, accessibility, and usability issues.
- Prepare the README and final project documentation.
- Review the final file structure and submit the project.
8. Testing Checklist
- [ ] Login works for all four demo accounts.
- [ ] Sign-out clears the current demo session.
- [ ] Role-specific navigation, forms, and actions are displayed as intended.
- [ ] Member records can be created, edited, and deleted.
- [ ] Duplicate phone numbers are rejected.
- [ ] Membership status changes correctly when expiry dates pass.
- [ ] Expired members cannot check in or book classes.
- [ ] Duplicate same-day attendance is rejected.
- [ ] QR codes are generated and can be decoded.
- [ ] Manual QR-code entry works.
- [ ] Camera scanning works in a supported secure browser context.
- [ ] Payments, workout plans, classes, bookings, progress, and equipment records work.
- [ ] Duplicate bookings and full-class bookings are rejected.
- [ ] Notifications show the relevant conditions.
- [ ] Demo data can be loaded and removed.
- [ ] Search and CSV exports work.
- [ ] Data remains after a page reload in the same browser.
- [ ] Dark and light themes work.
- [ ] Layout and forms remain usable on mobile screens.
9. Known Limitations and Future Improvements
Current limitations
- Demo credentials are included in the application code.
- Data is stored per browser/device and is not synchronized between users or devices.
- Camera scanning depends on browser support and secure-context permissions. Manual member-code entry is available as an alternative.
Future improvements
- Add payment integration and more complete financial reporting.
- Add automated tests and deployment configuration.
10. Deliverables
- Responsive Smart Gym frontend application.
- HTML, CSS, and JavaScript source files.
- Demo login and role-specific interfaces.
- Browser-based data persistence.
- QR attendance workflow and notifications.
- README documentation and this project plan.
11. Success Criteria
The project is considered complete as a frontend demonstration when the main management workflows are usable, the interface responds across common screen sizes, demo roles show their intended interfaces, key validations prevent invalid actions, and project documentation accurately describes the delivered files and limitations.
12. Conclusion
Smart Gym demonstrates how a gym's common administrative workflows can be organized in a single responsive dashboard. The implementation focuses on frontend interaction, usability, responsive design, and browser-based demonstrations.