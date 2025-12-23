# SNFalyze Local Development Environment

A local copy of the SNFalyze AI platform for exploration and development.

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Seed the Database

This creates the SQLite database with sample data:

```bash
npm run seed
```

You'll see test accounts created:
```
Admin:        admin@snfalyze.com / password123
Deal Manager: sarah@snfalyze.com / password123
Analyst:      michael@snfalyze.com / password123
Reviewer:     emily@snfalyze.com / password123
```

### 3. Start the Backend

```bash
npm start
```

Backend runs on http://localhost:5001

### 4. Install Frontend Dependencies (new terminal)

```bash
cd frontend
npm install --legacy-peer-deps
```

> Note: `--legacy-peer-deps` is needed due to React 19 compatibility with some packages.

### 5. Start the Frontend

```bash
npm start
```

Frontend runs on http://localhost:3000

---

## Project Structure

```
snfalyze-local/
├── backend/
│   ├── app_snfalyze.js      # Main Express server
│   ├── seed.js              # Database seeder
│   ├── database.sqlite      # SQLite database (created after seed)
│   ├── config/
│   │   ├── helper.js        # Utility functions
│   │   └── sendMail.js      # Email service (Brevo)
│   ├── controller/
│   │   ├── AuthenticationController.js
│   │   ├── DealController.js
│   │   └── stateController.js
│   ├── models/              # Sequelize models
│   │   ├── users.js
│   │   ├── deals.js
│   │   ├── master_deals.js
│   │   ├── deal_comments.js
│   │   ├── deal_documents.js
│   │   ├── deal_team_members.js
│   │   ├── deal_external_advisors.js
│   │   ├── user_notifications.js
│   │   ├── recent_activity.js
│   │   ├── comment_mentions.js
│   │   └── state.js
│   ├── routes/
│   │   ├── authentication.js
│   │   ├── deal.js
│   │   └── stateRouter.js
│   └── passport/            # JWT auth config
│
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main router
│   │   ├── api/             # API service layer
│   │   ├── components/      # Reusable components
│   │   ├── context/         # Auth context
│   │   ├── pages/           # Route pages
│   │   ├── services/        # Business logic (SNF Algorithm)
│   │   └── styles/          # CSS
│   └── public/
│
└── README.md
```

---

## Database Schema

### Users
- `id`, `role`, `first_name`, `last_name`, `email`, `password`
- `phone_number`, `department`, `status`, `profile_url`
- Roles: `admin`, `deal_manager`, `analyst`, `reviewer`, `user`

### Deals
Core deal info:
- `deal_name`, `deal_type`, `deal_status`, `priority_level`
- `facility_name`, `facility_type`, `no_of_beds`
- Location: `street_address`, `city`, `state`, `zip_code`

Financial metrics:
- `purchase_price`, `annual_revenue`, `ebitda`, `ebitda_margin`
- `price_per_bed`, `current_occupancy`
- `medicare_percentage`, `private_pay_percentage`

Team:
- `deal_lead_id`, `assistant_deal_lead_id`
- `user_id` (creator)

Status workflow: `pipeline` → `due_diligence` → `final_review` → `closed`

### Master Deals
Parent container for multi-property deals:
- `unique_id`, `user_id`
- Address fields

### Deal Team Members / External Advisors
Junction tables: `deal_id`, `user_id`

### Deal Comments
Threaded comments: `deal_id`, `user_id`, `comment`, `parent_id`

### Deal Documents
File references: `deal_id`, `document_url`, `document_name`

---

## API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login with email/password |
| POST | `/sign-up` | Register new user |
| GET | `/get-my-detail` | Get current user (auth required) |
| POST | `/create-user` | Create user (admin) |
| GET | `/get-users` | List users (paginated) |
| DELETE | `/delete-user/:id` | Deactivate user |
| POST | `/file-upload` | Upload file to S3 |

### Deals (`/api/v1/deal`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-deals` | Create deal(s) |
| GET | `/get-deals` | List deals (paginated, filtered) |
| GET | `/get-deal-by-id` | Get deal details |
| POST | `/update-deal` | Update deal |
| PUT | `/update-deal-status` | Update status only |
| DELETE | `/delete-deal/:id` | Delete deal |
| GET | `/get-deal-stats` | Deal statistics |
| GET | `/get-dashboard-data` | Dashboard metrics |
| POST | `/add-deal-comment` | Add comment |
| GET | `/get-deal-comments` | Get comments (threaded) |
| POST | `/add-deal-document` | Add document |
| GET | `/master-deals` | List master deals |

