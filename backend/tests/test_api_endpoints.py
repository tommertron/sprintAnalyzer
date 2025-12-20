"""Tests for API endpoints."""

import pytest
from unittest.mock import patch, Mock
import json


class TestAuthValidate:
    """Test authentication validation endpoint."""

    def test_validate_missing_body(self, client):
        """Should return 400 for missing request body."""
        response = client.post("/api/auth/validate",
                               content_type="application/json")
        assert response.status_code == 400

    def test_validate_missing_fields(self, client):
        """Should return 400 for missing required fields."""
        response = client.post("/api/auth/validate",
                               json={"server": "https://test.atlassian.net"})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    @patch("app.api.auth.requests.get")
    def test_validate_invalid_credentials(self, mock_get, client):
        """Should return 401 for invalid credentials."""
        mock_get.return_value = Mock(status_code=401)

        response = client.post("/api/auth/validate", json={
            "server": "https://test.atlassian.net",
            "email": "test@example.com",
            "token": "invalid-token"
        })

        assert response.status_code == 401

    @patch("app.api.auth.requests.get")
    def test_validate_success(self, mock_get, client):
        """Should return user info on valid credentials."""
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "accountId": "123",
                "displayName": "Test User",
                "emailAddress": "test@example.com",
                "avatarUrls": {"48x48": "https://example.com/avatar.png"}
            }
        )

        response = client.post("/api/auth/validate", json={
            "server": "https://test.atlassian.net",
            "email": "test@example.com",
            "token": "valid-token"
        })

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["data"]["valid"] is True
        assert data["data"]["user"]["displayName"] == "Test User"

    @patch("app.api.auth.requests.get")
    def test_validate_timeout(self, mock_get, client):
        """Should return 504 on connection timeout."""
        import requests
        mock_get.side_effect = requests.exceptions.Timeout()

        response = client.post("/api/auth/validate", json={
            "server": "https://test.atlassian.net",
            "email": "test@example.com",
            "token": "token"
        })

        assert response.status_code == 504


class TestBoardsList:
    """Test boards listing endpoint."""

    def test_list_boards_missing_credentials(self, client):
        """Should return 401 when credentials are missing."""
        response = client.get("/api/boards")
        assert response.status_code == 401

    @patch("app.api.boards.make_jira_request")
    def test_list_boards_success(self, mock_request, client):
        """Should return formatted boards list."""
        mock_request.return_value = Mock(
            status_code=200,
            json=lambda: {
                "values": [
                    {
                        "id": 1,
                        "name": "Team Alpha",
                        "location": {"projectKey": "ALPHA", "displayName": "Project Alpha"}
                    },
                    {
                        "id": 2,
                        "name": "Team Beta",
                        "location": {"projectKey": "BETA", "displayName": "Project Beta"}
                    }
                ],
                "isLast": True
            }
        )

        response = client.get("/api/boards", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["data"]) == 2
        assert data["data"][0]["name"] == "Team Alpha"
        assert data["data"][0]["projectKey"] == "ALPHA"

    @patch("app.api.boards.make_jira_request")
    def test_list_boards_jira_error(self, mock_request, client):
        """Should propagate Jira API errors."""
        mock_request.return_value = Mock(status_code=500)

        response = client.get("/api/boards", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 500


class TestBoardSprints:
    """Test board sprints endpoint."""

    def test_get_sprints_missing_credentials(self, client):
        """Should return 401 when credentials are missing."""
        response = client.get("/api/boards/123/sprints")
        assert response.status_code == 401

    @patch("app.api.boards.make_jira_request")
    def test_get_sprints_board_not_found(self, mock_request, client):
        """Should return 404 for non-existent board."""
        mock_request.return_value = Mock(status_code=404)

        response = client.get("/api/boards/999/sprints", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 404

    @patch("app.api.boards.make_jira_request")
    def test_get_sprints_success(self, mock_request, client):
        """Should return formatted sprints list."""
        mock_request.return_value = Mock(
            status_code=200,
            json=lambda: {
                "values": [
                    {
                        "id": 100,
                        "name": "Sprint 1",
                        "state": "closed",
                        "startDate": "2024-01-01T00:00:00.000Z",
                        "endDate": "2024-01-14T00:00:00.000Z",
                        "goal": "Complete feature X"
                    },
                    {
                        "id": 101,
                        "name": "Sprint 2",
                        "state": "closed",
                        "startDate": "2024-01-15T00:00:00.000Z",
                        "endDate": "2024-01-28T00:00:00.000Z",
                        "goal": "Complete feature Y"
                    }
                ]
            }
        )

        response = client.get("/api/boards/123/sprints", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["data"]) == 2
        # Should be sorted by end date descending
        assert data["data"][0]["name"] == "Sprint 2"

    @patch("app.api.boards.make_jira_request")
    def test_get_sprints_respects_limit(self, mock_request, client):
        """Should respect the limit query parameter."""
        mock_request.return_value = Mock(
            status_code=200,
            json=lambda: {
                "values": [
                    {"id": i, "name": f"Sprint {i}", "state": "closed", "endDate": f"2024-01-{i:02d}"}
                    for i in range(1, 11)
                ]
            }
        )

        response = client.get("/api/boards/123/sprints?limit=3", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["data"]) == 3
