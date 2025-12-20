"""Debug API endpoints for troubleshooting."""

from flask import Blueprint, request, jsonify
import requests

bp = Blueprint("debug", __name__, url_prefix="/api/debug")


def get_jira_credentials():
    """Extract Jira credentials from request headers."""
    server = request.headers.get("X-Jira-Server", "").rstrip("/")
    email = request.headers.get("X-Jira-Email")
    token = request.headers.get("X-Jira-Token")

    if not all([server, email, token]):
        return None, None, None

    return server, email, token


@bp.route("/story-points-field", methods=["GET"])
def find_story_points_field():
    """Find the story points custom field in this Jira instance."""
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        response = requests.get(
            f"{server}/rest/api/3/field",
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        fields = response.json()

        # Find fields that might be story points
        candidates = []
        for field in fields:
            name = field.get("name", "").lower()
            field_id = field.get("id", "")

            # Look for common story point field names
            if any(term in name for term in ["story point", "points", "estimate", "sizing"]):
                candidates.append({
                    "id": field_id,
                    "name": field.get("name"),
                    "type": field.get("schema", {}).get("type"),
                    "custom": field.get("custom", False)
                })

        return jsonify({
            "data": {
                "candidates": candidates,
                "total_fields": len(fields)
            }
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/sprint-issues/<int:sprint_id>", methods=["GET"])
def get_sprint_issues_raw(sprint_id):
    """Get raw issue data for a sprint to inspect fields."""
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        response = requests.get(
            f"{server}/rest/agile/1.0/sprint/{sprint_id}/issue",
            auth=(email, token),
            headers={"Accept": "application/json"},
            params={"maxResults": 5, "fields": "*all"},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        # Extract just the custom fields from each issue
        issues_summary = []
        for issue in data.get("issues", []):
            fields = issue.get("fields", {})
            custom_fields = {
                k: v for k, v in fields.items()
                if k.startswith("customfield_") and v is not None
            }
            issues_summary.append({
                "key": issue.get("key"),
                "summary": fields.get("summary"),
                "issuetype": fields.get("issuetype", {}).get("name"),
                "status": fields.get("status", {}).get("name"),
                "custom_fields_with_values": custom_fields
            })

        return jsonify({"data": issues_summary})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/board/<int:board_id>/all-sprints", methods=["GET"])
def get_all_sprints(board_id):
    """Get all sprints for a board to debug sprint selection."""
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        # Fetch all sprints (not just closed)
        response = requests.get(
            f"{server}/rest/agile/1.0/board/{board_id}/sprint",
            auth=(email, token),
            headers={"Accept": "application/json"},
            params={"maxResults": 50},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        sprints = data.get("values", [])

        # Sort by endDate descending (same as metrics service)
        sprints.sort(key=lambda s: s.get("endDate", ""), reverse=True)

        sprint_summary = []
        for sprint in sprints:
            sprint_summary.append({
                "id": sprint.get("id"),
                "name": sprint.get("name"),
                "state": sprint.get("state"),
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "completeDate": sprint.get("completeDate")
            })

        # Also show which ones would be selected (closed, top 6)
        closed_sprints = [s for s in sprint_summary if s["state"] == "closed"]
        selected_for_metrics = closed_sprints[:6]

        return jsonify({
            "data": {
                "all_sprints": sprint_summary,
                "total_count": len(sprint_summary),
                "closed_count": len(closed_sprints),
                "selected_for_metrics": [s["name"] for s in selected_for_metrics]
            }
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
