"""Sprint metrics calculation service."""

from datetime import datetime
from typing import Optional
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed


class SprintMetricsService:
    """Service for calculating sprint metrics from Jira data."""

    def __init__(self, server: str, email: str, token: str):
        self.server = server.rstrip("/")
        self.email = email
        self.token = token
        self._story_points_fields_cache = None
        self._sprints_cache = {}
        self._issues_cache = {}

    def _request(self, endpoint: str, params: Optional[dict] = None):
        """Make authenticated request to Jira API."""
        response = requests.get(
            f"{self.server}{endpoint}",
            auth=(self.email, self.token),
            headers={"Accept": "application/json"},
            params=params,
            timeout=30
        )
        response.raise_for_status()
        return response.json()

    def _get_story_points_fields(self) -> list:
        """Find all possible story points custom field IDs."""
        if self._story_points_fields_cache is not None:
            return self._story_points_fields_cache

        fields = self._request("/rest/api/3/field")
        sp_fields = []

        for field in fields:
            name = field.get("name", "")
            name_lower = name.lower()
            field_id = field.get("id", "")
            field_type = field.get("schema", {}).get("type")

            if field_type != "number":
                continue

            if name == "Story Points":
                sp_fields.insert(0, field_id)
            elif name_lower == "story points":
                sp_fields.append(field_id)
            elif "story point" in name_lower:
                sp_fields.append(field_id)

        for fallback in ["customfield_10002", "customfield_10016", "customfield_10020"]:
            if fallback not in sp_fields:
                sp_fields.append(fallback)

        self._story_points_fields_cache = sp_fields
        return sp_fields

    def _get_sprints(self, board_id: int, limit: int = 6) -> list:
        """Get the last N completed sprints for a board."""
        cache_key = f"{board_id}_{limit}"
        if cache_key in self._sprints_cache:
            return self._sprints_cache[cache_key]

        # Paginate through all closed sprints
        all_sprints = []
        start_at = 0
        max_results = 50

        while True:
            data = self._request(
                f"/rest/agile/1.0/board/{board_id}/sprint",
                params={"state": "closed", "startAt": start_at, "maxResults": max_results}
            )

            sprints = data.get("values", [])
            all_sprints.extend(sprints)

            if len(sprints) < max_results:
                break

            start_at += max_results

        all_sprints.sort(key=lambda s: s.get("endDate", ""), reverse=True)
        result = all_sprints[:limit]
        self._sprints_cache[cache_key] = result
        return result

    def _get_sprint_issues(self, sprint_id: int) -> list:
        """Get all issues in a sprint."""
        if sprint_id in self._issues_cache:
            return self._issues_cache[sprint_id]

        sp_fields = self._get_story_points_fields()

        base_fields = [
            "summary", "issuetype", "status", "resolution",
            "created", "resolutiondate", "parent", "changelog"
        ]
        for sp_field in sp_fields:
            if sp_field not in base_fields:
                base_fields.append(sp_field)

        all_issues = []
        start_at = 0
        max_results = 100

        while True:
            data = self._request(
                f"/rest/agile/1.0/sprint/{sprint_id}/issue",
                params={
                    "startAt": start_at,
                    "maxResults": max_results,
                    "fields": ",".join(base_fields)
                }
            )

            issues = data.get("issues", [])
            all_issues.extend(issues)

            if len(issues) < max_results:
                break

            start_at += max_results

        self._issues_cache[sprint_id] = all_issues
        return all_issues

    def _prefetch_all_data(self, board_id: int) -> tuple:
        """Fetch all sprints and their issues upfront in parallel."""
        # Get sprints first
        sprints = self._get_sprints(board_id)

        # Fetch issues for all sprints in parallel
        sprint_issues = {}

        def fetch_sprint_issues(sprint):
            sprint_id = sprint["id"]
            issues = self._get_sprint_issues(sprint_id)
            return sprint_id, issues

        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(fetch_sprint_issues, s): s for s in sprints}
            for future in as_completed(futures):
                sprint_id, issues = future.result()
                sprint_issues[sprint_id] = issues

        return sprints, sprint_issues

    def _get_story_points(self, issue: dict) -> Optional[float]:
        """Extract story points from an issue."""
        fields = issue.get("fields", {})

        for field_id in self._get_story_points_fields():
            points = fields.get(field_id)
            if points is not None:
                try:
                    return float(points)
                except (TypeError, ValueError):
                    pass

        return None

    def _is_completed(self, issue: dict) -> bool:
        """Check if an issue is completed (resolved)."""
        fields = issue.get("fields", {})
        resolution = fields.get("resolution")
        return resolution is not None

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse Jira date string."""
        if not date_str:
            return None

        # Jira formats: "2024-10-31T12:11:56.289-0400" or "2024-10-31T12:11:56.289+0000"
        # Python's %z expects timezone like -0400, which Jira provides
        formats = [
            "%Y-%m-%dT%H:%M:%S.%f%z",  # With milliseconds and timezone
            "%Y-%m-%dT%H:%M:%S%z",      # Without milliseconds, with timezone
            "%Y-%m-%dT%H:%M:%S.%f",     # With milliseconds, no timezone
            "%Y-%m-%dT%H:%M:%S",        # Basic ISO format
            "%Y-%m-%d"                   # Date only
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    def _calculate_velocity(self, sprints: list, sprint_issues: dict) -> dict:
        """Calculate velocity metrics from prefetched data."""
        sprint_velocities = []

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            total_points = 0
            for issue in issues:
                if self._is_completed(issue):
                    points = self._get_story_points(issue)
                    if points:
                        total_points += points

            sprint_velocities.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "completedPoints": total_points
            })

        velocities = [s["completedPoints"] for s in sprint_velocities]
        avg_velocity = sum(velocities) / len(velocities) if velocities else 0

        return {
            "sprints": sprint_velocities,
            "averageVelocity": round(avg_velocity, 1),
            "totalSprints": len(sprint_velocities)
        }

    def _calculate_completion(self, sprints: list, sprint_issues: dict) -> dict:
        """Calculate completion metrics from prefetched data."""
        sprint_completions = []

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            committed_count = len(issues)
            completed_count = sum(1 for issue in issues if self._is_completed(issue))

            completion_rate = (completed_count / committed_count * 100) if committed_count > 0 else 0

            sprint_completions.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "committed": committed_count,
                "completed": completed_count,
                "completionRate": round(completion_rate, 1),
                "midSprintAdditions": 0,  # TODO: Implement via changelog
                "midSprintPoints": 0
            })

        rates = [s["completionRate"] for s in sprint_completions]
        avg_rate = sum(rates) / len(rates) if rates else 0

        return {
            "sprints": sprint_completions,
            "averageCompletionRate": round(avg_rate, 1)
        }

    def _calculate_quality(self, sprints: list, sprint_issues: dict) -> dict:
        """Calculate quality metrics from prefetched data."""
        sprint_quality = []

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            total_issues = len(issues)
            completed_issues = 0
            bug_count = 0
            completed_bugs = 0
            total_age_days = 0
            age_count = 0

            for issue in issues:
                fields = issue.get("fields", {})
                issue_type = fields.get("issuetype", {}).get("name", "").lower()

                if self._is_completed(issue):
                    completed_issues += 1

                    if "bug" in issue_type:
                        completed_bugs += 1

                    created = self._parse_date(fields.get("created"))
                    resolved = self._parse_date(fields.get("resolutiondate"))

                    if created and resolved:
                        age_days = (resolved - created).days
                        total_age_days += age_days
                        age_count += 1

                if "bug" in issue_type:
                    bug_count += 1

            incomplete_pct = ((total_issues - completed_issues) / total_issues * 100) if total_issues > 0 else 0
            bug_ratio = (completed_bugs / completed_issues * 100) if completed_issues > 0 else 0
            avg_age = total_age_days / age_count if age_count > 0 else 0

            sprint_quality.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "totalIssues": total_issues,
                "completedIssues": completed_issues,
                "incompletePercentage": round(incomplete_pct, 1),
                "bugCount": bug_count,
                "completedBugs": completed_bugs,
                "bugRatio": round(bug_ratio, 1),
                "averageTicketAgeDays": round(avg_age, 1)
            })

        return {"sprints": sprint_quality}

    def _calculate_alignment(self, sprints: list, sprint_issues: dict, initiative_boards: list) -> dict:
        """Calculate strategic alignment metrics from prefetched data."""
        sprint_alignment = []

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            total_completed = 0
            linked_to_epic = 0

            for issue in issues:
                if self._is_completed(issue):
                    total_completed += 1

                    fields = issue.get("fields", {})
                    parent = fields.get("parent")
                    if parent:
                        linked_to_epic += 1

            linked_pct = (linked_to_epic / total_completed * 100) if total_completed > 0 else 0

            sprint_alignment.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "totalCompleted": total_completed,
                "linkedToEpic": linked_to_epic,
                "initiativeLinkedPercentage": round(linked_pct, 1),
                "orphanPercentage": round(100 - linked_pct, 1)
            })

        return {
            "sprints": sprint_alignment,
            "initiativeBoards": initiative_boards
        }

    def _calculate_coverage(self, sprints: list, sprint_issues: dict) -> dict:
        """Calculate story point coverage metrics from prefetched data."""
        sprint_coverage = []
        all_points = []

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            with_points = 0
            without_points = 0

            for issue in issues:
                points = self._get_story_points(issue)
                if points is not None:
                    with_points += 1
                    all_points.append(points)
                else:
                    without_points += 1

            total = with_points + without_points
            coverage_pct = (with_points / total * 100) if total > 0 else 0

            sprint_coverage.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "withPoints": with_points,
                "withoutPoints": without_points,
                "coveragePercentage": round(coverage_pct, 1)
            })

        fallback_avg = sum(all_points) / len(all_points) if all_points else 0

        return {
            "sprints": sprint_coverage,
            "fallbackAveragePoints": round(fallback_avg, 1)
        }

    # Public methods - these can still be called individually if needed
    def get_velocity_metrics(self, board_id: int) -> dict:
        """Calculate velocity metrics for last 6 sprints."""
        sprints, sprint_issues = self._prefetch_all_data(board_id)
        return self._calculate_velocity(sprints, sprint_issues)

    def get_completion_metrics(self, board_id: int) -> dict:
        """Calculate completion metrics for last 6 sprints."""
        sprints, sprint_issues = self._prefetch_all_data(board_id)
        return self._calculate_completion(sprints, sprint_issues)

    def get_quality_metrics(self, board_id: int) -> dict:
        """Calculate quality metrics for last 6 sprints."""
        sprints, sprint_issues = self._prefetch_all_data(board_id)
        return self._calculate_quality(sprints, sprint_issues)

    def get_alignment_metrics(self, board_id: int, initiative_boards: list) -> dict:
        """Calculate strategic alignment metrics."""
        sprints, sprint_issues = self._prefetch_all_data(board_id)
        return self._calculate_alignment(sprints, sprint_issues, initiative_boards)

    def get_coverage_metrics(self, board_id: int) -> dict:
        """Calculate story point coverage metrics."""
        sprints, sprint_issues = self._prefetch_all_data(board_id)
        return self._calculate_coverage(sprints, sprint_issues)

    def get_all_metrics(self, board_id: int, initiative_boards: list) -> dict:
        """Get all metrics combined for dashboard - single fetch, parallel processing."""
        # Single prefetch of all data
        sprints, sprint_issues = self._prefetch_all_data(board_id)

        # Calculate all metrics from the same dataset
        return {
            "velocity": self._calculate_velocity(sprints, sprint_issues),
            "completion": self._calculate_completion(sprints, sprint_issues),
            "quality": self._calculate_quality(sprints, sprint_issues),
            "alignment": self._calculate_alignment(sprints, sprint_issues, initiative_boards),
            "coverage": self._calculate_coverage(sprints, sprint_issues)
        }
