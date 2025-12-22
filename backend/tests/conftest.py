"""Shared fixtures for Sprint Analyzer tests."""

import pytest
from datetime import datetime, timedelta


@pytest.fixture
def mock_jira_credentials():
    """Mock Jira credentials for testing."""
    return {
        "server": "https://test.atlassian.net",
        "email": "test@example.com",
        "token": "test-token-123"
    }


@pytest.fixture
def sample_sprint():
    """Sample sprint data."""
    return {
        "id": 100,
        "name": "Sprint 1",
        "state": "closed",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-01-14T00:00:00.000Z",
        "goal": "Complete feature X"
    }


@pytest.fixture
def sample_sprints():
    """Multiple sample sprints for testing."""
    return [
        {
            "id": 103,
            "name": "Sprint 4",
            "state": "closed",
            "startDate": "2024-02-12T00:00:00.000Z",
            "endDate": "2024-02-25T00:00:00.000Z"
        },
        {
            "id": 102,
            "name": "Sprint 3",
            "state": "closed",
            "startDate": "2024-01-29T00:00:00.000Z",
            "endDate": "2024-02-11T00:00:00.000Z"
        },
        {
            "id": 101,
            "name": "Sprint 2",
            "state": "closed",
            "startDate": "2024-01-15T00:00:00.000Z",
            "endDate": "2024-01-28T00:00:00.000Z"
        },
        {
            "id": 100,
            "name": "Sprint 1",
            "state": "closed",
            "startDate": "2024-01-01T00:00:00.000Z",
            "endDate": "2024-01-14T00:00:00.000Z"
        }
    ]


@pytest.fixture
def sample_issue_completed():
    """Sample completed issue with story points."""
    return {
        "key": "PROJ-123",
        "fields": {
            "summary": "Implement feature X",
            "issuetype": {"name": "Story", "subtask": False},
            "status": {"name": "Done"},
            "resolution": {"name": "Done"},
            "created": "2024-01-02T10:00:00.000Z",
            "resolutiondate": "2024-01-10T15:30:00.000Z",
            "customfield_10002": 5.0,
            "parent": {
                "key": "PROJ-50",
                "fields": {
                    "summary": "Epic: Feature X",
                    "issuetype": {"name": "Epic"}
                }
            }
        }
    }


@pytest.fixture
def sample_issue_incomplete():
    """Sample incomplete issue."""
    return {
        "key": "PROJ-124",
        "fields": {
            "summary": "Fix bug Y",
            "issuetype": {"name": "Bug", "subtask": False},
            "status": {"name": "In Progress"},
            "resolution": None,
            "created": "2024-01-05T10:00:00.000Z",
            "resolutiondate": None,
            "customfield_10002": 3.0
        }
    }


@pytest.fixture
def sample_issue_no_points():
    """Sample issue without story points."""
    return {
        "key": "PROJ-125",
        "fields": {
            "summary": "Research task",
            "issuetype": {"name": "Task", "subtask": False},
            "status": {"name": "Done"},
            "resolution": {"name": "Done"},
            "created": "2024-01-03T10:00:00.000Z",
            "resolutiondate": "2024-01-08T12:00:00.000Z"
        }
    }


@pytest.fixture
def sample_bug_completed():
    """Sample completed bug."""
    return {
        "key": "PROJ-126",
        "fields": {
            "summary": "Fix login issue",
            "issuetype": {"name": "Bug", "subtask": False},
            "status": {"name": "Done"},
            "resolution": {"name": "Done"},
            "created": "2024-01-04T10:00:00.000Z",
            "resolutiondate": "2024-01-06T14:00:00.000Z",
            "customfield_10002": 2.0
        }
    }


@pytest.fixture
def sample_subtask_with_points():
    """Sample subtask with story points."""
    return {
        "key": "PROJ-127",
        "fields": {
            "summary": "Implement API endpoint",
            "issuetype": {"name": "Sub-task", "subtask": True},
            "status": {"name": "Done"},
            "resolution": {"name": "Done"},
            "created": "2024-01-02T11:00:00.000Z",
            "resolutiondate": "2024-01-04T16:00:00.000Z",
            "customfield_10002": 2.0,
            "parent": {
                "key": "PROJ-123",
                "fields": {
                    "summary": "Implement feature X",
                    "issuetype": {"name": "Story"}
                }
            }
        }
    }


