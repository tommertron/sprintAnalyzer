# Jira Sprint Analyzer

A web-based sprint analysis and planning tool that helps agile teams understand their velocity, quality metrics, strategic alignment, and capacity planning with BambooHR integration.

## Features

- **Sprint Metrics Dashboard** - Track velocity trends, completion rates, and quality metrics across sprints
- **Strategic Alignment** - See how much work is linked to initiatives vs. orphan work
- **Sprint Planning** - Analyze upcoming sprints with projected velocity based on team capacity
- **Capacity Planning** - Integrate with BambooHR to factor in vacations and holidays
- **Team Member Management** - Select team members and see their upcoming time off

## Quick Start

### One-Command Setup (Recommended)

The easiest way to get started is with the startup script. It will automatically:
- Install Homebrew (macOS) if needed
- Install Python 3 and Node.js if needed
- Set up the Python virtual environment
- Install all dependencies
- Start both backend and frontend servers

```bash
git clone https://github.com/tommertron/sprintAnalyzer.git
cd sprintAnalyzer
./start.sh
```

Then open http://localhost:5173 in your browser.

### Manual Installation

If you prefer to set things up manually:

#### Prerequisites

- Python 3.8+
- Node.js 16+
- A Jira Cloud instance with API access
- (Optional) BambooHR account for capacity planning

#### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/tommertron/sprintAnalyzer.git
   cd sprintAnalyzer
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Start the application**

   In one terminal (backend):
   ```bash
   cd backend
   source venv/bin/activate
   python run.py
   ```

   In another terminal (frontend):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open the app**

   Navigate to http://localhost:5173

## Authentication

### Jira Authentication

The app requires a Jira API token to access your sprint data. Your credentials are sent with each request and are not stored on the server.

#### Getting Your Jira API Token

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a label (e.g., "Sprint Analyzer")
4. Copy the generated token

#### Logging In

On the login screen, enter:

| Field | Value |
|-------|-------|
| **Jira Server** | Your Jira Cloud URL (e.g., `https://yourcompany.atlassian.net`) |
| **Email** | Your Atlassian account email |
| **API Token** | The token you generated above |

### BambooHR Authentication (Optional)

BambooHR integration enables capacity planning features like viewing team vacations and projecting sprint velocity based on available capacity.

#### Getting Your BambooHR API Key

1. Log in to BambooHR
2. Click your profile picture in the top right
3. Go to **API Keys** (or navigate to `https://yourcompany.bamboohr.com/settings/permissions/api`)
4. Click **Add New Key**
5. Give it a name (e.g., "Sprint Analyzer")
6. Copy the generated API key

#### Connecting BambooHR

1. In the Sprint Analyzer, go to the **Capacity** tab
2. Enter your BambooHR credentials:
   - **API Key**: The key you generated above
   - **Subdomain**: Your company's BambooHR subdomain (the part before `.bamboohr.com` in your URL)
3. Click **Connect**

Your BambooHR credentials are stored locally in your browser and sent with requests to fetch time-off data.

## Using the App

### Metrics Tab

View historical sprint metrics for your team:

- **Velocity Trend** - Story points completed per sprint
- **Completion Rate** - Percentage of committed work completed
- **Quality Metrics** - Bug ratio, incomplete work, ticket age
- **Strategic Alignment** - Work linked to initiatives vs. orphan work

Use the date range selector to analyze different time periods.

### Planning Tab

Analyze upcoming or active sprints:

1. Select a sprint from the dropdown
2. View total points planned vs. projected velocity
3. See capacity impact from team vacations and holidays
4. Identify stories missing point estimates

### Capacity Tab

Configure your team for capacity planning:

1. **Connect BambooHR** - Enter your API credentials
2. **Select Team Members** - Choose who to include in capacity calculations
3. **Add Members** - Search for additional Jira users to add to your team
4. **View Upcoming Time Off** - See scheduled vacations and company holidays

## Troubleshooting

### "Failed to validate credentials"
- Verify your Jira server URL includes `https://`
- Ensure your API token is correct (regenerate if needed)
- Check that your email matches your Atlassian account

### "No boards found"
- Your Jira account may not have access to any Scrum/Kanban boards
- Check your Jira permissions

### BambooHR not showing time off
- Verify your API key has read access to time-off data
- Ensure team members have matching email addresses in both Jira and BambooHR

### Dates showing wrong day
- This is a timezone issue that has been fixed. If you see it, try refreshing.

## Development

See [CLAUDE.md](./CLAUDE.md) for development documentation including:
- Project architecture
- API endpoints
- Coding conventions
- Environment variables

## License

MIT
