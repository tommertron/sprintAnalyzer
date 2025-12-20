# Jira Sprint Analyzer

A web-based sprint analysis and planning tool that helps teams understand their velocity, quality metrics, and strategic alignment. Users authenticate with their own Jira API credentials to access data scoped to their permissions.

---

## Core Features

### 1. Authentication & Access Control

- **User Authentication:** Users paste their Jira API token to authenticate
- **Team Detection:** App reads which boards/teams the user has access to via Jira API
- **Whitelisted Teams:** Maintain a JSON config of "official" teams eligible for vacation data
  - Users on whitelisted teams get full features (sprint analysis + vacation forecasting)
  - Users on non-whitelisted boards get basic sprint analysis only
- **Privacy:** No user account system needed—authentication via Jira API token stored in browser localStorage/sessionStorage

### 2. Board Configuration

Users specify:

- **Team Board:** The sprint board to analyze (selected from boards they have access to)
- **Initiative Boards:** One or more boards where initiatives/epics are tracked
- **Bamboo Integration:** (Optional for whitelisted teams) Pulls vacation/time-off data

### 3. Sprint Metrics (Last 6 Sprints)

#### Velocity Metrics

| Metric | Description |
|--------|-------------|
| Completed Story Points | Total points completed in each of the last 6 sprints |
| Average Velocity | Mean story points across last 6 sprints |
| Per-Sprint Breakdown | Visual display of velocity trends |

#### Completion & Scope Metrics

| Metric | Description |
|--------|-------------|
| Completion Rate | % of committed stories actually completed per sprint |
| Mid-Sprint Additions | Total points added after sprint started (compare sprint start date to when issue was added via changelog) |

#### Quality & Age Metrics

| Metric | Description |
|--------|-------------|
| Percentage Incomplete | % of stories not completed per sprint |
| Average Age of Completed Tickets | Calculated from issue `created` date to `resolutiondate`, averaged per sprint. Shows cycle time / how long work sits before completion. |
| Bug Ratio | Count and % of bugs (issue type = Bug) completed per sprint |

#### Strategic Alignment

| Metric | Description |
|--------|-------------|
| Initiative-Linked Work | % of completed stories that roll up to epics on initiative boards (Story → Epic link → Check if epic exists on any specified initiative board) |
| Non-Initiative Work | % of ad-hoc/orphan stories not linked to strategic initiatives |

#### Story Point Coverage

| Metric | Description |
|--------|-------------|
| Stories Missing Points | Count and % of stories without story point values |
| Fallback Average | Calculate average story points from last 6 sprints within the Jira space. Apply this average to stories missing points for velocity calculations. Flag these stories in the metrics. |

### 4. Vacation & Capacity Planning

#### Data Sources

**BambooHR Integration:**

- Use server-side API key to fetch time-off data
- Company-wide holidays: visible to all users
- Individual PTO: only shown for whitelisted teams, filtered to team members

#### Capacity Adjustment

- **Holiday Impact:** Adjust velocity forecast for company holidays (all users)
- **PTO Impact:** Adjust for team member vacation days (whitelisted teams only)

**Calculation Example:**

```
5-person team, 2-week sprint = 50 person-days
If 10 person-days are PTO = 20% reduction
Adjusted velocity = average velocity × 0.8
```

---

## Data Scope & Calculations

### Jira Space Context

- All calculations (averages, trends) scoped to the Jira space being analyzed
- Story point averages calculated from last 6 sprints within that space
- Ensures consistent pointing philosophy within team context

### Sprint Completion Logic

- **Only track issues completed during the sprint** (not carried over)
- **Committed:** In sprint at start
- **Completed:** Resolved during sprint
- **Mid-sprint additions:** Added after sprint start, completed in sprint

### Initiative Mapping

```
Story → Epic (via epic link field)
     → Initiative board (check if epic exists on any specified initiative board)
```

> Note: Cannot span multiple boards (one parent per epic)

---

## Technical Architecture

### Frontend

- Single-page web application
- User selects board to analyze from dropdown (populated from their Jira access)
- User selects initiative board(s) for strategic alignment tracking
- Stores Jira API token in browser storage (localStorage or sessionStorage)
- Displays metrics as charts/graphs and tables

### Backend (Optional/Lightweight)

- Fetch BambooHR data using server-side API key
- Filter time-off data based on team membership
- Serve vacation data to frontend for whitelisted teams only

### Deployment

**Platform:** Google Cloud Platform (GCP)

| Option | Use Case |
|--------|----------|
| Cloud Run | Containerized backend API |
| App Engine | Full-stack app |
| Cloud Storage + Cloud Functions | Static frontend + serverless API |

### Configuration Files

**Whitelisted Teams** (`teams-config.json`):

```json
{
  "teams": [
    {
      "boardId": "123",
      "name": "Platform Team"
    },
    {
      "boardId": "456",
      "name": "Mobile Team"
    }
  ]
}
```

---

## API Data Requirements

### Jira API

| Data | Purpose |
|------|---------|
| Sprint history | Last 6 completed sprints |
| Issues per sprint | All issues completed in each sprint |
| Issue changelog | Track when issues were added to sprints |
| Board/project metadata | Determine team membership |
| Epic data | From initiative boards to map strategic alignment |

**Issue fields needed:**

- Story points (`customfield_xxxxx` — varies by Jira instance)
- Issue type (Story, Bug, etc.)
- Epic link
- Created date
- Resolution date
- Sprint assignment

### BambooHR API

| Data | Visibility |
|------|------------|
| Company holidays | All users |
| Individual time-off requests | Whitelisted teams only |

**Time-off data includes:**

- Approved PTO/vacation
- Employee name/ID (to match with Jira users)
- Start and end dates

---

## User Experience Flow

1. **Login** — User pastes Jira API token
2. **Board Selection** — Choose team board to analyze from accessible boards
3. **Initiative Boards** — Select one or more initiative boards for alignment tracking
4. **Metrics Display**
   - Velocity trends (last 6 sprints)
   - Quality metrics (bugs, completion rate, ticket age)
   - Strategic alignment (initiative-linked vs. orphan work)
   - Story point coverage (% missing points)
5. **Capacity Planning** (whitelisted teams only)
   - See upcoming company holidays
   - See team member PTO
   - Get adjusted velocity forecast for next sprint

---

## Open Questions

| Topic | Question |
|-------|----------|
| Sprint changelog API | Confirm Jira API reliably provides timestamp for when issues were added to sprints |
| Story point custom field | Need to identify the correct custom field ID for story points in target Jira instance |
| BambooHR employee matching | Strategy for matching BambooHR employees to Jira users (email? name? employee ID?) |
| UI framework | What frontend framework to use (React, Vue, vanilla JS?) |
| Backend framework | If needed, what to use (Express, Flask, simple static file server?) |
| GCP deployment specifics | Which GCP services to use (Cloud Run, App Engine, Functions?) |
