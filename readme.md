# Portal Backend API - Version 1.1

## **Overview**

The Portal Backend API provides functionality to manage agents, referrers, leads, and their workflows. This API is designed to facilitate loan refinancing operations, including agent and referrer management, lead tracking, and status updates. The implementation ensures clear role-based operations with extensibility for commission calculations and portal development.

### **Version**

- **Current Version:** 1.1
- **Status:** Phase 1 and Phase 2 complete.

---

## **Features and Functionalities**

### **1. Agent Management**

#### **Endpoints:**

- **Register New Agent**

  - **Endpoint:** `POST /api/agents/register`
  - **Role Required:** None (Public Access)
  - **Fields:**
    - Required: `name`, `phone`, `email`, `location`, `bank_name`, `account_number`
  - **Status:** Defaults to `Pending` until Admin approval.

- **Approve or Reject Agent**

  - **Endpoint:** `PATCH /api/agents/:id/approval`
  - **Role Required:** Admin
  - **Allowed Transitions:**
    - `Pending` → `Active`
    - `Pending` → `Rejected`

- **Activate or Deactivate Agent**

  - **Endpoint:** `PATCH /api/agents/:id/status`
  - **Role Required:** Admin
  - **Allowed Transitions:**
    - `Active` ↔ `Inactive`

- **Update Agent Details**

  - **Endpoint:** `PATCH /api/agents/:id`
  - **Role Required:** Admin
  - **Fields:**
    - Optional: `name`, `phone`, `email`, `location`, `bank_name`, `account_number`
  - **Behavior:** All existing fields must be provided to prevent `null` values during partial updates.

- **View All Agents**

  - **Endpoint:** `GET /api/agents`

- **View Pending Agents**

  - **Endpoint:** `GET /api/agents/pending`

- **Generate Referral Link**

  - **Endpoint:** `GET /api/agents/:id/referral-link`
  - **Behavior:** Generates a unique referral link for the agent.

---

### **2. Referrer Management**

#### **Endpoints:**

- **Register New Referrer**

  - **Endpoint:** `POST /api/agents/register-referrer`
  - **Role Required:** Admin
  - **Fields:**
    - Required: `name`, `phone`, `email`, `linked_agent_id`, `bank_name`, `account_number`
  - **Behavior:**
    - Associates the referrer with the provided `linked_agent_id`.

- **Update Referrer Details**

  - **Endpoint:** `PATCH /api/agents/:id`
  - **Role Required:** Admin
  - **Fields:**
    - Optional: `name`, `phone`, `email`, `bank_name`, `account_number`

- **View All Referrers**

  - **Endpoint:** `GET /api/agents?role=Referrer`

---

### **3. Lead Management**

#### **Endpoints:**

- **Create New Lead**

  - **Endpoint:** `POST /api/leads`
  - **Role Required:** Admin or Agent
  - **Fields:**
    - Required: `name`, `phone`, `loan_amount`, `estimated_savings`
    - Optional: `referral_code`
  - **Behavior:**
    - **Direct Lead:** Created without a referral code.
    - **Referral Lead:** Uses the referral code to:
      - Assign the lead to the referrer’s parent agent.
      - Track the `referrer_id` and set the source as `Referrer`.

- **Update Lead Status**

  - **Endpoint:** `PATCH /api/leads/:id`
  - **Role Required:** Admin or Agent
  - **Allowed Status Transitions:**
    - `New` → `Assigned`, `Contacted`
    - `Contacted` → `Preparing Documents`
    - `Preparing Documents` → `Submitted`
    - `Submitted` ↔ `KIV`
    - `Approved` ↔ `Declined`
  - **Admin Overrides:**
    - Admins can bypass standard transition rules for `Approved`, `Declined`, and `KIV`.

- **Reassign Lead**

  - **Behavior:**
    - Reassigns the lead to another agent while retaining the original `referrer_id` and `source`.
    - Updates the `assigned_agent_id` field.

- **View All Leads**

  - **Endpoint:** `GET /api/leads`
  - **Filters:** By `status`, `agent_id`, `date range`, etc.

---

### **4. Database Schema Updates**