@pytest.fixture
def sample_subtask_no_points():
    """Sample subtask without points (should be skipped)."""
    return {
        "key": "PROJ-128",
        "fields": {
            "summary": "Write tests",
            "issuetype": {"name": "Sub-task", "subtask": True},
            "status": {"name": "Done"},
            "resolution": {"name": "Done"},
            "created": "2024-01-02T12:00:00.000Z",
            "resolutiondate": "2024-01-05T10:00:00.000Z",
            "parent": {
                "key": "PROJ-123"
            }
        }
    }


@pytest.fixture
def sample_sprint_issues(sample_issue_completed, sample_issue_incomplete,
                         sample_bug_completed, sample_issue_no_points):
    """Collection of issues for a sprint."""
    return [
        sample_issue_completed,
        sample_issue_incomplete,
        sample_bug_completed,
        sample_issue_no_points
    ]


@pytest.fixture
def mock_fields_response():
    """Mock response for Jira fields endpoint."""
    return [
        {"id": "customfield_10002", "name": "Story Points", "schema": {"type": "number"}},
        {"id": "customfield_10016", "name": "Story point estimate", "schema": {"type": "number"}},
        {"id": "summary", "name": "Summary", "schema": {"type": "string"}},
        {"id": "status", "name": "Status", "schema": {"type": "status"}}
    ]


@pytest.fixture
def app():
    """Create Flask test app."""
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

    from app import create_app
    app = create_app()
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    """Create Flask test client."""
    return app.test_client()


@pytest.fixture
def sample_issue_with_changelog():
    """Sample UNRESOLVED issue with status change history for bottleneck analysis."""
    return {
        "key": "PROJ-200",
        "fields": {
            "summary": "Feature with status changes",
            "issuetype": {"name": "Story", "subtask": False},
            "status": {"name": "Code Review"},  # Currently in Code Review (unresolved)
            "resolution": None,  # Not resolved - still in progress
            "created": "2024-01-02T09:00:00.000+0000",
            "resolutiondate": None,
            "customfield_10002": 5.0,
            "changelog": {
                "histories": [
                    {
                        "created": "2024-01-02T09:00:00.000+0000",
                        "items": [
                            {
                                "field": "status",
                                "fromString": None,
                                "toString": "To Do"
                            }
                        ]
                    },
                    {
                        "created": "2024-01-03T10:00:00.000+0000",
                        "items": [
                            {
                                "field": "status",
                                "fromString": "To Do",
                                "toString": "In Progress"
                            }
                        ]
                    },
                    {
                        "created": "2024-01-05T14:00:00.000+0000",
                        "items": [
                            {
                                "field": "status",
                                "fromString": "In Progress",
                                "toString": "Code Review"
                            }
                        ]
                    }
                ]
            }
        }
    }


@pytest.fixture
def sample_issue_no_changelog():
    """Sample UNRESOLVED issue without changelog (stayed in one status)."""
    return {
        "key": "PROJ-201",
        "fields": {
            "summary": "Quick fix",
            "issuetype": {"name": "Bug", "subtask": False},
            "status": {"name": "In Progress"},  # Currently in progress
            "resolution": None,  # Not resolved
            "created": "2024-01-05T09:00:00.000+0000",
            "resolutiondate": None,
            "customfield_10002": 2.0,
            "changelog": {"histories": []}
        }
    }


@pytest.fixture
def sample_issue_multiple_transitions():
    """Sample UNRESOLVED issue that went back and forth between statuses."""
    return {
        "key": "PROJ-202",
        "fields": {
            "summary": "Issue with rework",
            "issuetype": {"name": "Story", "subtask": False},
            "status": {"name": "In Progress"},  # Currently back in progress
            "resolution": None,  # Not resolved
            "created": "2024-01-02T08:00:00.000+0000",
            "resolutiondate": None,
            "customfield_10002": 3.0,
            "changelog": {
                "histories": [
                    {
                        "created": "2024-01-03T09:00:00.000+0000",
                        "items": [{"field": "status", "fromString": "To Do", "toString": "In Progress"}]
                    },
                    {
                        "created": "2024-01-05T10:00:00.000+0000",
                        "items": [{"field": "status", "fromString": "In Progress", "toString": "Code Review"}]
                    },
                    {
                        "created": "2024-01-06T11:00:00.000+0000",
                        "items": [{"field": "status", "fromString": "Code Review", "toString": "In Progress"}]
                    }
                ]
            }
        }
    }
