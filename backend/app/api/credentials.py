"""Local credentials storage API endpoints.

Stores credentials in a local JSON file for persistence across browser sessions.
This is intended for local development only - not for hosted deployments.
"""

import json
import os
from flask import Blueprint, request, jsonify

bp = Blueprint("credentials", __name__, url_prefix="/api/credentials")

# Store credentials in backend/config/ directory (already gitignored)
CREDENTIALS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "config",
    "credentials.json"
)


def _ensure_config_dir():
    """Ensure the config directory exists."""
    config_dir = os.path.dirname(CREDENTIALS_FILE)
    if not os.path.exists(config_dir):
        os.makedirs(config_dir)


def _load_credentials():
    """Load credentials from file."""
    if not os.path.exists(CREDENTIALS_FILE):
        return {}
    try:
        with open(CREDENTIALS_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save_credentials(credentials):
    """Save credentials to file."""
    _ensure_config_dir()
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=2)


@bp.route("", methods=["GET"])
def get_credentials():
    """Get stored credentials.

    Returns both Jira and Bamboo credentials if they exist.
    Tokens are included since this is local-only storage.
    """
    credentials = _load_credentials()
    return jsonify({"data": credentials})


@bp.route("", methods=["POST"])
def save_credentials():
    """Save credentials to local storage.

    Expects JSON body with optional fields:
        - jira: { server, email, token, user }
        - bamboo: { subdomain, token }

    Merges with existing credentials (doesn't overwrite unspecified fields).
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Missing request body"}), 400

    # Load existing and merge
    credentials = _load_credentials()

    if "jira" in data:
        credentials["jira"] = data["jira"]

    if "bamboo" in data:
        credentials["bamboo"] = data["bamboo"]

    _save_credentials(credentials)

    return jsonify({"data": credentials})


@bp.route("", methods=["DELETE"])
def clear_credentials():
    """Clear all stored credentials."""
    if os.path.exists(CREDENTIALS_FILE):
        os.remove(CREDENTIALS_FILE)

    return jsonify({"data": {"cleared": True}})


@bp.route("/jira", methods=["DELETE"])
def clear_jira_credentials():
    """Clear only Jira credentials."""
    credentials = _load_credentials()

    if "jira" in credentials:
        del credentials["jira"]
        _save_credentials(credentials)

    return jsonify({"data": {"cleared": True}})


@bp.route("/bamboo", methods=["DELETE"])
def clear_bamboo_credentials():
    """Clear only Bamboo credentials."""
    credentials = _load_credentials()

    if "bamboo" in credentials:
        del credentials["bamboo"]
        _save_credentials(credentials)

    return jsonify({"data": {"cleared": True}})
