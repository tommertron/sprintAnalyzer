"""Tests for SprintMetricsService."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.sprint_metrics import SprintMetricsService


class TestSprintMetricsServiceInit:
    """Test service initialization."""

    def test_init_strips_trailing_slash(self):
        """Server URL should have trailing slash removed."""
        service = SprintMetricsService(
            server="https://test.atlassian.net/",
            email="test@example.com",
            token="token123"
        )
        assert service.server == "https://test.atlassian.net"

    def test_init_stores_credentials(self, mock_jira_credentials):
        """Credentials should be stored correctly."""
        service = SprintMetricsService(**mock_jira_credentials)
        assert service.email == mock_jira_credentials["email"]
        assert service.token == mock_jira_credentials["token"]


class TestGetStoryPoints:
    """Test story points extraction."""

    def test_extracts_from_customfield_10002(self, mock_jira_credentials, mock_fields_response):
        """Should extract points from standard story points field."""
        service = SprintMetricsService(**mock_jira_credentials)

        with patch.object(service, '_request', return_value=mock_fields_response):
            issue = {"fields": {"customfield_10002": 5.0}}
            points = service._get_story_points(issue)
            assert points == 5.0

    def test_returns_none_when_no_points(self, mock_jira_credentials, mock_fields_response):
        """Should return None when no story points field has value."""
        service = SprintMetricsService(**mock_jira_credentials)

        with patch.object(service, '_request', return_value=mock_fields_response):
            issue = {"fields": {"summary": "No points here"}}
            points = service._get_story_points(issue)
            assert points is None

    def test_handles_invalid_points_value(self, mock_jira_credentials, mock_fields_response):
        """Should handle non-numeric story points gracefully."""
        service = SprintMetricsService(**mock_jira_credentials)

        with patch.object(service, '_request', return_value=mock_fields_response):
            issue = {"fields": {"customfield_10002": "invalid"}}
            points = service._get_story_points(issue)
            assert points is None

    def test_tries_multiple_field_ids(self, mock_jira_credentials, mock_fields_response):
        """Should check multiple custom field IDs."""
        service = SprintMetricsService(**mock_jira_credentials)

        with patch.object(service, '_request', return_value=mock_fields_response):
            # First field is None, second has value
            issue = {"fields": {"customfield_10016": 3.0}}
            points = service._get_story_points(issue)
            assert points == 3.0


class TestIsCompleted:
    """Test completion status detection."""

    def test_completed_issue_has_resolution(self, mock_jira_credentials, sample_issue_completed):
        """Issue with resolution should be marked completed."""
        service = SprintMetricsService(**mock_jira_credentials)
        assert service._is_completed(sample_issue_completed) is True

    def test_incomplete_issue_no_resolution(self, mock_jira_credentials, sample_issue_incomplete):
        """Issue without resolution should be marked incomplete."""
        service = SprintMetricsService(**mock_jira_credentials)
        assert service._is_completed(sample_issue_incomplete) is False


class TestParseDate:
    """Test date parsing."""

    def test_parses_full_jira_datetime(self, mock_jira_credentials):
        """Should parse full Jira datetime format."""
        service = SprintMetricsService(**mock_jira_credentials)
        result = service._parse_date("2024-01-15T10:30:00.000+0000")
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_parses_date_only(self, mock_jira_credentials):
        """Should parse date-only format."""
        service = SprintMetricsService(**mock_jira_credentials)
        result = service._parse_date("2024-01-15")
        assert result is not None
        assert result.year == 2024

    def test_returns_none_for_empty(self, mock_jira_credentials):
        """Should return None for empty string."""
        service = SprintMetricsService(**mock_jira_credentials)
        assert service._parse_date("") is None
        assert service._parse_date(None) is None


class TestCalculateVelocity:
    """Test velocity calculation."""

    def test_calculates_completed_points(self, mock_jira_credentials, sample_sprints):
        """Should sum completed story points per sprint."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprint_issues = {
            103: [
                {"key": "P-1", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 5.0}},
                {"key": "P-2", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 3.0}},
            ],
            102: [
                {"key": "P-3", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 8.0}},
            ],
            101: [],
            100: [
                {"key": "P-4", "fields": {"resolution": None, "customfield_10002": 5.0}},  # Not completed
            ]
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sample_sprints, sprint_issues)

        assert len(result["sprints"]) == 4
        assert result["sprints"][0]["completedPoints"] == 8.0  # Sprint 4
        assert result["sprints"][1]["completedPoints"] == 8.0  # Sprint 3
        assert result["sprints"][2]["completedPoints"] == 0    # Sprint 2 (empty)
        assert result["sprints"][3]["completedPoints"] == 0    # Sprint 1 (not completed)

    def test_handles_empty_sprints(self, mock_jira_credentials):
        """Should handle sprints with no issues."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1", "startDate": "2024-01-01", "endDate": "2024-01-14"}]
        sprint_issues = {1: []}

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        assert result["sprints"][0]["completedPoints"] == 0
        assert result["averageVelocity"] == 0

    def test_normalizes_velocity_for_different_sprint_lengths(self, mock_jira_credentials):
        """Should normalize velocity based on sprint length."""
        service = SprintMetricsService(**mock_jira_credentials)

        # 5 sprints of 10 working days, 1 sprint of 20 working days
        sprints = [
            {"id": 1, "name": "Sprint 1", "startDate": "2024-01-01T00:00:00.000Z", "endDate": "2024-01-15T00:00:00.000Z"},  # 10 days
            {"id": 2, "name": "Sprint 2", "startDate": "2024-01-15T00:00:00.000Z", "endDate": "2024-01-29T00:00:00.000Z"},  # 10 days
            {"id": 3, "name": "Sprint 3", "startDate": "2024-01-29T00:00:00.000Z", "endDate": "2024-02-12T00:00:00.000Z"},  # 10 days
            {"id": 4, "name": "Sprint 4", "startDate": "2024-02-12T00:00:00.000Z", "endDate": "2024-02-26T00:00:00.000Z"},  # 10 days
            {"id": 5, "name": "Sprint 5", "startDate": "2024-02-26T00:00:00.000Z", "endDate": "2024-03-11T00:00:00.000Z"},  # 10 days
            {"id": 6, "name": "Sprint 6", "startDate": "2024-03-11T00:00:00.000Z", "endDate": "2024-04-08T00:00:00.000Z"},  # 20 days
        ]

        sprint_issues = {
            1: [{"key": "P-1", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            2: [{"key": "P-2", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            3: [{"key": "P-3", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            4: [{"key": "P-4", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            5: [{"key": "P-5", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            6: [{"key": "P-6", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 80.0}}],  # 20-day sprint
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        # Standard sprint should be 10 days (median)
        assert result["standardSprintDays"] == 10

        # The 20-day sprint completed 80 pts = 4 pts/day
        # Normalized to 10 days = 40 pts
        sprint_6 = next(s for s in result["sprints"] if s["sprintId"] == 6)
        assert sprint_6["completedPoints"] == 80.0  # Raw points preserved
        assert sprint_6["pointsPerDay"] == 4.0
        assert sprint_6["normalizedPoints"] == 40.0

        # 10-day sprints should have same normalized as raw
        sprint_1 = next(s for s in result["sprints"] if s["sprintId"] == 1)
        assert sprint_1["completedPoints"] == 50.0
        assert sprint_1["normalizedPoints"] == 50.0

        # Average velocity should use normalized points
        # (50+50+50+50+50+40) / 6 = 48.33
        assert result["averageVelocity"] == 48.3

        # Raw average should be (50+50+50+50+50+80) / 6 = 55
        assert result["rawAverageVelocity"] == 55.0

    def test_uses_median_for_standard_sprint_length(self, mock_jira_credentials):
        """Should use median sprint length as standard."""
        service = SprintMetricsService(**mock_jira_credentials)

        # 4 sprints: 5, 10, 10, 20 days - median should be 10
        sprints = [
            {"id": 1, "name": "Sprint 1", "startDate": "2024-01-01T00:00:00.000Z", "endDate": "2024-01-08T00:00:00.000Z"},  # 5 days
            {"id": 2, "name": "Sprint 2", "startDate": "2024-01-08T00:00:00.000Z", "endDate": "2024-01-22T00:00:00.000Z"},  # 10 days
            {"id": 3, "name": "Sprint 3", "startDate": "2024-01-22T00:00:00.000Z", "endDate": "2024-02-05T00:00:00.000Z"},  # 10 days
            {"id": 4, "name": "Sprint 4", "startDate": "2024-02-05T00:00:00.000Z", "endDate": "2024-03-04T00:00:00.000Z"},  # 20 days
        ]

        sprint_issues = {s["id"]: [] for s in sprints}

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        # Median of [5, 10, 10, 20] = (10 + 10) / 2 = 10
        assert result["standardSprintDays"] == 10

    def test_single_sprint_uses_own_length(self, mock_jira_credentials):
        """Single sprint should use its own length as standard."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [
            {"id": 1, "name": "Sprint 1", "startDate": "2024-01-01T00:00:00.000Z", "endDate": "2024-01-22T00:00:00.000Z"},  # 15 days
        ]

        sprint_issues = {
            1: [{"key": "P-1", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 30.0}}],
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        assert result["standardSprintDays"] == 15
        # With single sprint at standard length, normalized = raw
        assert result["sprints"][0]["normalizedPoints"] == 30.0
        assert result["sprints"][0]["completedPoints"] == 30.0

    def test_same_length_sprints_no_normalization_effect(self, mock_jira_credentials):
        """When all sprints are same length, normalized equals raw."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [
            {"id": 1, "name": "Sprint 1", "startDate": "2024-01-01T00:00:00.000Z", "endDate": "2024-01-15T00:00:00.000Z"},
            {"id": 2, "name": "Sprint 2", "startDate": "2024-01-15T00:00:00.000Z", "endDate": "2024-01-29T00:00:00.000Z"},
            {"id": 3, "name": "Sprint 3", "startDate": "2024-01-29T00:00:00.000Z", "endDate": "2024-02-12T00:00:00.000Z"},
        ]

        sprint_issues = {
            1: [{"key": "P-1", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 40.0}}],
            2: [{"key": "P-2", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 50.0}}],
            3: [{"key": "P-3", "fields": {"resolution": {"name": "Done"}, "customfield_10002": 45.0}}],
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        # All same length, so normalized should equal raw
        for sprint in result["sprints"]:
            assert sprint["normalizedPoints"] == sprint["completedPoints"]

        assert result["averageVelocity"] == result["rawAverageVelocity"]

    def test_includes_working_days_in_response(self, mock_jira_credentials):
        """Each sprint should include working days count."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [
            {"id": 1, "name": "Sprint 1", "startDate": "2024-01-01T00:00:00.000Z", "endDate": "2024-01-15T00:00:00.000Z"},
        ]

        sprint_issues = {1: []}

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_velocity(sprints, sprint_issues)

        assert "workingDays" in result["sprints"][0]
        assert result["sprints"][0]["workingDays"] == 10  # 2 weeks excluding weekends