- **Agents Table:**

  - Added `bank_name` and `account_number` fields.
  - Added `parent_referrer_id` to track referrer relationships.

- **Leads Table:**

  - Added `source` (default: `Direct`) to track lead origin.
  - Added `referrer_id` to associate leads with specific referrers.

---

## **How to Test the API**

### **1. Setup Instructions**

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Setup `.env` file:
   ```
   DATABASE_URL=<Your PostgreSQL Connection String>
   PORT=5000
   JWT_SECRET=<Your Secret Key>
   ```
4. Run database migrations:
   ```
   npm run migrate
   ```
5. Start the server:
   ```
   npm run dev
   ```

### **2. Testing Instructions**

#### **Authentication**

- Add `Authorization` headers:
  ```
  Authorization: Bearer <your-token>
  ```
- Use role-specific tokens for testing:
  - Admin: `Bearer admin-token`
  - Agent: `Bearer agent-token`
  - Referrer: `Bearer referrer-token`

#### **Phase 1 Tests**

1. **Create Direct Lead**

   ```
   POST /api/leads
   {
     "name": "Direct Lead",
     "phone": "0123456789",
     "loan_amount": 150000,
     "estimated_savings": 7000
   }
   ```

2. **Create Referral Lead**

   - Register an agent, approve them, and use their referral code:
     ```
     POST /api/leads
     {
       "name": "Referral Lead",
       "phone": "01987654321",
       "loan_amount": 200000,
       "estimated_savings": 10000,
       "referral_code": "REF-XXXXX"
     }
     ```

3. **Update Lead Status**

   ```
   PATCH /api/leads/:id
   {
     "status": "Contacted"
   }
   ```

4. **Reassign Lead**

   ```
   PATCH /api/leads/:id
   {
     "assigned_agent_id": "<agent-id>"
   }
   ```

#### **Phase 2 Tests**

1. **Register Referrer**

   ```
   POST /api/agents/register-referrer
   {
     "name": "Referrer Name",
     "phone": "01922334455",
     "email": "referrer@example.com",
     "linked_agent_id": "<agent-id>"
   }
   ```

2. **Update Agent Details**

   ```
   PATCH /api/agents/:id
   {
     "bank_name": "Maybank",
     "account_number": "1234567890"
   }
   ```

3. **Activate/Deactivate Agent**

   ```
   PATCH /api/agents/:id/status
   {
     "status": "Inactive"
   }
   ```

4. **Verify Relationships**

   - Create a referral lead and verify `referrer_id` and `assigned_agent_id`.
   - Reassign the lead and ensure `referrer_id` remains unchanged.

---

## **Next Steps**

1\. Revisit Commission Calculation (Phase 3)

Design and implement commission tracking for agents and referrers.

Key considerations:

Commission splits when referrers are involved.

Differentiation between direct leads and referral leads.

Tracking payout statuses (Pending, Approved, Paid).

Begin building API endpoints:

GET /api/commissions: View commissions by agent/referrer.

POST /api/commissions/payout: Mark commissions as paid.

2\. Automate Lead Reassignment (Phase 3)

Implement logic to:

Identify inactive leads (not contacted within 3 days).

Automatically reassign such leads to other agents or notify Admin for manual reassignment.

Develop a cron job or scheduled task to check for inactive leads.

3\. Build Basic Analytics (Phase 3)

Add a simple reporting endpoint for Admin to:

View total leads created, closed, or inactive.

See agent and referrer performance metrics.

Example endpoint:

GET /api/reports/summary: Generate aggregated metrics.

4\. Plan Portal Development (Phase 4)

With the backend functionality solidified, begin designing the frontend portal:

Admin dashboard for managing agents, referrers, leads, and commissions.

Agent and referrer dashboards for tracking cases and commissions.

Plan wireframes and define roles for frontend development.





## **Decide Integration vs. Standalone**

For Phase 3:



Integrate with the WhatsApp Bot: Leads generated by the bot can directly use the backend API, ensuring seamless data flow.

Standalone First: Build commission tracking and reassignment independently before integrating with external systems.

## **License**

This project is licensed under the MIT License.

