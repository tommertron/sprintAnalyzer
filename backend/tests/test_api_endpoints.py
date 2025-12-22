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


class TestMetricsTimeInStatus:
    """Test time in status metrics endpoint."""

    def test_time_in_status_missing_credentials(self, client):
        """Should return 401 when credentials are missing."""
        response = client.get("/api/metrics/123/time-in-status")
        assert response.status_code == 401

    @patch("app.api.metrics.SprintMetricsService")
    def test_time_in_status_success(self, mock_service_class, client):
        """Should return time in status metrics."""
        # Mock service instance
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        # Mock response data
        mock_service.get_time_in_status_metrics.return_value = {
            "sprints": [
                {
                    "sprintId": 100,
                    "sprintName": "Sprint 1",
                    "statusBreakdown": [
                        {
                            "status": "In Progress",
                            "avgTimeHours": 24.5,
                            "medianTimeHours": 22.0,
                            "p90TimeHours": 35.0,
                            "totalTimeHours": 98.0,
                            "issueCount": 4,
                            "percentOfCycleTime": 45.0
                        },
                        {
                            "status": "Code Review",
                            "avgTimeHours": 12.0,
                            "medianTimeHours": 10.0,
                            "p90TimeHours": 18.0,
                            "totalTimeHours": 48.0,
                            "issueCount": 4,
                            "percentOfCycleTime": 22.0
                        }
                    ],
                    "bottleneckStatus": "In Progress",
                    "totalCycleTimeHours": 218.0
                }
            ]
        }

        response = client.get("/api/metrics/123/time-in-status", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "data" in data
        assert "sprints" in data["data"]
        assert len(data["data"]["sprints"]) == 1

        sprint_data = data["data"]["sprints"][0]
        assert sprint_data["bottleneckStatus"] == "In Progress"
        assert len(sprint_data["statusBreakdown"]) == 2
        assert sprint_data["statusBreakdown"][0]["status"] == "In Progress"

    @patch("app.api.metrics.SprintMetricsService")
    def test_time_in_status_with_date_range(self, mock_service_class, client):
        """Should pass date range parameters to service."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_time_in_status_metrics.return_value = {"sprints": []}

        response = client.get(
            "/api/metrics/123/time-in-status?start_date=2024-01-01&end_date=2024-03-31",
            headers={
                "X-Jira-Server": "https://test.atlassian.net",
                "X-Jira-Email": "test@example.com",
                "X-Jira-Token": "token123"
            }
        )

        assert response.status_code == 200
        # Verify service was called with date parameters
        mock_service.get_time_in_status_metrics.assert_called_once_with(
            123, "2024-01-01", "2024-03-31", 6
        )

    @patch("app.api.metrics.SprintMetricsService")
    def test_time_in_status_with_sprint_count(self, mock_service_class, client):
        """Should pass sprint count parameter to service."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_time_in_status_metrics.return_value = {"sprints": []}

        response = client.get(
            "/api/metrics/123/time-in-status?sprint_count=10",
            headers={
                "X-Jira-Server": "https://test.atlassian.net",
                "X-Jira-Email": "test@example.com",
                "X-Jira-Token": "token123"
            }
        )

        assert response.status_code == 200
        # Verify service was called with sprint count
        mock_service.get_time_in_status_metrics.assert_called_once_with(
            123, None, None, 10
        )

    @patch("app.api.metrics.SprintMetricsService")
    def test_time_in_status_handles_service_error(self, mock_service_class, client):
        """Should return 500 on service error."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_time_in_status_metrics.side_effect = Exception("Service error")

        response = client.get("/api/metrics/123/time-in-status", headers={
            "X-Jira-Server": "https://test.atlassian.net",
            "X-Jira-Email": "test@example.com",
            "X-Jira-Token": "token123"
        })

        assert response.status_code == 500
        data = json.loads(response.data)
        assert "error" in data
