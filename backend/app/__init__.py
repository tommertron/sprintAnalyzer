"""Flask application factory."""

from flask import Flask
from flask_cors import CORS


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

    # Health check endpoint
    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app
