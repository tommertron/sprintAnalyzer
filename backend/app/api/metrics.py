"""Sprint metrics API endpoints."""

from flask import Blueprint, request, jsonify
from services.sprint_metrics import SprintMetricsService

bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")


def get_jira_credentials():
    """Extract Jira credentials from request headers."""
    server = request.headers.get("X-Jira-Server", "").rstrip("/")
    email = request.headers.get("X-Jira-Email")
    token = request.headers.get("X-Jira-Token")

    if not all([server, email, token]):
        return None, None, None

    return server, email, token


def get_excluded_spaces():
    """Get excluded space project keys from query params."""
    spaces = request.args.get("excluded_spaces", "")
    if not spaces:
        return []
    return [s.strip() for s in spaces.split(",") if s.strip()]


def get_date_range():
    """Get optional date range from query params.

    Query params:
        - start_date: ISO date string (e.g., "2024-01-01")
        - end_date: ISO date string (e.g., "2024-03-31")

    Returns:
        Tuple of (start_date, end_date), either can be None
    """
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    return start_date, end_date


def get_sprint_count():
    """Get optional sprint count from query params.

    Query params:
        - sprint_count: Number of sprints to include (e.g., 10)

    Returns:
        int or None
    """
    sprint_count = request.args.get("sprint_count")
    if sprint_count:
        try:
            return int(sprint_count)
        except ValueError:
            return None
    return None


@bp.route("/<int:board_id>/velocity", methods=["GET"])
def get_velocity(board_id):
    """Get velocity metrics for sprints.

    Query params:
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns:
        - Per-sprint story points completed
        - Average velocity
        - Velocity trend
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        velocity_data = service.get_velocity_metrics(board_id, start_date, end_date, sprint_count)
        return jsonify({"data": velocity_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/completion", methods=["GET"])
def get_completion(board_id):
    """Get completion metrics for sprints.

    Query params:
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns:
        - Completion rate per sprint
        - Mid-sprint additions count and points
        - Committed vs completed comparison
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        completion_data = service.get_completion_metrics(board_id, start_date, end_date, sprint_count)
        return jsonify({"data": completion_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/quality", methods=["GET"])
def get_quality(board_id):
    """Get quality metrics for sprints.

    Query params:
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns:
        - Bug ratio (count and percentage)
        - Average ticket age (cycle time)
        - Incomplete percentage
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        quality_data = service.get_quality_metrics(board_id, start_date, end_date, sprint_count)
        return jsonify({"data": quality_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/alignment", methods=["GET"])
def get_alignment(board_id):
    """Get strategic alignment metrics for sprints.

    Query params:
        - excluded_spaces: Comma-separated list of project keys to exclude
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns:
        - Initiative-linked work percentage
        - Non-initiative (orphan) work percentage
        - Discovered spaces with initiatives
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    excluded_spaces = get_excluded_spaces()
    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        alignment_data = service.get_alignment_metrics(board_id, excluded_spaces, start_date, end_date, sprint_count)
        return jsonify({"data": alignment_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/coverage", methods=["GET"])
def get_coverage(board_id):
    """Get story point coverage metrics for sprints.

    Query params:
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns:
        - Stories with points vs without
        - Coverage percentage
        - Average points (for fallback calculation)
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        coverage_data = service.get_coverage_metrics(board_id, start_date, end_date, sprint_count)
        return jsonify({"data": coverage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/debug/issue-hierarchy/<issue_key>", methods=["GET"])
def debug_issue_hierarchy(issue_key):
    """Debug endpoint to trace the parent hierarchy of an issue.

    Shows each level of the hierarchy to help debug alignment issues.
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        service = SprintMetricsService(server, email, token)

        hierarchy = []
        current_key = issue_key
        max_depth = 10

        for depth in range(max_depth):
            # Fetch the current issue
            try:
                data = service._request(
                    f"/rest/api/3/issue/{current_key}",
                    params={"fields": "summary,issuetype,parent"}
                )
            except Exception as e:
                hierarchy.append({
                    "level": depth,
                    "key": current_key,
                    "error": str(e)
                })
                break

            fields = data.get("fields", {})
            issue_type = fields.get("issuetype", {}).get("name", "Unknown")
            summary = fields.get("summary", "")
            parent = fields.get("parent")

            hierarchy.append({
                "level": depth,
                "key": current_key,
                "issueType": issue_type,
                "summary": summary[:100],
                "parentKey": parent.get("key") if parent else None
            })

            if not parent or not parent.get("key"):
                break

            current_key = parent.get("key")

        return jsonify({
            "data": {
                "startingIssue": issue_key,
                "hierarchy": hierarchy
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/summary", methods=["GET"])
def get_summary(board_id):
    """Get all metrics combined for dashboard display.

    Query params:
        - excluded_spaces: Comma-separated list of project keys to exclude
        - start_date: Optional ISO date (e.g., "2024-01-01")
        - end_date: Optional ISO date (e.g., "2024-03-31")
        - sprint_count: Optional number of sprints to include

    Returns combined object with all metric categories.
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    excluded_spaces = get_excluded_spaces()
    start_date, end_date = get_date_range()
    sprint_count = get_sprint_count()

    try:
        service = SprintMetricsService(server, email, token)
        summary = service.get_all_metrics(board_id, excluded_spaces, start_date, end_date, sprint_count)
        return jsonify({"data": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
