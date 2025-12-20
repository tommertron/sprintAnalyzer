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


def get_initiative_boards():
    """Get initiative board IDs from query params."""
    boards = request.args.get("initiative_boards", "")
    if not boards:
        return []
    return [int(b.strip()) for b in boards.split(",") if b.strip().isdigit()]


@bp.route("/<int:board_id>/velocity", methods=["GET"])
def get_velocity(board_id):
    """Get velocity metrics for last 6 sprints.

    Returns:
        - Per-sprint story points completed
        - Average velocity
        - Velocity trend
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        service = SprintMetricsService(server, email, token)
        velocity_data = service.get_velocity_metrics(board_id)
        return jsonify({"data": velocity_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/completion", methods=["GET"])
def get_completion(board_id):
    """Get completion metrics for last 6 sprints.

    Returns:
        - Completion rate per sprint
        - Mid-sprint additions count and points
        - Committed vs completed comparison
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        service = SprintMetricsService(server, email, token)
        completion_data = service.get_completion_metrics(board_id)
        return jsonify({"data": completion_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/quality", methods=["GET"])
def get_quality(board_id):
    """Get quality metrics for last 6 sprints.

    Returns:
        - Bug ratio (count and percentage)
        - Average ticket age (cycle time)
        - Incomplete percentage
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        service = SprintMetricsService(server, email, token)
        quality_data = service.get_quality_metrics(board_id)
        return jsonify({"data": quality_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/alignment", methods=["GET"])
def get_alignment(board_id):
    """Get strategic alignment metrics for last 6 sprints.

    Query params:
        - initiative_boards: Comma-separated list of initiative board IDs

    Returns:
        - Initiative-linked work percentage
        - Non-initiative (orphan) work percentage
        - Breakdown by initiative
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    initiative_boards = get_initiative_boards()

    try:
        service = SprintMetricsService(server, email, token)
        alignment_data = service.get_alignment_metrics(board_id, initiative_boards)
        return jsonify({"data": alignment_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/coverage", methods=["GET"])
def get_coverage(board_id):
    """Get story point coverage metrics for last 6 sprints.

    Returns:
        - Stories with points vs without
        - Coverage percentage
        - Average points (for fallback calculation)
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    try:
        service = SprintMetricsService(server, email, token)
        coverage_data = service.get_coverage_metrics(board_id)
        return jsonify({"data": coverage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<int:board_id>/summary", methods=["GET"])
def get_summary(board_id):
    """Get all metrics combined for dashboard display.

    Query params:
        - initiative_boards: Comma-separated list of initiative board IDs

    Returns combined object with all metric categories.
    """
    server, email, token = get_jira_credentials()

    if not server:
        return jsonify({"error": "Missing Jira credentials in headers"}), 401

    initiative_boards = get_initiative_boards()

    try:
        service = SprintMetricsService(server, email, token)
        summary = service.get_all_metrics(board_id, initiative_boards)
        return jsonify({"data": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
