# Portal Backend API - Version 2.0

## **Overview**
The Portal Backend API provides functionality to manage agents, referrers, leads, and their associated workflows. This API is designed for administrative, agent, and referrer operations to streamline loan application processes, agent and referrer registrations, and lead management.

### **Current Version**
- **Version:** 2.0
- **Status:** Backend functionalities completed and tested for Phases 1 and 2.

---

## **Features and Functions**

### **1. Agent Management**
- **Register New Agent (Self-Registration)**
  - Endpoint: `POST /api/agents/register`
  - Status: Default `Pending` until approved by Admin.
  - Required Fields: `name`, `phone`, `email`, `location`

- **Approve or Reject Agent**
  - Endpoint: `PATCH /api/agents/:id/approval`
  - Role Required: Admin
  - Allowed Status Changes: `Pending` → `Active`, `Pending` → `Rejected`

- **Activate or Deactivate Agent**
  - Endpoint: `PATCH /api/agents/:id/status`
  - Role Required: Admin
  - Allowed Status Changes: `Active` ↔ `Inactive`

- **Update Agent Details**
  - Endpoint: `PATCH /api/agents/:id`
  - Role Required: Admin
  - Fields: `name`, `phone`, `email`, `location`, `bank_name`, `account_number`

- **Get All Agents**
  - Endpoint: `GET /api/agents`

- **Get Pending Agents**
  - Endpoint: `GET /api/agents/pending`

### **2. Referrer Management**
- **Register New Referrer**
  - Endpoint: `POST /api/agents/register-referrer`
  - Role Required: Admin
  - Required Fields: `name`, `phone`, `email`, `linked_agent_id`

- **Update Referrer Details**
  - Endpoint: `PATCH /api/agents/:id`
  - Role Required: Admin
  - Fields: `name`, `phone`, `email`, `bank_name`, `account_number`

- **View Linked Referrers**
  - Endpoint: `GET /api/agents?role=Referrer`

### **3. Lead Management**
- **Create New Lead**
  - Endpoint: `POST /api/leads`
  - Role Required: Admin or Agent (linked to referral code or directly assigned).
  - Fields: `name`, `phone`, `loan_amount`, `estimated_savings`, `assigned_agent_id`, `referral_code`

- **Get All Leads**
  - Endpoint: `GET /api/leads`
  - Filtering: By `status`, `agent_id`, `date range`

- **Update Lead Status**
  - Endpoint: `PATCH /api/leads/:id`
  - Status Transitions:
    - `New` → `Assigned`, `Contacted`
    - `Contacted` → `Preparing Documents`
    - `Preparing Documents` → `Submitted`
    - `Submitted` → `Approved`, `Declined`, `KIV`
    - `KIV` ↔ `Submitted`
    - `Approved` ↔ `Declined`
  - Role Required:
    - Agent: Transitions for assigned leads.
    - Admin: All transitions and reassignment.

- **Reassign Lead**
  - Admin can reassign a lead if no action is taken within 3 days.

### **4. Notifications (Planned)**
- Automated notifications for agents and referrers when:
  - New leads are assigned.
  - Leads remain uncontacted for 3 days.

---

## **How to Test the API**

### **1. Setup**
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Setup the `.env` file with the following variables:
   ```
   DATABASE_URL=<Your PostgreSQL Connection String>
   PORT=5000
   JWT_SECRET=<Your Secret Key>
   ```
4. Start the server:
   ```
   npm run dev
   ```

### **2. Authentication**
All requests must include an Authorization header:
```
Authorization: Bearer <your-test-token>
```

Use the following test tokens based on role:
- **Admin:** `Bearer admin-token`
- **Agent:** `Bearer agent-token`
- **Referrer:** `Bearer referrer-token`

### **3. Testing Endpoints**

#### **Agent Management**
1. **Register Agent**
   ```
   POST /api/agents/register
   {
     "name": "John Agent",
     "phone": "01122334455",
     "email": "john.agent@example.com",
     "location": "Kuala Lumpur"
   }
   ```

2. **Approve Agent**
   ```
   PATCH /api/agents/:id/approval
   {
     "status": "Active"
   }
   ```

3. **Update Agent**
   ```
   PATCH /api/agents/:id
   {
     "bank_name": "Public Bank",
     "account_number": "1234567890"
   }
   ```

#### **Referrer Management**
1. **Register Referrer**
   ```
   POST /api/agents/register-referrer
   {
     "name": "Jane Referrer",
     "phone": "01233445566",
     "email": "jane.referrer@example.com",
     "linked_agent_id": "<agent-id>"
   }
   ```

#### **Lead Management**
1. **Create Lead**
   ```
   POST /api/leads
   {
     "name": "Test Lead",
     "phone": "0123456789",
     "loan_amount": 100000,
     "estimated_savings": 5000,
     "referral_code": "REF-XXXXXXX"
   }
   ```

2. **Update Lead Status**
   ```
   PATCH /api/leads/:id
   {
     "status": "Preparing Documents"
   }
   ```

3. **Get All Leads**
   ```
   GET /api/leads?status=New&agent_id=<agent-id>&page=1&limit=10
   ```

---

## **Future Plans**

### **Phase 3: Portal Development**
- Web-based portal for:
  - Agent and referrer management.
  - Lead tracking and status updates.
  - Role-based dashboards.

### **Phase 4: Automation**
- Automated lead reassignment.
- Integration with external APIs (e.g., WhatsApp for notifications).
- Analytics and reporting.

---

## **Contributing**
1. Fork the repository.
2. Create a feature branch.
3. Commit your changes and create a pull request.

---

## **License**
This project is licensed under the MIT License.