class TestCalculateCompletion:
    """Test completion rate calculation."""

    def test_calculates_completion_rate(self, mock_jira_credentials):
        """Should calculate completion rate correctly."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1", "startDate": "2024-01-01", "endDate": "2024-01-14"}]
        sprint_issues = {
            1: [
                {"key": "P-1", "fields": {"resolution": {"name": "Done"}}},
                {"key": "P-2", "fields": {"resolution": {"name": "Done"}}},
                {"key": "P-3", "fields": {"resolution": None}},
                {"key": "P-4", "fields": {"resolution": None}},
            ]
        }

        result = service._calculate_completion(sprints, sprint_issues)

        assert result["sprints"][0]["committed"] == 4
        assert result["sprints"][0]["completed"] == 2
        assert result["sprints"][0]["completionRate"] == 50.0

    def test_handles_no_issues(self, mock_jira_credentials):
        """Should handle empty sprint gracefully."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {1: []}

        result = service._calculate_completion(sprints, sprint_issues)

        assert result["sprints"][0]["committed"] == 0
        assert result["sprints"][0]["completionRate"] == 0


class TestCalculateQuality:
    """Test quality metrics calculation."""

    def test_calculates_bug_ratio(self, mock_jira_credentials):
        """Should calculate bug ratio as percentage of completed work."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {"key": "P-1", "fields": {"resolution": {"name": "Done"}, "issuetype": {"name": "Story"}}},
                {"key": "P-2", "fields": {"resolution": {"name": "Done"}, "issuetype": {"name": "Bug"}}},
                {"key": "P-3", "fields": {"resolution": {"name": "Done"}, "issuetype": {"name": "Story"}}},
                {"key": "P-4", "fields": {"resolution": {"name": "Done"}, "issuetype": {"name": "Bug"}}},
            ]
        }

        result = service._calculate_quality(sprints, sprint_issues)

        # 2 bugs out of 4 completed = 50%
        assert result["sprints"][0]["bugRatio"] == 50.0
        assert result["sprints"][0]["completedBugs"] == 2

    def test_calculates_incomplete_percentage(self, mock_jira_credentials):
        """Should calculate incomplete percentage."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {"key": "P-1", "fields": {"resolution": {"name": "Done"}, "issuetype": {"name": "Story"}}},
                {"key": "P-2", "fields": {"resolution": None, "issuetype": {"name": "Story"}}},
            ]
        }

        result = service._calculate_quality(sprints, sprint_issues)

        # 1 incomplete out of 2 = 50%
        assert result["sprints"][0]["incompletePercentage"] == 50.0

    def test_calculates_average_ticket_age(self, mock_jira_credentials):
        """Should calculate average time from created to resolved."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {
                    "key": "P-1",
                    "fields": {
                        "resolution": {"name": "Done"},
                        "issuetype": {"name": "Story"},
                        "created": "2024-01-01T00:00:00.000+0000",
                        "resolutiondate": "2024-01-06T00:00:00.000+0000"  # 5 days
                    }
                },
                {
                    "key": "P-2",
                    "fields": {
                        "resolution": {"name": "Done"},
                        "issuetype": {"name": "Story"},
                        "created": "2024-01-01T00:00:00.000+0000",
                        "resolutiondate": "2024-01-04T00:00:00.000+0000"  # 3 days
                    }
                },
            ]
        }

        result = service._calculate_quality(sprints, sprint_issues)

        # Average of 5 and 3 = 4 days
        assert result["sprints"][0]["averageTicketAgeDays"] == 4.0


class TestCalculateCoverage:
    """Test story point coverage calculation."""

    def test_calculates_coverage_percentage(self, mock_jira_credentials):
        """Should calculate percentage of issues with story points."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {"key": "P-1", "fields": {"customfield_10002": 5.0}},
                {"key": "P-2", "fields": {"customfield_10002": 3.0}},
                {"key": "P-3", "fields": {}},  # No points
                {"key": "P-4", "fields": {}},  # No points
            ]
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_coverage(sprints, sprint_issues)

        assert result["sprints"][0]["withPoints"] == 2
        assert result["sprints"][0]["withoutPoints"] == 2
        assert result["sprints"][0]["coveragePercentage"] == 50.0

    def test_calculates_fallback_average(self, mock_jira_credentials):
        """Should calculate fallback average from pointed issues."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {"key": "P-1", "fields": {"customfield_10002": 5.0}},
                {"key": "P-2", "fields": {"customfield_10002": 3.0}},
            ]
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_coverage(sprints, sprint_issues)

        # Average of 5 and 3 = 4
        assert result["fallbackAveragePoints"] == 4.0


class TestCalculateAlignment:
    """Test strategic alignment calculation."""

    def test_counts_orphan_work(self, mock_jira_credentials):
        """Issues without parent should be counted as orphan."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {
                    "key": "P-1",
                    "fields": {
                        "resolution": {"name": "Done"},
                        "issuetype": {"name": "Story", "subtask": False},
                        "customfield_10002": 5.0
                        # No parent field
                    }
                },
            ]
        }

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_alignment(sprints, sprint_issues)

        assert result["sprints"][0]["orphanCount"] == 5.0
        assert result["sprints"][0]["linkedToInitiative"] == 0

    def test_skips_subtasks_without_points(self, mock_jira_credentials, sample_subtask_no_points):
        """Subtasks without points should be skipped."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {1: [sample_subtask_no_points]}

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            result = service._calculate_alignment(sprints, sprint_issues)

        # Subtask without points should be skipped entirely
        assert result["sprints"][0]["totalPoints"] == 0

    def test_excludes_spaces(self, mock_jira_credentials):
        """Excluded spaces should not count toward linked percentage."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{"id": 1, "name": "Sprint 1"}]
        sprint_issues = {
            1: [
                {
                    "key": "P-1",
                    "fields": {
                        "resolution": {"name": "Done"},
                        "issuetype": {"name": "Story", "subtask": False},
                        "customfield_10002": 5.0,
                        "parent": {"key": "EPIC-1"}
                    }
                },
            ]
        }

        # Mock the parent/initiative lookup
        def mock_parent(key):
            if key == "EPIC-1":
                return {"key": "INIT-1", "summary": "Initiative", "projectKey": "EXCLUDED", "issueType": "Initiative"}
            return None

        with patch.object(service, '_get_story_points_fields', return_value=['customfield_10002']):
            with patch.object(service, '_get_issue_parent', side_effect=mock_parent):
                with patch.object(service, '_get_issue_labels', return_value=[]):
                    result = service._calculate_alignment(sprints, sprint_issues, excluded_spaces=["EXCLUDED"])

        # Should be counted as orphan since space is excluded
        assert result["sprints"][0]["orphanCount"] == 5.0


