"""Board and sprint API endpoints."""

from flask import Blueprint, request, jsonify
import requests

bp = Blueprint("boards", __name__, url_prefix="/api/boards")


def get_jira_credentials():
    """Extract Jira credentials from request headers."""
    server = request.headers.get("X-Jira-Server", "").rstrip("/")
    email = request.headers.get("X-Jira-Email")
    token = request.headers.get("X-Jira-Token")

    if not all([server, email, token]):
        return None, None, None

    return server, email, token


def make_jira_request(server, email, token, endpoint, params=None):
    """Make authenticated request to Jira API."""
    response = requests.get(
        f"{server}{endpoint}",
        auth=(email, token),
        headers={"Accept": "application/json"},
        params=params,
        timeout=30
    )
    return response


@bp.route("", methods=["GET"])
def list_boards():
    """List all Scrum boards accessible to the user.

    Requires headers:
        - X-Jira-Server: Jira server URL
        - X-Jira-Email: User's Jira email
        - X-Jira-Token: Jira API token
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        # Fetch all boards (paginated)
        all_boards = []
        start_at = 0
        max_results = 50

        while True:
            response = make_jira_request(
                server, email, token,
                "/rest/agile/1.0/board",
                params={"startAt": start_at, "maxResults": max_results, "type": "scrum"}
            )

            if response.status_code != 200:
                return jsonify({"error": f"Jira API error: {response.status_code}"}), response.status_code

            data = response.json()
            boards = data.get("values", [])
            all_boards.extend(boards)

            # Check if more pages exist
            if data.get("isLast", True) or len(boards) < max_results:
                break

            start_at += max_results

        # Format response
        formatted_boards = [
            {
                "id": board["id"],
                "name": board["name"],
                "projectKey": board.get("location", {}).get("projectKey"),
                "projectName": board.get("location", {}).get("displayName")
            }
            for board in all_boards
        ]

        return jsonify({"data": formatted_boards})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to connect to Jira: {str(e)}"}), 500


@bp.route("/<int:board_id>/sprints", methods=["GET"])
def get_sprints(board_id):
    """Get completed sprints for a board (last 6 by default).

    Query params:
        - limit: Number of sprints to return (default: 6)
        - state: Sprint state filter (default: closed)
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    limit = request.args.get("limit", 6, type=int)
    state = request.args.get("state", "closed")

    try:
        # Fetch sprints for the board
        response = make_jira_request(
            server, email, token,
            f"/rest/agile/1.0/board/{board_id}/sprint",
            params={"state": state, "maxResults": 50}
        )

        if response.status_code == 404:
            return jsonify({"error": "Board not found"}), 404

        if response.status_code != 200:
            return jsonify({"error": f"Jira API error: {response.status_code}"}), response.status_code

        data = response.json()
        sprints = data.get("values", [])

        # Sort by end date descending and take the most recent
        sprints.sort(key=lambda s: s.get("endDate", ""), reverse=True)
        recent_sprints = sprints[:limit]

        # Format response
        formatted_sprints = [
            {
                "id": sprint["id"],
                "name": sprint["name"],
                "state": sprint["state"],
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "goal": sprint.get("goal")
            }
            for sprint in recent_sprints
        ]

        return jsonify({"data": formatted_sprints})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to connect to Jira: {str(e)}"}), 500
