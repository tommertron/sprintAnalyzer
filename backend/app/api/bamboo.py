"""BambooHR time-off and capacity planning endpoints.

Uses user-provided credentials via headers (similar to Jira auth).
"""

from flask import Blueprint, request, jsonify
from services import bamboo_client
from services.atlassian_teams import get_team_member_emails, get_user_teams

bp = Blueprint("bamboo", __name__, url_prefix="/api/bamboo")


def get_bamboo_credentials():
    """Extract BambooHR credentials from request headers."""
    token = request.headers.get("X-Bamboo-Token")
    subdomain = request.headers.get("X-Bamboo-Subdomain")
    return token, subdomain


def get_jira_credentials():
    """Extract Jira credentials from request headers (for Atlassian Teams API)."""
    server = request.headers.get("X-Jira-Server", "").rstrip("/")
    email = request.headers.get("X-Jira-Email")
    token = request.headers.get("X-Jira-Token")
    return server, email, token


@bp.route("/search-users", methods=["GET"])
def search_jira_users():
    """Search for Jira users by name or email.

    Headers:
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: Jira credentials

    Query params:
        - query: Search string (required, min 2 chars)

    Returns:
        - List of matching users with accountId, displayName, email, avatarUrl
    """
    import requests as req

    jira_server, jira_email, jira_token = get_jira_credentials()

    if not jira_server or not jira_email or not jira_token:
        return jsonify({
            "error": "Missing Jira credentials",
            "data": {"users": []}
        }), 401

    query = request.args.get("query", "").strip()
    if len(query) < 2:
        return jsonify({
            "error": "Query must be at least 2 characters",
            "data": {"users": []}
        }), 400

    try:
        # Use Jira user search API
        response = req.get(
            f"{jira_server}/rest/api/3/user/search",
            auth=(jira_email, jira_token),
            headers={"Accept": "application/json"},
            params={"query": query, "maxResults": 20},
            timeout=30
        )

        if response.status_code != 200:
            return jsonify({
                "error": f"Jira API error: {response.status_code}",
                "data": {"users": []}
            }), 500

        users = response.json()

        # Format response - filter out inactive/former users
        formatted_users = []
        for user in users:
            display_name = user.get("displayName", "")
            # Skip former/inactive users
            if "former user" in display_name.lower():
                continue
            if not user.get("active", True):
                continue

            formatted_users.append({
                "accountId": user.get("accountId"),
                "displayName": display_name,
                "email": user.get("emailAddress"),
                "avatarUrl": user.get("avatarUrls", {}).get("48x48")
            })

        return jsonify({"data": {"users": formatted_users}})

    except Exception as e:
        return jsonify({
            "error": f"Failed to search users: {str(e)}",
            "data": {"users": []}
        }), 500


@bp.route("/holidays", methods=["GET"])
def get_holidays():
    """Get company-wide holidays.

    Headers:
        - X-Bamboo-Token: User's BambooHR API key
        - X-Bamboo-Subdomain: Company subdomain

    Query params:
        - start_date: Start of date range (YYYY-MM-DD)
        - end_date: End of date range (YYYY-MM-DD)

    Note: Holidays are visible to all authenticated users.
    """
    token, subdomain = get_bamboo_credentials()

    if not token or not subdomain:
        return jsonify({
            "error": "Missing BambooHR credentials. Provide X-Bamboo-Token and X-Bamboo-Subdomain headers.",
            "data": {"holidays": [], "configured": False}
        }), 401

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    holidays = bamboo_client.get_company_holidays(token, subdomain, start_date, end_date)

    return jsonify({"data": {"holidays": holidays, "configured": True}})


@bp.route("/teams", methods=["GET"])
def list_teams():
    """List Atlassian Teams the user has access to.

    Headers:
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: Jira credentials

    Returns:
        - List of teams with id, name, description
    """
    jira_server, jira_email, jira_token = get_jira_credentials()

    if not jira_server or not jira_email or not jira_token:
        return jsonify({
            "error": "Missing Jira credentials",
            "data": {"teams": []}
        }), 401

    teams = get_user_teams(jira_server, jira_email, jira_token)

    return jsonify({"data": {"teams": teams}})


