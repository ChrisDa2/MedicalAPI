# 🏥 Healthcare Appointment and Records Management System API

This project is a RESTful API designed to manage a healthcare system, including appointments, medical records, user management, and public access to hospital information. It was developed as a final academic practice, focusing on clean architecture, security, and role-based access control.

## 🏗️ Architectural Design & Highlights

During the development of this API, I made a key architectural decision: **instead of creating separate tables/classes for Patients, Doctors, and Admins, I unified them into a single `User` entity with assigned roles.** 

*   **Role-Based Access Control (RBAC):** Permissions and data access are strictly enforced based on the user's role (`PATIENT`, `DOCTOR`, `ADMIN`).
*   **Data Integrity:** Simplifies authentication and authorization flows, as all users share the same base attributes (name, email, etc.).
*   **Scalability:** Makes it easier to add new roles in the future without restructuring the database schema.

## 🚀 Key Features

*   **Appointment Management:** Patients can book, reschedule, and cancel appointments. Doctors can set their availability and manage their schedules.
*   **Medical Records:** Doctors can create and update records (diagnosis, prescriptions, treatments, test results). Patients have read-only access to their own records.
*   **Search & Filtering:** Patients can search for doctors by specialty, availability, and location. Admins can search for users and records.
*   **Audit Log:** A system-wide log that tracks user actions (appointments, medical record updates) for administrative review.
*   **Fake Notifications:** A mock module simulating email/SMS notifications for appointment changes and record updates.
*   **Public Access:** Unauthenticated users can view general information about doctors and hospital departments.

## 🗺️ API Flows & Endpoints

The API is structured around four main flows:

### 👤 Patient Flow
*   `GET /appointments` - List personal appointments.
*   `GET /doctors` - List available doctors (filtered by specialty/location).
*   `POST /appointments` - Create a new appointment.
*   `PUT /appointments/{idAppointment}` - Reschedule an appointment.
*   `DELETE /appointments/{idAppointment}` - Cancel an appointment.
*   `GET /medicalRecords` - List own medical records.
*   `GET /medicalRecords/{idMedicalRecord}` - View a specific medical record.
*   `PUT /patients/{idPatient}` - Update personal profile.

### 🩺 Doctor Flow
*   `PUT /doctors/{idDoctor}` - Manage availability (time slots).
*   `GET /appointments` - View appointment schedule.
*   `DELETE /appointments/{idAppointment}` - Cancel an appointment (notifies patient).
*   `GET /medicalRecords` - List medical records created by the doctor.
*   `POST /medicalRecords` - Create a new medical record.
*   `GET /medicalRecords/{idMedicalRecord}` - View a specific medical record.
*   `PUT /medicalRecords/{idMedicalRecord}` - Manage test results and treatments.

### 🛡️ Admin Flow
*   `GET /users` - List all users (patients and doctors).
*   `GET /users?name={name}` - Search for a user.
*   `PUT /users/{idUser}` - View and manage user information.
*   `GET /medicalRecords` - Search and list all medical records.
*   `PUT /appointments` - Manage appointment settings (start time, end time, duration).
*   `GET /logs` - List audit logs.

### 🌐 Public Access Flow
*   `GET /doctors` - List general doctor information (name, specialty).
*   `GET /hospitals` - List hospital departments and services.

## 🛠️ Tech Stack
*(Añade aquí las tecnologías que usaste, por ejemplo:)*
*   **Language:** [e.g., Java, Python, Node.js]
*   **Framework:** [e.g., Spring Boot, Django, Express]
*   **Database:** [e.g., MySQL, PostgreSQL, MongoDB]
*   **Authentication:** [e.g., JWT, OAuth2]

## ⚙️ How to Run
*(Añade los pasos básicos para ejecutar tu proyecto, por ejemplo:)*
1. Clone the repository: `git clone https://github.com/tu-usuario/tu-repositorio.git`
2. Install dependencies: `npm install` (o el comando que uses)
3. Set up the database and environment variables.
4. Run the server: `npm start`

---
*Developed by Christian Fuertes Peinado as part of the final practice for Tecnologías Avanzadas in Universidad San Jorge.*