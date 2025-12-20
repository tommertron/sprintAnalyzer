"""Authentication API endpoints."""

from flask import Blueprint, request, jsonify
import requests

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/validate", methods=["POST"])
def validate_token():
    """Validate Jira API token by fetching current user info.

    Expects JSON body with:
        - server: Jira server URL
        - email: User's Jira email
        - token: Jira API token

    Returns user info and accessible projects on success.
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Missing request body"}), 400

    server = data.get("server", "").rstrip("/")
    email = data.get("email")
    token = data.get("token")

    if not all([server, email, token]):
        return jsonify({"error": "Missing required fields: server, email, token"}), 400

    try:
        # Validate by fetching current user
        response = requests.get(
            f"{server}/rest/api/3/myself",
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=10
        )

        if response.status_code == 401:
            return jsonify({"error": "Invalid credentials"}), 401

        if response.status_code != 200:
            return jsonify({"error": f"Jira API error: {response.status_code}"}), response.status_code

        user_info = response.json()

        return jsonify({
            "data": {
                "valid": True,
                "user": {
                    "accountId": user_info.get("accountId"),
                    "displayName": user_info.get("displayName"),
                    "emailAddress": user_info.get("emailAddress"),
                    "avatarUrl": user_info.get("avatarUrls", {}).get("48x48")
                }
            }
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "Connection to Jira timed out"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to connect to Jira: {str(e)}"}), 500
