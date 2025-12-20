# Jira Sprint Analyzer

A web-based sprint analysis and planning tool that helps teams understand their velocity, quality metrics, and strategic alignment.

## Issue Tracking

**GitHub Issues is the source of truth** for all bugs, feature requests, and outstanding work.

- View open issues: https://github.com/tommertron/sprintAnalyzer/issues
- Before starting work, check for existing issues
- Create new issues for bugs or feature requests discovered during development
- Reference issue numbers in commit messages (e.g., "Fix #12: handle empty sprint data")

## Project Architecture

```
sprintAnalyzer/
├── backend/                    # Flask API server
│   ├── app/
│   │   ├── __init__.py        # Flask factory (create_app)
│   │   ├── routes.py          # Page routes
│   │   └── api/               # REST API blueprints
│   │       ├── auth.py        # Token validation
│   │       ├── boards.py      # Board/sprint endpoints
│   │       └── metrics.py     # Sprint metrics endpoints
│   ├── services/
│   │   └── sprint_metrics.py  # Metric calculation logic
│   ├── config/
│   │   └── teams-config.json  # Whitelisted teams (gitignored)
│   ├── requirements.txt
│   └── run.py                 # Dev server entrypoint
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route pages (Login, Dashboard)
│   │   ├── services/api.js    # API client
│   │   └── App.jsx
│   └── vite.config.js
└── jira-sprint-analyzer-spec.md  # Full requirements spec
```

## Running Locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python run.py
```
Backend runs on http://localhost:5001

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5173 (proxies API to backend)

## Key Dependencies

### Backend
- **atlassian-helper**: Jira API integration (from /coding/atlassian-helper)
- **Flask**: Web framework
- **flask-cors**: Cross-origin requests for frontend

### Frontend
- **React**: UI framework
- **Vite**: Build tooling
- **Recharts**: Chart visualizations
- **Axios**: HTTP client

## API Endpoints

### Authentication
- `POST /api/auth/validate` - Validate Jira token, returns user info

### Boards
- `GET /api/boards` - List accessible boards (requires `X-Jira-Token` header)
- `GET /api/boards/<id>/sprints` - Get last 6 completed sprints

### Metrics
All metrics endpoints require `X-Jira-Token` header and accept optional `initiative_boards` query param.

- `GET /api/metrics/<board_id>/velocity` - Velocity for last 6 sprints
- `GET /api/metrics/<board_id>/completion` - Completion rates, mid-sprint additions
- `GET /api/metrics/<board_id>/quality` - Bug ratio, ticket age, incomplete %
- `GET /api/metrics/<board_id>/alignment` - Initiative-linked work %
- `GET /api/metrics/<board_id>/coverage` - Story point coverage stats
- `GET /api/metrics/<board_id>/summary` - Combined dashboard data

## Jira Integration

Uses the `atlassian-helper` library for all Jira operations. Key patterns:

```python
from atlassian_helper import JiraHelper

# Create helper with user's credentials (per-request)
helper = JiraHelper(
    server=jira_server,
    email=user_email,
    api_token=user_token
)

# Get sprints for a board
sprints = helper.list_sprints(board_id, state='closed')

# Get issues in a sprint
issues = helper.get_sprint_issues(sprint_id)
```

Reference implementation: `/coding/jiraPerformance/app/api/burndown.py`

## Coding Conventions

### Backend (Python/Flask)
- Use Flask app factory pattern (`create_app()`)
- Organize routes in blueprints under `app/api/`
- Business logic in `services/` modules
- Type hints for function signatures
- Return JSON responses with consistent structure: `{"data": ..., "error": ...}`

### Frontend (React)
- Functional components with hooks
- API calls in `services/api.js`
- Custom hooks in `hooks/` for data fetching
- Components should be self-contained with clear props

## Environment Variables

Backend expects (or uses atlassian-helper config fallback):
- `JIRA_SERVER` - Jira instance URL
- `FLASK_ENV` - development/production

Frontend uses `.env` for:
- `VITE_API_URL` - Backend API URL (defaults to /api in dev proxy)

## Whitelisted Teams

Teams eligible for vacation/capacity features are configured in `backend/config/teams-config.json`:

```json
{
  "teams": [
    {"boardId": "123", "name": "Platform Team"},
    {"boardId": "456", "name": "Mobile Team"}
  ]
}
```

Copy from `teams-config.example.json` and configure for your org.

## Future: BambooHR Integration

BambooHR integration for vacation/capacity planning is planned for Phase 2. Will add:
- `backend/app/api/bamboo.py` - Time-off endpoints
- `backend/services/bamboo_client.py` - BambooHR API client
- Employee-to-Jira user matching logic