@bp.route("/project-members/<int:board_id>", methods=["GET"])
def get_project_members(board_id):
    """Get users who have worked on issues in recent sprints.

    Headers:
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: Jira credentials

    Returns:
        - List of unique users (assignees/reporters) from recent sprints
    """
    import requests as req

    jira_server, jira_email, jira_token = get_jira_credentials()

    if not jira_server or not jira_email or not jira_token:
        return jsonify({
            "error": "Missing Jira credentials",
            "data": {"members": []}
        }), 401

    members = {}

    try:
        # Get recent sprints for this board
        sprints_resp = req.get(
            f"{jira_server}/rest/agile/1.0/board/{board_id}/sprint",
            auth=(jira_email, jira_token),
            headers={"Accept": "application/json"},
            params={"state": "active,closed", "maxResults": 6},
            timeout=30
        )

        if sprints_resp.status_code != 200:
            return jsonify({
                "error": f"Failed to get sprints: {sprints_resp.status_code}",
                "data": {"members": []}
            }), 500

        sprints = sprints_resp.json().get("values", [])

        # Get issues from each sprint to find assignees
        for sprint in sprints[:6]:  # Last 6 sprints to catch more team members
            sprint_id = sprint["id"]
            issues_resp = req.get(
                f"{jira_server}/rest/agile/1.0/sprint/{sprint_id}/issue",
                auth=(jira_email, jira_token),
                headers={"Accept": "application/json"},
                params={"maxResults": 200, "fields": "assignee,reporter"},
                timeout=30
            )

            if issues_resp.status_code == 200:
                issues = issues_resp.json().get("issues", [])
                for issue in issues:
                    fields = issue.get("fields", {})

                    # Get assignee
                    assignee = fields.get("assignee")
                    if assignee and assignee.get("accountId"):
                        aid = assignee["accountId"]
                        if aid not in members:
                            members[aid] = {
                                "accountId": aid,
                                "displayName": assignee.get("displayName", "Unknown"),
                                "email": assignee.get("emailAddress"),
                                "avatarUrl": assignee.get("avatarUrls", {}).get("48x48")
                            }

                    # Get reporter
                    reporter = fields.get("reporter")
                    if reporter and reporter.get("accountId"):
                        rid = reporter["accountId"]
                        if rid not in members:
                            members[rid] = {
                                "accountId": rid,
                                "displayName": reporter.get("displayName", "Unknown"),
                                "email": reporter.get("emailAddress"),
                                "avatarUrl": reporter.get("avatarUrls", {}).get("48x48")
                            }

        # Also check backlog issues (not in any sprint) to catch more team members
        try:
            backlog_resp = req.get(
                f"{jira_server}/rest/agile/1.0/board/{board_id}/backlog",
                auth=(jira_email, jira_token),
                headers={"Accept": "application/json"},
                params={"maxResults": 100, "fields": "assignee,reporter"},
                timeout=30
            )
            if backlog_resp.status_code == 200:
                backlog_issues = backlog_resp.json().get("issues", [])
                for issue in backlog_issues:
                    fields = issue.get("fields", {})
                    for user_field in ["assignee", "reporter"]:
                        user = fields.get(user_field)
                        if user and user.get("accountId"):
                            uid = user["accountId"]
                            if uid not in members:
                                members[uid] = {
                                    "accountId": uid,
                                    "displayName": user.get("displayName", "Unknown"),
                                    "email": user.get("emailAddress"),
                                    "avatarUrl": user.get("avatarUrls", {}).get("48x48")
                                }
        except Exception:
            pass  # Backlog check is optional, don't fail if it errors

        # Sort by display name
        member_list = sorted(members.values(), key=lambda x: x["displayName"].lower())

        return jsonify({"data": {"members": member_list}})

    except Exception as e:
        return jsonify({
            "error": f"Failed to get project members: {str(e)}",
            "data": {"members": []}
        }), 500


@bp.route("/teams/debug", methods=["GET"])
def debug_teams():
    """Debug endpoint to test various team API endpoints."""
    import requests as req

    jira_server, jira_email, jira_token = get_jira_credentials()

    if not jira_server or not jira_email or not jira_token:
        return jsonify({"error": "Missing Jira credentials"}), 401

    results = {}

    # Test tenant info
    try:
        url = f"{jira_server}/_edge/tenant_info"
        resp = req.get(url, timeout=10)
        results["tenant_info"] = {
            "status": resp.status_code,
            "data": resp.json() if resp.status_code == 200 else resp.text[:200]
        }
    except Exception as e:
        results["tenant_info"] = {"error": str(e)}

    # Test gateway teams API
    try:
        url = f"{jira_server}/gateway/api/public/teams/v1/org/teams"
        resp = req.get(url, auth=(jira_email, jira_token),
                       headers={"Accept": "application/json"}, timeout=10)
        results["gateway_teams"] = {
            "status": resp.status_code,
            "data": resp.json() if resp.status_code == 200 else resp.text[:500]
        }
    except Exception as e:
        results["gateway_teams"] = {"error": str(e)}

    # Test Jira teams REST API
    try:
        url = f"{jira_server}/rest/teams/1.0/teams"
        resp = req.get(url, auth=(jira_email, jira_token),
                       headers={"Accept": "application/json"}, timeout=10)
        results["jira_teams"] = {
            "status": resp.status_code,
            "data": resp.json() if resp.status_code == 200 else resp.text[:500]
        }
    except Exception as e:
        results["jira_teams"] = {"error": str(e)}

    # Test teams find
    try:
        url = f"{jira_server}/rest/teams/1.0/teams/find"
        resp = req.get(url, auth=(jira_email, jira_token),
                       headers={"Accept": "application/json"}, timeout=10)
        results["jira_teams_find"] = {
            "status": resp.status_code,
            "data": resp.json() if resp.status_code == 200 else resp.text[:500]
        }
    except Exception as e:
        results["jira_teams_find"] = {"error": str(e)}

    return jsonify({"debug": results})


