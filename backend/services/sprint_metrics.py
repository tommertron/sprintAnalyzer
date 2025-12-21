"""Sprint metrics calculation service."""

from datetime import datetime, timedelta
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

    def _get_sprints(self, board_id: int, limit: int = 6,
                     start_date: str = None, end_date: str = None,
                     sprint_count: int = None) -> list:
        """Get completed sprints for a board.

        Args:
            board_id: Jira board ID
            limit: Number of sprints to return (default 6, ignored if date range or sprint_count provided)
            start_date: Optional ISO date string (e.g., "2024-01-01") - filter sprints ending on or after
            end_date: Optional ISO date string (e.g., "2024-03-31") - filter sprints ending on or before
            sprint_count: Optional number of sprints to include (overrides limit)
        """
        # Use sprint_count if provided, otherwise use limit
        effective_limit = sprint_count if sprint_count else limit
        cache_key = f"{board_id}_{effective_limit}_{start_date}_{end_date}"
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

        # Apply date range filter if provided
        if start_date or end_date:
            filtered = []
            for sprint in all_sprints:
                sprint_end = sprint.get("endDate", "")[:10]  # Get YYYY-MM-DD portion
                if start_date and sprint_end < start_date:
                    continue
                if end_date and sprint_end > end_date:
                    continue
                filtered.append(sprint)
            result = filtered
        else:
            result = all_sprints[:effective_limit]

        self._sprints_cache[cache_key] = result
        return result

    def _get_sprint_issues(self, sprint_id: int, include_assignee: bool = False) -> list:
        """Get all issues in a sprint."""
        if sprint_id in self._issues_cache:
            return self._issues_cache[sprint_id]

        sp_fields = self._get_story_points_fields()

        base_fields = [
            "summary", "issuetype", "status", "resolution",
            "created", "resolutiondate", "parent", "changelog", "assignee"
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

    def _prefetch_all_data(self, board_id: int,
                           start_date: str = None, end_date: str = None,
                           sprint_count: int = None) -> tuple:
        """Fetch all sprints and their issues upfront in parallel."""
        # Get sprints first
        sprints = self._get_sprints(board_id, start_date=start_date, end_date=end_date, sprint_count=sprint_count)

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

    def _get_issue_parent(self, issue_key: str) -> Optional[dict]:
        """Fetch an issue's parent (if any).

        Returns:
            Dict with parent info or None
        """
        cache_key = f"parent_{issue_key}"
        if cache_key in self._issues_cache:
            return self._issues_cache[cache_key]

        try:
            data = self._request(
                f"/rest/api/3/issue/{issue_key}",
                params={"fields": "parent"}
            )
            parent = data.get("fields", {}).get("parent")
            if parent:
                result = {
                    "key": parent.get("key"),
                    "summary": parent.get("fields", {}).get("summary", ""),
                    "projectKey": parent.get("key", "").split("-")[0] if parent.get("key") else None,
                    "issueType": parent.get("fields", {}).get("issuetype", {}).get("name", "")
                }
            else:
                result = None

            self._issues_cache[cache_key] = result
            return result
        except Exception:
            self._issues_cache[cache_key] = None
            return None

    def _get_issue_labels(self, issue_key: str) -> list:
        """Fetch an issue's labels.

        Returns:
            List of label strings
        """
        cache_key = f"labels_{issue_key}"
        if cache_key in self._issues_cache:
            return self._issues_cache[cache_key]

        try:
            data = self._request(
                f"/rest/api/3/issue/{issue_key}",
                params={"fields": "labels"}
            )
            labels = data.get("fields", {}).get("labels", [])
            self._issues_cache[cache_key] = labels
            return labels
        except Exception:
            self._issues_cache[cache_key] = []
            return []

    def _batch_fetch_issue_details(self, issue_keys: set, fields: str = "summary,issuetype") -> dict:
        """Batch fetch issue details in parallel.

        Args:
            issue_keys: Set of issue keys to fetch
            fields: Comma-separated list of fields to retrieve

        Returns:
            Dict mapping issue_key to issue details
        """
        if not issue_keys:
            return {}

        results = {}
        uncached = []
        cache_prefix = f"details_{fields}_"

        for key in issue_keys:
            cache_key = f"{cache_prefix}{key}"
            if cache_key in self._issues_cache:
                results[key] = self._issues_cache[cache_key]
            else:
                uncached.append(key)

        if not uncached:
            return results

        def fetch_issue(issue_key):
            try:
                data = self._request(
                    f"/rest/api/3/issue/{issue_key}",
                    params={"fields": fields}
                )
                result = {
                    "key": issue_key,
                    "summary": data.get("fields", {}).get("summary", ""),
                    "issueType": data.get("fields", {}).get("issuetype", {}).get("name", "")
                }
                cache_key = f"{cache_prefix}{issue_key}"
                self._issues_cache[cache_key] = result
                return issue_key, result
            except Exception:
                result = {"key": issue_key, "summary": "", "issueType": "Unknown"}
                return issue_key, result

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_issue, key): key for key in uncached}
            for future in as_completed(futures):
                issue_key, details = future.result()
                results[issue_key] = details

        return results

    def _batch_fetch_labels(self, issue_keys: set) -> dict:
        """Batch fetch labels for multiple issues in parallel.

        Args:
            issue_keys: Set of issue keys to fetch labels for

        Returns:
            Dict mapping issue_key to list of labels
        """
        if not issue_keys:
            return {}

        results = {}
        uncached = []

        for key in issue_keys:
            cache_key = f"labels_{key}"
            if cache_key in self._issues_cache:
                results[key] = self._issues_cache[cache_key]
            else:
                uncached.append(key)

        if not uncached:
            return results

        def fetch_labels(issue_key):
            try:
                data = self._request(
                    f"/rest/api/3/issue/{issue_key}",
                    params={"fields": "labels"}
                )
                labels = data.get("fields", {}).get("labels", [])
                self._issues_cache[f"labels_{issue_key}"] = labels
                return issue_key, labels
            except Exception:
                self._issues_cache[f"labels_{issue_key}"] = []
                return issue_key, []

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_labels, key): key for key in uncached}
            for future in as_completed(futures):
                issue_key, labels = future.result()
                results[issue_key] = labels

        return results

    def _batch_fetch_parents(self, issue_keys: set) -> dict:
        """Batch fetch parent info for multiple issues in parallel.

        Args:
            issue_keys: Set of issue keys to fetch parents for

        Returns:
            Dict mapping issue_key to parent info (or None)
        """
        if not issue_keys:
            return {}

        results = {}
        uncached = []

        for key in issue_keys:
            cache_key = f"parent_{key}"
            if cache_key in self._issues_cache:
                results[key] = self._issues_cache[cache_key]
            else:
                uncached.append(key)

        if not uncached:
            return results

        def fetch_parent(issue_key):
            parent = self._get_issue_parent(issue_key)
            return issue_key, parent

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_parent, key): key for key in uncached}
            for future in as_completed(futures):
                issue_key, parent = future.result()
                results[issue_key] = parent

        return results

    def _get_initiative_from_parent(self, parent_key: str, is_subtask_parent: bool = False) -> Optional[dict]:
        """Traverse up from a parent to find the Initiative.

        For regular issues (Story/Bug/Task): parent is Epic, so we get Epic's parent (Initiative) - 1 hop
        For sub-tasks: parent is Story, so we need Story → Epic → Initiative - 2 hops

        Args:
            parent_key: The direct parent's issue key
            is_subtask_parent: If True, parent is a Story (need extra level)

        Returns:
            Dict with initiative info or None if not found
        """
        if is_subtask_parent:
            # Sub-task path: parent_key is Story
            # Need: Story → Epic → Initiative (2 hops)
            epic = self._get_issue_parent(parent_key)  # Story → Epic
            if not epic:
                return None
            initiative = self._get_issue_parent(epic["key"])  # Epic → Initiative
            return initiative
        else:
            # Regular path: parent_key is Epic
            # Need: Epic → Initiative (1 hop)
            initiative = self._get_issue_parent(parent_key)  # Epic → Initiative
            return initiative

    def _get_initiatives_batch(self, parent_keys_info: list) -> dict:
        """Fetch initiatives for multiple parent keys.

        Args:
            parent_keys_info: List of tuples (parent_key, is_subtask_parent)

        Returns:
            Dict mapping parent key to initiative info
        """
        if not parent_keys_info:
            return {}

        results = {}
        uncached = []

        for parent_key, is_subtask in parent_keys_info:
            cache_key = f"initiative_{parent_key}_{is_subtask}"
            if cache_key in self._issues_cache:
                cached = self._issues_cache[cache_key]
                if cached is not None:
                    results[parent_key] = cached
            else:
                uncached.append((parent_key, is_subtask))

        if not uncached:
            return results

        def fetch_initiative(item):
            parent_key, is_subtask = item
            initiative = self._get_initiative_from_parent(parent_key, is_subtask)
            cache_key = f"initiative_{parent_key}_{is_subtask}"
            self._issues_cache[cache_key] = initiative
            return parent_key, initiative

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_initiative, item): item for item in uncached}
            for future in as_completed(futures):
                parent_key, initiative = future.result()
                if initiative:
                    results[parent_key] = initiative

        return results

    def _calculate_alignment(self, sprints: list, sprint_issues: dict, excluded_spaces: list = None, service_label: str = None) -> dict:
        """Calculate strategic alignment metrics by finding the Initiative for each issue.

        Hierarchy handling:
        - Story/Bug/Task: Story → Epic → Initiative (2 levels up)
        - Sub-task WITH points: Sub-task → Story → Epic → Initiative (3 levels up)
        - Sub-task WITHOUT points: Skip entirely (parent story covers it)

        Uses story points for calculations (with fallback average for unpointed).

        Args:
            sprints: List of sprint data
            sprint_issues: Dict mapping sprint ID to issues
            excluded_spaces: List of project keys to exclude from alignment calculations
            service_label: Label that marks initiatives as "service" investment (optional)
        """
        excluded_spaces = excluded_spaces or []
        excluded_set = set(excluded_spaces)

        # Calculate fallback average from all completed NON-subtask issues with points
        all_points = []
        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])
            for issue in issues:
                if self._is_completed(issue):
                    is_subtask = issue.get("fields", {}).get("issuetype", {}).get("subtask", False)
                    if not is_subtask:
                        points = self._get_story_points(issue)
                        if points is not None:
                            all_points.append(points)
        fallback_avg = sum(all_points) / len(all_points) if all_points else 1.0

        # First pass: collect parent keys and track if they're from sub-tasks
        # Key: (parent_key, is_subtask) to handle different traversal depths
        parent_info = {}  # parent_key -> is_subtask (True if any sub-task uses it)
        issues_to_process = []  # (issue, points, parent_key, is_subtask, sprint_id)

        # Track seen issues to avoid double-counting across sprints
        seen_issue_keys = set()

        # Track which stories have pointed sub-tasks (so we don't double-count)
        stories_with_pointed_subtasks = set()

        # First, identify stories that have pointed sub-tasks
        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])
            for issue in issues:
                if not self._is_completed(issue):
                    continue
                fields = issue.get("fields", {})
                is_subtask = fields.get("issuetype", {}).get("subtask", False)
                if is_subtask:
                    points = self._get_story_points(issue)
                    if points is not None:
                        # This sub-task has points - mark its parent story
                        parent = fields.get("parent")
                        if parent and parent.get("key"):
                            stories_with_pointed_subtasks.add(parent.get("key"))

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])
            for issue in issues:
                if not self._is_completed(issue):
                    continue

                issue_key = issue.get("key")

                # Skip if we've already processed this issue (prevents double-counting)
                if issue_key in seen_issue_keys:
                    continue
                seen_issue_keys.add(issue_key)

                fields = issue.get("fields", {})
                issue_type_obj = fields.get("issuetype", {})
                # Jira's issuetype has a 'subtask' boolean field
                is_subtask = issue_type_obj.get("subtask", False)

                # Get points
                points = self._get_story_points(issue)

                # Skip sub-tasks without points (parent story covers them)
                if is_subtask and points is None:
                    continue

                # Skip stories/tasks that have pointed sub-tasks (sub-tasks cover them)
                if not is_subtask and issue_key in stories_with_pointed_subtasks:
                    continue

                # Use fallback for non-subtasks without points
                if points is None:
                    points = fallback_avg

                parent = fields.get("parent")
                if parent and parent.get("key"):
                    parent_key = parent.get("key")
                    # Track this parent and whether it comes from a sub-task
                    if parent_key not in parent_info:
                        parent_info[parent_key] = is_subtask
                    issues_to_process.append((issue, points, parent_key, is_subtask, sprint["id"]))
                else:
                    # No parent - orphan
                    issues_to_process.append((issue, points, None, is_subtask, sprint["id"]))

        # Batch fetch initiatives - need to handle sub-task parents differently
        parent_keys_info = [(key, is_sub) for key, is_sub in parent_info.items()]
        parent_to_initiative = self._get_initiatives_batch(parent_keys_info)

        # Track discovered spaces with full hierarchy for debugging
        # Structure: projectKey -> {initiatives: {init_key -> {summary, points, epics: {epic_key -> {summary, points, issues: []}}}}}
        discovered_spaces = {}

        # Aggregate points by sprint
        sprint_totals = {}  # sprint_id -> {total, linked, orphan, service, business}
        for sprint in sprints:
            sprint_totals[sprint["id"]] = {"total": 0.0, "linked": 0.0, "orphan": 0.0, "service": 0.0, "business": 0.0}

        # Collect all story parent keys that need parent lookups (for sub-tasks)
        story_parent_keys = set()
        for issue, points, parent_key, is_subtask, sprint_id in issues_to_process:
            if parent_key and is_subtask:
                story_parent_keys.add(parent_key)

        # Batch fetch story parents in parallel to get epic keys
        story_parents = self._batch_fetch_parents(story_parent_keys)

        # Build story_to_epic mapping and collect all epic keys
        epic_keys_to_fetch = set()
        story_to_epic = {}  # For sub-tasks: story_key -> epic_key

        for issue, points, parent_key, is_subtask, sprint_id in issues_to_process:
            if parent_key:
                if is_subtask:
                    story_parent = story_parents.get(parent_key)
                    if story_parent:
                        epic_key = story_parent["key"]
                        story_to_epic[parent_key] = epic_key
                        epic_keys_to_fetch.add(epic_key)
                else:
                    # parent_key is already the Epic
                    epic_keys_to_fetch.add(parent_key)

        # Batch fetch epic details in parallel
        epic_details = self._batch_fetch_issue_details(epic_keys_to_fetch)

        # Collect all initiative keys for label pre-fetching
        initiative_keys = set()
        for parent_key in parent_to_initiative:
            init = parent_to_initiative[parent_key]
            if init:
                initiative_keys.add(init["key"])

        # Batch fetch initiative labels in parallel
        initiative_labels = self._batch_fetch_labels(initiative_keys)

        # Collect all story keys for sub-task parents (for hierarchy display)
        story_keys_for_details = set(story_to_epic.keys())

        # Batch fetch story details in parallel
        story_details = self._batch_fetch_issue_details(story_keys_for_details)

        # Process all issues and build full hierarchy
        for issue, points, parent_key, is_subtask, sprint_id in issues_to_process:
            sprint_totals[sprint_id]["total"] += points

            if parent_key:
                initiative = parent_to_initiative.get(parent_key)

                if initiative:
                    project_key = initiative["projectKey"]

                    # Track in discovered spaces with full hierarchy
                    if project_key not in discovered_spaces:
                        discovered_spaces[project_key] = {
                            "projectKey": project_key,
                            "initiatives": {}
                        }

                    init_key = initiative["key"]
                    if init_key not in discovered_spaces[project_key]["initiatives"]:
                        # Use pre-fetched labels
                        init_labels = initiative_labels.get(init_key, [])
                        discovered_spaces[project_key]["initiatives"][init_key] = {
                            "key": init_key,
                            "summary": initiative["summary"],
                            "issueType": initiative["issueType"],
                            "points": 0.0,
                            "labels": init_labels,
                            "epics": {}  # epic_key -> {details, issues: []}
                        }

                    init_data = discovered_spaces[project_key]["initiatives"][init_key]
                    init_data["points"] += points

                    # Track service vs business points based on labels
                    is_service = service_label and service_label in init_data.get("labels", [])
                    if project_key not in excluded_set:
                        if is_service:
                            sprint_totals[sprint_id]["service"] += points
                        else:
                            sprint_totals[sprint_id]["business"] += points

                    # Determine the epic key
                    if is_subtask:
                        epic_key = story_to_epic.get(parent_key)
                        story_key = parent_key
                    else:
                        epic_key = parent_key
                        story_key = None

                    # Add epic to hierarchy if not present
                    if epic_key and epic_key not in init_data["epics"]:
                        epic_info = epic_details.get(epic_key, {"key": epic_key, "summary": "", "issueType": "Epic"})
                        init_data["epics"][epic_key] = {
                            "key": epic_key,
                            "summary": epic_info["summary"],
                            "issueType": epic_info["issueType"],
                            "points": 0.0,
                            "children": {}  # issue_key -> {details, imaginaryFriends: []}
                        }

                    if epic_key:
                        epic_data = init_data["epics"][epic_key]
                        epic_data["points"] += points

                        # Get issue details
                        issue_key = issue.get("key")
                        issue_fields = issue.get("fields", {})
                        issue_summary = issue_fields.get("summary", "")
                        issue_type = issue_fields.get("issuetype", {}).get("name", "")

                        if is_subtask:
                            # This is an imaginary friend - add under its parent story
                            if story_key not in epic_data["children"]:
                                # Use pre-fetched story details
                                story_info = story_details.get(story_key, {})
                                epic_data["children"][story_key] = {
                                    "key": story_key,
                                    "summary": story_info.get("summary", ""),
                                    "issueType": story_info.get("issueType", "Story"),
                                    "points": 0.0,
                                    "imaginaryFriends": []
                                }

                            # Add sub-task to imaginary friends
                            epic_data["children"][story_key]["imaginaryFriends"].append({
                                "key": issue_key,
                                "summary": issue_summary,
                                "issueType": issue_type,
                                "points": points
                            })
                            epic_data["children"][story_key]["points"] += points
                        else:
                            # Regular issue - add as child of epic
                            if issue_key not in epic_data["children"]:
                                epic_data["children"][issue_key] = {
                                    "key": issue_key,
                                    "summary": issue_summary,
                                    "issueType": issue_type,
                                    "points": 0.0,
                                    "imaginaryFriends": []
                                }
                            epic_data["children"][issue_key]["points"] += points

                    # Check if this space is excluded
                    if project_key not in excluded_set:
                        sprint_totals[sprint_id]["linked"] += points
                    else:
                        sprint_totals[sprint_id]["orphan"] += points
                else:
                    sprint_totals[sprint_id]["orphan"] += points
            else:
                sprint_totals[sprint_id]["orphan"] += points

        # Build sprint alignment results
        sprint_alignment = []
        for sprint in sprints:
            totals = sprint_totals[sprint["id"]]
            total_points = totals["total"]
            linked_points = totals["linked"]
            orphan_points = totals["orphan"]
            service_points = totals["service"]
            business_points = totals["business"]

            linked_pct = (linked_points / total_points * 100) if total_points > 0 else 0

            sprint_alignment.append({
                "sprintId": sprint["id"],
                "sprintName": sprint["name"],
                "totalPoints": round(total_points, 1),
                "linkedToInitiative": round(linked_points, 1),
                "orphanCount": round(orphan_points, 1),
                "initiativeLinkedPercentage": round(linked_pct, 1),
                "orphanPercentage": round(100 - linked_pct, 1),
                "servicePoints": round(service_points, 1),
                "businessPoints": round(business_points, 1)
            })

        # Convert discovered spaces for JSON serialization with full hierarchy
        spaces_list = []
        for project_key, data in discovered_spaces.items():
            initiatives_list = []
            for init_key, init_data in data["initiatives"].items():
                # Convert epics dict to sorted list
                epics_list = []
                for epic_key, epic_data in init_data.get("epics", {}).items():
                    # Convert children dict to sorted list
                    children_list = []
                    for child_key, child_data in epic_data.get("children", {}).items():
                        children_list.append({
                            "key": child_data["key"],
                            "summary": child_data["summary"],
                            "issueType": child_data["issueType"],
                            "points": round(child_data["points"], 1),
                            "imaginaryFriends": sorted(
                                child_data.get("imaginaryFriends", []),
                                key=lambda x: x["points"],
                                reverse=True
                            )
                        })
                    children_list.sort(key=lambda x: x["points"], reverse=True)

                    epics_list.append({
                        "key": epic_data["key"],
                        "summary": epic_data["summary"],
                        "issueType": epic_data["issueType"],
                        "points": round(epic_data["points"], 1),
                        "children": children_list
                    })
                epics_list.sort(key=lambda x: x["points"], reverse=True)

                initiatives_list.append({
                    "key": init_data["key"],
                    "summary": init_data["summary"],
                    "issueType": init_data["issueType"],
                    "points": round(init_data["points"], 1),
                    "labels": init_data.get("labels", []),
                    "epics": epics_list
                })
            initiatives_list.sort(key=lambda x: x["points"], reverse=True)

            total_pts = sum(i["points"] for i in initiatives_list)
            spaces_list.append({
                "projectKey": project_key,
                "isExcluded": project_key in excluded_set,
                "totalCount": round(total_pts, 1),
                "initiatives": initiatives_list
            })

        # Collect all unique labels from included initiatives
        all_labels = set()
        for space in spaces_list:
            if not space["isExcluded"]:
                for initiative in space["initiatives"]:
                    for label in initiative.get("labels", []):
                        all_labels.add(label)

        return {
            "sprints": sprint_alignment,
            "discoveredSpaces": sorted(spaces_list, key=lambda x: x["totalCount"], reverse=True),
            "excludedSpaces": excluded_spaces,
            "allLabels": sorted(list(all_labels)),
            "serviceLabel": service_label
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

    def _count_working_days(self, start_date: str, end_date: str) -> int:
        """Count working days between two dates (excludes weekends).

        Note: end_date is exclusive (sprint ends at start of that day,
        so last working day is the day before).
        """
        if not start_date or not end_date:
            return 10  # Default to 2 weeks

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        if not start or not end:
            return 10

        # Make dates timezone-naive for comparison
        if hasattr(start, 'replace'):
            start = start.replace(tzinfo=None)
        if hasattr(end, 'replace'):
            end = end.replace(tzinfo=None)

        working_days = 0
        current = start
        # End date is exclusive (sprint ends at start of end date)
        while current < end:
            if current.weekday() < 5:  # Monday = 0, Friday = 4
                working_days += 1
            current += timedelta(days=1)

        return working_days if working_days > 0 else 10

    def _calculate_contributor_velocity(self, sprints: list, sprint_issues: dict) -> dict:
        """Calculate per-person velocity metrics from prefetched data.

        Returns average points completed per person per DAY, which helps
        predict the impact of absences on sprint capacity regardless of
        sprint length (handles 2-week vs 4-week sprints).
        """
        # Track points per person per sprint and sprint working days
        # Structure: {accountId: {sprintId: points, ...}, ...}
        contributor_sprints = {}
        contributor_info = {}  # accountId -> {displayName, email, avatarUrl}
        sprint_working_days = {}  # sprintId -> working days

        # Calculate working days for each sprint
        total_working_days = 0
        for sprint in sprints:
            days = self._count_working_days(sprint.get("startDate"), sprint.get("endDate"))
            sprint_working_days[sprint["id"]] = days
            total_working_days += days

        for sprint in sprints:
            issues = sprint_issues.get(sprint["id"], [])

            for issue in issues:
                if not self._is_completed(issue):
                    continue

                fields = issue.get("fields", {})
                assignee = fields.get("assignee")

                if not assignee or not assignee.get("accountId"):
                    continue

                account_id = assignee["accountId"]
                points = self._get_story_points(issue)

                if points is None:
                    continue

                # Initialize contributor tracking
                if account_id not in contributor_sprints:
                    contributor_sprints[account_id] = {}
                    contributor_info[account_id] = {
                        "accountId": account_id,
                        "displayName": assignee.get("displayName", "Unknown"),
                        "email": assignee.get("emailAddress"),
                        "avatarUrl": assignee.get("avatarUrls", {}).get("48x48")
                    }

                # Add points for this sprint
                sprint_id = sprint["id"]
                if sprint_id not in contributor_sprints[account_id]:
                    contributor_sprints[account_id][sprint_id] = 0
                contributor_sprints[account_id][sprint_id] += points

        # Calculate averages per contributor (normalized to per-day)
        contributors = []
        total_sprints = len(sprints)

        for account_id, sprint_points in contributor_sprints.items():
            # Sum all points across sprints
            total_points = sum(sprint_points.values())

            # Calculate working days this person was active
            active_days = sum(
                sprint_working_days.get(int(sid), 10)
                for sid in sprint_points.keys()
            )

            # Count sprints where they contributed
            sprints_active = len(sprint_points)

            # Points per working day (normalized for variable sprint lengths)
            points_per_day = total_points / active_days if active_days > 0 else 0

            # Average per sprint (only counting sprints they were active)
            avg_per_active_sprint = total_points / sprints_active if sprints_active > 0 else 0

            # Average across ALL sprints (accounts for absence)
            avg_per_sprint = total_points / total_sprints if total_sprints > 0 else 0

            info = contributor_info[account_id]
            contributors.append({
                "accountId": account_id,
                "displayName": info["displayName"],
                "email": info["email"],
                "avatarUrl": info["avatarUrl"],
                "totalPoints": round(total_points, 1),
                "sprintsActive": sprints_active,
                "activeDays": active_days,
                "pointsPerDay": round(points_per_day, 2),
                "avgPointsPerActiveSprint": round(avg_per_active_sprint, 1),
                "avgPointsPerSprint": round(avg_per_sprint, 1),
                "sprintBreakdown": {
                    str(sid): round(pts, 1)
                    for sid, pts in sprint_points.items()
                }
            })

        # Sort by points per day (descending)
        contributors.sort(key=lambda x: x["pointsPerDay"], reverse=True)

        # Calculate team totals
        team_total_points = sum(c["totalPoints"] for c in contributors)
        team_avg_velocity = team_total_points / total_sprints if total_sprints > 0 else 0
        team_points_per_day = team_total_points / total_working_days if total_working_days > 0 else 0

        return {
            "contributors": contributors,
            "totalSprints": total_sprints,
            "totalWorkingDays": total_working_days,
            "teamTotalPoints": round(team_total_points, 1),
            "teamAvgVelocity": round(team_avg_velocity, 1),
            "teamPointsPerDay": round(team_points_per_day, 2),
            "sprintDetails": {
                str(s["id"]): {
                    "name": s["name"],
                    "workingDays": sprint_working_days[s["id"]]
                }
                for s in sprints
            }
        }

    # Public methods - these can still be called individually if needed
    def get_velocity_metrics(self, board_id: int,
                             start_date: str = None, end_date: str = None,
                             sprint_count: int = None) -> dict:
        """Calculate velocity metrics for sprints in date range (or last 6)."""
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_velocity(sprints, sprint_issues)

    def get_completion_metrics(self, board_id: int,
                               start_date: str = None, end_date: str = None,
                               sprint_count: int = None) -> dict:
        """Calculate completion metrics for sprints in date range (or last 6)."""
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_completion(sprints, sprint_issues)

    def get_quality_metrics(self, board_id: int,
                            start_date: str = None, end_date: str = None,
                            sprint_count: int = None) -> dict:
        """Calculate quality metrics for sprints in date range (or last 6)."""
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_quality(sprints, sprint_issues)

    def get_alignment_metrics(self, board_id: int, excluded_spaces: list = None,
                              start_date: str = None, end_date: str = None,
                              sprint_count: int = None, service_label: str = None) -> dict:
        """Calculate strategic alignment metrics."""
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_alignment(sprints, sprint_issues, excluded_spaces, service_label)

    def get_coverage_metrics(self, board_id: int,
                             start_date: str = None, end_date: str = None,
                             sprint_count: int = None) -> dict:
        """Calculate story point coverage metrics."""
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_coverage(sprints, sprint_issues)

    def get_contributor_velocity(self, board_id: int,
                                  start_date: str = None, end_date: str = None,
                                  sprint_count: int = None) -> dict:
        """Calculate per-person velocity metrics.

        Returns average points completed per person per sprint, useful for
        predicting impact of team member absences on sprint capacity.
        """
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)
        return self._calculate_contributor_velocity(sprints, sprint_issues)

    def get_all_metrics(self, board_id: int, excluded_spaces: list = None,
                        start_date: str = None, end_date: str = None,
                        sprint_count: int = None, service_label: str = None) -> dict:
        """Get all metrics combined for dashboard - single fetch, parallel processing."""
        # Single prefetch of all data
        sprints, sprint_issues = self._prefetch_all_data(board_id, start_date, end_date, sprint_count)

        # Calculate all metrics from the same dataset
        return {
            "velocity": self._calculate_velocity(sprints, sprint_issues),
            "completion": self._calculate_completion(sprints, sprint_issues),
            "quality": self._calculate_quality(sprints, sprint_issues),
            "alignment": self._calculate_alignment(sprints, sprint_issues, excluded_spaces, service_label),
            "coverage": self._calculate_coverage(sprints, sprint_issues)
        }

    def _get_sprint_by_id(self, sprint_id: int) -> Optional[dict]:
        """Fetch a specific sprint by ID."""
        try:
            data = self._request(f"/rest/agile/1.0/sprint/{sprint_id}")
            return data
        except Exception:
            return None

    def get_planning_metrics(self, board_id: int, sprint_id: int,
                             velocity_sprint_count: int = 6) -> dict:
        """Calculate planning metrics for a future/active sprint.

        Args:
            board_id: Jira board ID
            sprint_id: The sprint to analyze
            velocity_sprint_count: Number of past sprints to use for velocity average

        Returns:
            Dict with planning metrics
        """
        # Get sprint details
        sprint = self._get_sprint_by_id(sprint_id)
        if not sprint:
            return {"error": "Sprint not found"}

        # Get issues in this sprint
        issues = self._get_sprint_issues(sprint_id)

        # Get historical velocity for comparison
        historical_sprints, historical_issues = self._prefetch_all_data(
            board_id, sprint_count=velocity_sprint_count
        )
        velocity_data = self._calculate_velocity(historical_sprints, historical_issues)
        historical_velocity = velocity_data.get("averageVelocity", 0)

        # Calculate planning metrics
        total_points = 0.0
        stories_with_points = 0
        stories_missing_points = 0
        stories_missing_points_list = []
        bug_count = 0
        total_story_count = 0
        all_points = []

        # Track parent keys for initiative linking
        parent_info = {}
        issues_to_check = []

        for issue in issues:
            fields = issue.get("fields", {})
            issue_type = fields.get("issuetype", {}).get("name", "").lower()
            is_subtask = fields.get("issuetype", {}).get("subtask", False)

            # Count bugs
            if "bug" in issue_type:
                bug_count += 1

            # Skip sub-tasks for point counting (handled by parent)
            if is_subtask:
                continue

            total_story_count += 1
            points = self._get_story_points(issue)

            if points is not None:
                total_points += points
                stories_with_points += 1
                all_points.append(points)
            else:
                stories_missing_points += 1
                stories_missing_points_list.append({
                    "key": issue.get("key"),
                    "summary": fields.get("summary", ""),
                    "issueType": fields.get("issuetype", {}).get("name", "")
                })

            # Track for initiative linking
            parent = fields.get("parent")
            if parent and parent.get("key"):
                parent_key = parent.get("key")
                parent_info[parent_key] = False  # Not a subtask parent
                issues_to_check.append((issue, points or 0, parent_key))

        # Calculate average points per story
        avg_points = sum(all_points) / len(all_points) if all_points else 0

        # Calculate velocity comparison
        velocity_delta = total_points - historical_velocity
        if velocity_delta > 2:
            velocity_status = "over"
        elif velocity_delta < -2:
            velocity_status = "under"
        else:
            velocity_status = "on_target"

        # Calculate initiative-linked percentage
        parent_keys_info = [(key, is_sub) for key, is_sub in parent_info.items()]
        parent_to_initiative = self._get_initiatives_batch(parent_keys_info)

        linked_points = 0.0
        for issue, points, parent_key in issues_to_check:
            if parent_key and parent_to_initiative.get(parent_key):
                linked_points += points

        initiative_linked_pct = (linked_points / total_points * 100) if total_points > 0 else 0

        # Calculate bug ratio
        bug_ratio = (bug_count / total_story_count * 100) if total_story_count > 0 else 0

        return {
            "sprint": {
                "id": sprint.get("id"),
                "name": sprint.get("name"),
                "state": sprint.get("state"),
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "goal": sprint.get("goal")
            },
            "totalPoints": round(total_points, 1),
            "averagePointsPerStory": round(avg_points, 1),
            "storiesWithPoints": stories_with_points,
            "storiesMissingPoints": stories_missing_points,
            "storiesMissingPointsList": stories_missing_points_list,
            "totalStories": total_story_count,
            "bugCount": bug_count,
            "bugRatio": round(bug_ratio, 1),
            "initiativeLinkedPercent": round(initiative_linked_pct, 1),
            "historicalVelocity": round(historical_velocity, 1),
            "velocitySprintCount": velocity_sprint_count,
            "velocityDelta": round(velocity_delta, 1),
            "velocityStatus": velocity_status
        }
