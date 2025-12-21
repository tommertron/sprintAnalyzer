"""Flask application factory."""

import json
import os
from flask import Flask
from flask_cors import CORS

# Global config storage - set of whitelisted board IDs
_whitelisted_board_ids = set()


def load_teams_config(app):
    """Load whitelisted board IDs from config file."""
    global _whitelisted_board_ids
    config_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "teams-config.json"
    )

    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
                # Load whitelisted board IDs as strings
                _whitelisted_board_ids = set(
                    str(bid) for bid in config.get("whitelistedBoardIds", [])
                )
                app.logger.info(
                    f"Loaded {len(_whitelisted_board_ids)} whitelisted board IDs"
                )
        except (json.JSONDecodeError, IOError) as e:
            app.logger.warning(f"Failed to load teams config: {e}")
            _whitelisted_board_ids = set()
    else:
        app.logger.info("No teams-config.json found, whitelist features disabled")
        _whitelisted_board_ids = set()


def is_board_whitelisted(board_id):
    """Check if a board is in the whitelist."""
    return str(board_id) in _whitelisted_board_ids


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Enable CORS for frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "X-Jira-Token", "X-Jira-Email", "X-Jira-Server",
                "X-Bamboo-Token", "X-Bamboo-Subdomain"
            ]
        }
    })

    # Register blueprints
    from app.api import auth, boards, metrics, debug, bamboo
    app.register_blueprint(auth.bp)
    app.register_blueprint(boards.bp)
    app.register_blueprint(metrics.bp)
    app.register_blueprint(debug.bp)
    app.register_blueprint(bamboo.bp)

    # Load whitelisted teams configuration
    load_teams_config(app)

    # Health check endpoint
    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app
