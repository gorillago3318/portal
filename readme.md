# WhatsApp Bot Portal

## Overview
This project is a backend portal for managing leads and agents, integrated with a WhatsApp chatbot for processing loan inquiries. The portal facilitates CRUD operations on agents and leads, supports agent assignments, lead status transitions, and more. It is designed with scalability in mind and follows a structured development plan divided into four phases.

## Development Phases

### Phase 1: Core Functionality
**Objective**: Establish the foundational backend structure for managing leads and agents.

**Features**:
- **CRUD operations for Agents**:
  - Create an agent with unique phone validation
  - View all agents
  - Update agent details
  - Soft delete agents with support for reassignments

- **CRUD operations for Leads**:
  - Create a lead with optional agent assignment
  - View all leads with filters (e.g., status, assigned agent, date ranges)
  - Update lead details and status transitions with validations
  - Support for agent reassignments

- **Database setup**:
  - Leads table with associations to Agents
  - Hooks for auto-generating unique_id in leads
  - Enum-based lead status transitions
  - Error handling for invalid operations
  - Logging for API operations and debugging
  - Health-check endpoint to verify database connectivity

### Phase 2: WhatsApp Chatbot Integration
**Objective**: Integrate WhatsApp chatbot functionality to handle user interactions and route queries to the backend.

**Features**:
- Connect WhatsApp bot to the backend using the WhatsApp Web.js library
- Handle user queries for:
  - Loan assessments
  - Existing lead status inquiries
  - New lead creation via chatbot inputs
- Ensure smooth API interaction between the chatbot and backend

### Phase 3: Enhanced User Interaction
**Objective**: Improve the usability and engagement of the portal and bot.

**Features**:
- **Notifications**:
  - Email/SMS notifications for lead updates and agent assignments
  - WhatsApp message alerts for specific events (e.g., lead approval)

- **Advanced filtering and reporting**:
  - Generate reports on lead conversions, agent performance, etc.
  - Support for exportable formats (e.g., CSV)

- **Admin dashboard**:
  - Web-based interface for managing agents and leads
  - Visualization of data (e.g., charts for loan statuses, agent performance)

### Phase 4: AI & Analytics Integration
**Objective**: Leverage AI and analytics to provide insights and automate tasks.

**Features**:
- AI-driven lead scoring based on data patterns
- Predictive analytics for loan approvals and estimated savings
- Automated response generation for common user queries
- Chatbot enhancements using AI models (e.g., OpenAI GPT) for a conversational experience

## Technology Stack
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL (Sequelize ORM)
- **Messaging**: WhatsApp Web.js
- **Dev Tools**: Postman, pgAdmin, Git
- **Deployment**: [Your chosen hosting platform]

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up the .env file**:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   PORT=5000
   NODE_ENV=development
   ```

4. **Run the application**:
   ```bash
   npm start
   ```

5. **Access the API**:
   - Health-check: `GET /health`
   - Leads: `GET /api/leads`
   - Agents: `GET /api/agents`

## Future Enhancements
Additional features and refinements will be implemented in subsequent phases as outlined above.