@bp.route("/time-off/<int:board_id>", methods=["GET"])
def get_team_time_off(board_id):
    """Get time-off data for a team.

    Headers:
        - X-Bamboo-Token: User's BambooHR API key
        - X-Bamboo-Subdomain: Company subdomain
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: For Atlassian Teams lookup

    Query params:
        - start_date: Start of date range (YYYY-MM-DD)
        - end_date: End of date range (YYYY-MM-DD)
        - team_id: Atlassian Team ID to filter by

    Returns:
        - Time-off entries for team members
    """
    token, subdomain = get_bamboo_credentials()
    if not token or not subdomain:
        return jsonify({
            "error": "Missing BambooHR credentials",
            "data": {"timeOff": [], "configured": False}
        }), 401

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    team_id = request.args.get("team_id")

    # Get Atlassian Team members to filter time-off
    team_member_emails = []

    if team_id:
        jira_server, jira_email, jira_token = get_jira_credentials()
        if jira_server and jira_email and jira_token:
            team_member_emails = get_team_member_emails(
                jira_server, jira_email, jira_token, team_id
            )

    time_off = bamboo_client.get_time_off_requests(
        token, subdomain, start_date, end_date, team_member_emails or None
    )

    return jsonify({
        "data": {
            "timeOff": time_off,
            "teamId": team_id,
            "teamMemberCount": len(team_member_emails) if team_member_emails else None,
            "configured": True
        }
    })


@bp.route("/employees", methods=["GET"])
def get_employees():
    """Get employee directory for matching with Jira users.

    Headers:
        - X-Bamboo-Token: User's BambooHR API key
        - X-Bamboo-Subdomain: Company subdomain

    This endpoint helps with setup/debugging employee matching.
    """
    token, subdomain = get_bamboo_credentials()

    if not token or not subdomain:
        return jsonify({
            "error": "Missing BambooHR credentials",
            "data": {"employees": [], "configured": False}
        }), 401

    employees = bamboo_client.get_employees(token, subdomain)
    return jsonify({"data": {"employees": employees, "configured": True}})


@bp.route("/capacity/<int:board_id>", methods=["GET"])
def get_capacity(board_id):
    """Calculate capacity adjustment for upcoming sprint.

    Headers:
        - X-Bamboo-Token: User's BambooHR API key
        - X-Bamboo-Subdomain: Company subdomain
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: For Atlassian Teams lookup

    Query params:
        - sprint_start: Sprint start date (YYYY-MM-DD) - required
        - sprint_end: Sprint end date (YYYY-MM-DD) - required
        - team_id: Atlassian Team ID - required for member-based capacity
        - team_size: Override team size (optional, defaults to Atlassian Team size)

    Returns:
        - Capacity adjustment factor and breakdown
    """
    token, subdomain = get_bamboo_credentials()
    if not token or not subdomain:
        return jsonify({
            "error": "Missing BambooHR credentials",
            "data": {"adjustmentFactor": 1.0, "configured": False}
        }), 401

    sprint_start = request.args.get("sprint_start")
    sprint_end = request.args.get("sprint_end")
    member_emails_param = request.args.get("member_emails", "")
    team_size_override = request.args.get("team_size", type=int)

    if not sprint_start or not sprint_end:
        return jsonify({
            "error": "sprint_start and sprint_end are required"
        }), 400

    # Parse member emails from comma-separated string
    team_member_emails = [e.strip() for e in member_emails_param.split(",") if e.strip()]

    team_size = team_size_override or len(team_member_emails) or 5

    capacity = bamboo_client.calculate_capacity_adjustment(
        api_key=token,
        subdomain=subdomain,
        sprint_start=sprint_start,
        sprint_end=sprint_end,
        team_member_emails=team_member_emails or None,
        team_size=team_size
    )
    capacity["configured"] = True

    return jsonify({"data": capacity})


@bp.route("/team-members", methods=["GET"])
def get_team_members():
    """Get members of an Atlassian Team.

    Headers:
        - X-Jira-Server, X-Jira-Email, X-Jira-Token: Jira credentials

    Query params:
        - team_id: Atlassian Team ID - required

    Returns:
        - List of team members
    """
    team_id = request.args.get("team_id")
    if not team_id:
        return jsonify({
            "error": "team_id query parameter is required",
            "data": {"members": []}
        }), 400

    jira_server, jira_email, jira_token = get_jira_credentials()
    if not jira_server or not jira_email or not jira_token:
        return jsonify({
            "error": "Missing Jira credentials",
            "data": {"members": []}
        }), 401

    from services.atlassian_teams import get_team_members as fetch_members
    members = fetch_members(jira_server, jira_email, jira_token, team_id)

    return jsonify({
        "data": {
            "members": members,
            "teamId": team_id
        }
    })