---

## Key Files to Explore

### Backend

**Controllers (business logic):**
- `controller/DealController.js` - 2000+ lines, all deal operations
- `controller/AuthenticationController.js` - User management

**Models (database structure):**
- `models/deals.js` - 40+ fields for deal data
- `models/users.js` - User schema with roles

**Config:**
- `config/helper.js` - Validation, response formatting
- `passport/index.js` - JWT authentication

### Frontend

**Pages:**
- `pages/Dashboard.jsx` - Main dashboard with kanban
- `pages/Deals.jsx` - Deal list view
- `pages/DealDetail.jsx` - Single deal view
- `pages/CombinedDealForm.jsx` - Multi-step deal creation
- `pages/ChatInterfaceAI.jsx` - AI assistant chat

**API Layer:**
- `api/apiService.js` - Axios setup with interceptors
- `api/apiRoutes.js` - All endpoint definitions
- `api/DealService.js` - Deal API calls

**Components:**
- `components/common/Layout.jsx` - App wrapper
- `components/common/Sidebar.jsx` - Navigation
- `components/ui/GoogleMap.jsx` - Maps integration

**Services:**
- `services/snfAlgorithm/snfEvaluator.js` - SNF deal evaluation algorithm

---

## Sample Data Included

After running `npm run seed`, you get:

**Users:** 5 (1 admin, 1 deal manager, 2 analysts, 1 reviewer)

**Deals:** 6 deals across different statuses
- Pipeline: Evergreen Senior Care, Rose City Memory Care, Treasure Valley
- Due Diligence: Pacific Northwest Rehab
- Final Review: Columbia Valley SNF
- Closed: Mountain View Care Home

**Comments:** 8 threaded comments across deals

**Team Assignments:** 10 team member assignments

---

## Making Changes

### Reset Database
Delete `backend/database.sqlite` and run `npm run seed` again.

### Add More Seed Data
Edit `backend/seed.js` and re-run seed.

### Change Port
- Backend: Edit `backend/.env` → `APP_PORT`
- Frontend: Edit `frontend/.env` → `REACT_APP_API_BASE_URL`

---

## Optional Features

### Google Maps
Add your API key to `frontend/.env`:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your-key
```

### AI Chat (Gemini)
Add your API key to `frontend/.env`:
```
REACT_APP_GEMINI_API_KEY=your-key
```

### File Uploads (S3)
Add AWS credentials to `backend/.env`:
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket
```

---

## Production Databases (Render)

In production, the app uses PostgreSQL on Render with a two-database architecture:

- **Main DB** (`snfalyze_db`) - App data: users, deals, documents, historical snapshots
- **Market DB** (`snf_market_data`) - Shared reference data for multiple projects

See **[backend/scripts/README.md](backend/scripts/README.md)** for:
- Why two databases exist
- Database architecture diagram
- Sync commands and workflows
- Troubleshooting production database issues

---

## Database Migrations (IMPORTANT!)

When you change database schema (add/remove columns, create tables), you need **both**:
1. Update the Sequelize model file (`backend/models/`)
2. Create a migration file (`backend/migrations/`)

### Why?
- **Code** (models, routes) deploys via GitHub → Render
- **Database schema** requires explicit SQL commands
- Migrations run automatically on app startup

### Quick Example
Adding a new column? Create `backend/migrations/20241223-add-my-column.js`:

```javascript
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('my_table', 'my_column', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  }
};
```

### Automatic Reminder
The pre-commit hook will warn you when model files change without a migration.

See **[backend/DATABASE_MIGRATIONS.md](backend/DATABASE_MIGRATIONS.md)** for the full guide.

---

## Troubleshooting

**"Cannot find module 'sqlite3'"**
```bash
cd backend && npm install sqlite3 --save
```

**"Port 5001 already in use"**
```bash
lsof -ti:5001 | xargs kill -9
```

**"CORS error"**
Make sure backend is running and frontend `.env` has correct API URL.

**Database errors after model changes**
Delete `database.sqlite` and re-run seed.