class TestCalculateTimeInStatus:
    """Test time in status calculation."""

    def test_calculates_time_per_status(self, mock_jira_credentials, sample_issue_with_changelog):
        """Should calculate time spent in each status."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_with_changelog]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        assert len(result["sprints"]) == 1
        sprint_data = result["sprints"][0]

        # Check that we have status breakdown
        assert "statusBreakdown" in sprint_data
        assert len(sprint_data["statusBreakdown"]) > 0

        # Find specific statuses
        statuses = {s["status"]: s for s in sprint_data["statusBreakdown"]}

        # Should have tracked "To Do", "In Progress", and "Code Review" (current status)
        # Only unresolved issues are tracked for bottleneck analysis
        assert "To Do" in statuses
        assert "In Progress" in statuses
        assert "Code Review" in statuses

    def test_handles_issue_without_changelog(self, mock_jira_credentials, sample_issue_no_changelog):
        """Should handle unresolved issues that never changed status."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_no_changelog]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        assert len(result["sprints"]) == 1
        sprint_data = result["sprints"][0]

        # Should track time in current status (In Progress)
        assert len(sprint_data["statusBreakdown"]) == 1
        assert sprint_data["statusBreakdown"][0]["status"] == "In Progress"
        # Time from creation (Jan 5 09:00) to sprint end (Jan 14 00:00) = 207 hours
        assert sprint_data["statusBreakdown"][0]["avgTimeHours"] == 207.0

    def test_handles_multiple_transitions_same_status(self, mock_jira_credentials, sample_issue_multiple_transitions):
        """Should correctly handle issues that transition back to same status."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_multiple_transitions]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]
        statuses = {s["status"]: s for s in sprint_data["statusBreakdown"]}

        # Issue went: To Do -> In Progress -> Code Review -> In Progress (current)
        # "In Progress" appears twice in the timeline plus current status
        assert "In Progress" in statuses
        assert statuses["In Progress"]["issueCount"] == 1  # One issue

    def test_calculates_statistical_metrics(self, mock_jira_credentials, sample_issue_with_changelog):
        """Should calculate avg, median, and p90 time per status."""
        service = SprintMetricsService(**mock_jira_credentials)

        # Create second unresolved issue to test statistics
        issue2 = {
            "key": "PROJ-203",
            "fields": {
                "summary": "Another feature",
                "issuetype": {"name": "Story", "subtask": False},
                "status": {"name": "In Progress"},  # Currently in progress
                "resolution": None,  # Not resolved
                "created": "2024-01-02T10:00:00.000+0000",
                "resolutiondate": None,
                "customfield_10002": 3.0,
                "changelog": {
                    "histories": [
                        {
                            "created": "2024-01-03T10:00:00.000+0000",
                            "items": [{"field": "status", "fromString": "To Do", "toString": "In Progress"}]
                        }
                    ]
                }
            }
        }

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_with_changelog, issue2]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]

        # Each status should have avgTimeHours, medianTimeHours, p90TimeHours
        for status_data in sprint_data["statusBreakdown"]:
            assert "avgTimeHours" in status_data
            assert "medianTimeHours" in status_data
            assert "p90TimeHours" in status_data
            assert "issueCount" in status_data
            assert "percentOfCycleTime" in status_data

    def test_identifies_bottleneck(self, mock_jira_credentials, sample_issue_with_changelog):
        """Should identify the status with most time as bottleneck."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_with_changelog]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]

        # Should identify a bottleneck
        assert "bottleneckStatus" in sprint_data
        assert sprint_data["bottleneckStatus"] is not None

        # Bottleneck should be the status with highest total time
        sorted_statuses = sorted(
            sprint_data["statusBreakdown"],
            key=lambda x: x["totalTimeHours"],
            reverse=True
        )
        assert sprint_data["bottleneckStatus"] == sorted_statuses[0]["status"]

    def test_respects_sprint_boundaries(self, mock_jira_credentials):
        """Should only count time within sprint boundaries."""
        service = SprintMetricsService(**mock_jira_credentials)

        # Unresolved issue created before sprint, with transitions during sprint
        issue = {
            "key": "PROJ-204",
            "fields": {
                "summary": "Long running issue",
                "issuetype": {"name": "Story", "subtask": False},
                "status": {"name": "Code Review"},  # Currently in code review
                "resolution": None,  # Not resolved
                "created": "2023-12-20T10:00:00.000+0000",  # Before sprint
                "resolutiondate": None,
                "customfield_10002": 5.0,
                "changelog": {
                    "histories": [
                        {
                            "created": "2024-01-05T10:00:00.000+0000",  # During sprint
                            "items": [{"field": "status", "fromString": "To Do", "toString": "In Progress"}]
                        },
                        {
                            "created": "2024-01-10T14:00:00.000+0000",  # During sprint
                            "items": [{"field": "status", "fromString": "In Progress", "toString": "Code Review"}]
                        }
                    ]
                }
            }
        }

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"  # 13 days = 312 hours
        }]
        sprint_issues = {1: [issue]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]
        statuses = {s["status"]: s for s in sprint_data["statusBreakdown"]}

        # Verify statuses are tracked
        assert len(statuses) > 0

        # Most importantly: total time should not exceed sprint duration (312 hours)
        total_time = sum(s["totalTimeHours"] for s in sprint_data["statusBreakdown"])
        assert total_time <= 312.0, f"Total time {total_time} exceeds sprint duration 312.0"

        # Each individual status should also be bounded
        for status, data in statuses.items():
            assert data["totalTimeHours"] <= 312.0, f"Status '{status}' has {data['totalTimeHours']} hours > 312"

    def test_calculates_percentage_of_cycle_time(self, mock_jira_credentials, sample_issue_with_changelog):
        """Should calculate what percentage each status is of total cycle time."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: [sample_issue_with_changelog]}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]

        # All percentages should sum to approximately 100%
        total_percentage = sum(s["percentOfCycleTime"] for s in sprint_data["statusBreakdown"])
        assert 99.0 <= total_percentage <= 101.0  # Allow for rounding

    def test_handles_empty_sprint(self, mock_jira_credentials):
        """Should handle sprint with no issues gracefully."""
        service = SprintMetricsService(**mock_jira_credentials)

        sprints = [{
            "id": 1,
            "name": "Sprint 1",
            "startDate": "2024-01-01T00:00:00.000+0000",
            "endDate": "2024-01-14T00:00:00.000+0000"
        }]
        sprint_issues = {1: []}

        # Mock the historical query to return our test issues
        service._get_sprint_issues_historical = lambda sprint_id: sprint_issues.get(sprint_id, [])

        result = service._calculate_time_in_status(sprints, sprint_issues)

        sprint_data = result["sprints"][0]
        assert sprint_data["statusBreakdown"] == []
        assert sprint_data["bottleneckStatus"] is None
        assert sprint_data["totalCycleTimeHours"] == 0


class TestPublicMethods:
    """Test public API methods."""

    def test_get_velocity_metrics_calls_prefetch(self, mock_jira_credentials):
        """get_velocity_metrics should prefetch data and calculate."""
        service = SprintMetricsService(**mock_jira_credentials)

        mock_sprints = [{"id": 1, "name": "Sprint 1"}]
        mock_issues = {1: []}

        with patch.object(service, '_prefetch_all_data', return_value=(mock_sprints, mock_issues)) as mock_prefetch:
            with patch.object(service, '_calculate_velocity', return_value={"test": True}) as mock_calc:
                result = service.get_velocity_metrics(123)

        mock_prefetch.assert_called_once()
        mock_calc.assert_called_once()
        assert result == {"test": True}

    def test_get_time_in_status_metrics_calls_prefetch(self, mock_jira_credentials):
        """get_time_in_status_metrics should prefetch data and calculate."""
        service = SprintMetricsService(**mock_jira_credentials)

        mock_sprints = [{"id": 1, "name": "Sprint 1"}]
        mock_issues = {1: []}

        with patch.object(service, '_prefetch_all_data', return_value=(mock_sprints, mock_issues)) as mock_prefetch:
            with patch.object(service, '_calculate_time_in_status', return_value={"test": True}) as mock_calc:
                result = service.get_time_in_status_metrics(123)

        mock_prefetch.assert_called_once()
        mock_calc.assert_called_once()
        assert result == {"test": True}

    def test_get_all_metrics_returns_combined(self, mock_jira_credentials):
        """get_all_metrics should return all metric types."""
        service = SprintMetricsService(**mock_jira_credentials)

        mock_sprints = [{"id": 1, "name": "Sprint 1"}]
        mock_issues = {1: []}

        with patch.object(service, '_prefetch_all_data', return_value=(mock_sprints, mock_issues)):
            with patch.object(service, '_calculate_velocity', return_value={"velocity": True}):
                with patch.object(service, '_calculate_completion', return_value={"completion": True}):
                    with patch.object(service, '_calculate_quality', return_value={"quality": True}):
                        with patch.object(service, '_calculate_alignment', return_value={"alignment": True}):
                            with patch.object(service, '_calculate_coverage', return_value={"coverage": True}):
                                result = service.get_all_metrics(123)

        assert "velocity" in result
        assert "completion" in result
        assert "quality" in result
        assert "alignment" in result
        assert "coverage" in result
