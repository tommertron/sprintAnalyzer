"""Atlassian Teams API client for fetching team members."""

from typing import Optional
import requests
import logging

logger = logging.getLogger(__name__)


def _get_org_id(server: str, email: str, token: str) -> Optional[str]:
    """Get the Atlassian organization ID from the Jira instance."""
    try:
        # Get tenant info to find org ID
        url = f"{server}/_edge/tenant_info"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("orgId")
    except:
        pass

    # Try the admin API
    try:
        url = f"{server}/rest/api/3/serverInfo"
        response = requests.get(
            url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=10
        )
        if response.status_code == 200:
            # Unfortunately serverInfo doesn't include orgId
            pass
    except:
        pass

    return None


def get_user_teams(
    server: str,
    email: str,
    token: str
) -> list:
    """Get list of Atlassian Teams the user has access to.

    Args:
        server: Jira server URL
        email: User's Atlassian email
        token: User's Atlassian API token

    Returns:
        List of team objects with id, name, and description
    """
    teams = []

    # Get org ID first
    org_id = _get_org_id(server, email, token)
    logger.info(f"Got org ID: {org_id}")

    # 1. Try Atlassian Teams API v3 with org ID
    if org_id:
        try:
            url = f"https://api.atlassian.com/teams/v3/orgs/{org_id}/teams"
            response = requests.get(
                url,
                auth=(email, token),
                headers={"Accept": "application/json"},
                params={"limit": 100},
                timeout=30
            )
            logger.info(f"Teams API v3 response: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                for team in data.get("data", data.get("teams", [])):
                    teams.append({
                        "id": team.get("teamId", team.get("id")),
                        "name": team.get("displayName", team.get("name")),
                        "description": team.get("description", ""),
                        "memberCount": team.get("memberCount")
                    })
                if teams:
                    return teams
        except Exception as e:
            logger.warning(f"Teams API v3 failed: {e}")

    # 2. Try the gateway API via Jira
    try:
        url = f"{server}/gateway/api/public/teams/v1/org/teams"
        response = requests.get(
            url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            params={"limit": 100},
            timeout=30
        )
        logger.info(f"Gateway teams API response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            for team in data.get("teams", data.get("results", data.get("data", []))):
                teams.append({
                    "id": team.get("teamId", team.get("id")),
                    "name": team.get("displayName", team.get("name")),
                    "description": team.get("description", ""),
                    "memberCount": team.get("memberCount")
                })
            if teams:
                return teams
    except Exception as e:
        logger.warning(f"Gateway teams API failed: {e}")

    # 3. Try Jira Software team search
    try:
        url = f"{server}/rest/teams/1.0/teams/find"
        response = requests.get(
            url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            params={"maxResults": 100},
            timeout=30
        )
        logger.info(f"Jira teams API response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            team_list = data.get("teams", data if isinstance(data, list) else [])
            for team in team_list:
                teams.append({
                    "id": str(team.get("teamId", team.get("id"))),
                    "name": team.get("title", team.get("name", team.get("displayName"))),
                    "description": team.get("description", ""),
                    "memberCount": team.get("memberCount")
                })
            if teams:
                return teams
    except Exception as e:
        logger.warning(f"Jira teams API failed: {e}")

    # 4. Try Advanced Roadmaps teams API
    try:
        url = f"{server}/rest/teams/1.0/teams"
        response = requests.get(
            url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=30
        )
        logger.info(f"Advanced Roadmaps teams API response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            team_list = data if isinstance(data, list) else data.get("teams", [])
            for team in team_list:
                teams.append({
                    "id": str(team.get("id", team.get("teamId"))),
                    "name": team.get("title", team.get("name", team.get("displayName"))),
                    "description": team.get("description", ""),
                    "shareable": team.get("shareable", False)
                })
    except Exception as e:
        logger.warning(f"Advanced Roadmaps teams API failed: {e}")

    return teams


def get_team_members(
    server: str,
    email: str,
    token: str,
    team_id: str,
    cloud_id: str = None
) -> list:
    """Get members of an Atlassian Team.

    Args:
        server: Jira server URL (used to derive cloud ID if not provided)
        email: User's Atlassian email
        token: User's Atlassian API token
        team_id: Atlassian Team ID (UUID)
        cloud_id: Optional cloud ID (derived from server if not provided)

    Returns:
        List of team member info with accountId and email
    """
    # Atlassian Teams API uses a different base URL
    # We need to use the team-central API
    teams_api_url = f"https://team.atlassian.com/gateway/api/v4/teams/{team_id}/members"

    try:
        response = requests.get(
            teams_api_url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            members = []
            for member in data.get("results", []):
                members.append({
                    "accountId": member.get("accountId"),
                    "displayName": member.get("displayName"),
                    "email": member.get("email"),
                    "avatarUrl": member.get("avatarUrl")
                })
            return members

        # If that doesn't work, try the Jira-based team membership endpoint
        # Some Atlassian instances use different endpoints
        return _get_team_members_via_jira(server, email, token, team_id)

    except requests.exceptions.RequestException:
        return []


def _get_team_members_via_jira(
    server: str,
    email: str,
    token: str,
    team_id: str
) -> list:
    """Fallback: Get team members via Jira user picker or board members."""
    # Try the team API via the Jira gateway
    try:
        # Atlassian Team v3 API
        url = f"{server}/gateway/api/public/teams/v1/org/teams/{team_id}/members"
        response = requests.get(
            url,
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            members = []
            for member in data.get("results", data.get("members", [])):
                members.append({
                    "accountId": member.get("accountId", member.get("id")),
                    "displayName": member.get("displayName", member.get("name")),
                    "email": member.get("email"),
                })
            return members
    except requests.exceptions.RequestException:
        pass

    return []


def get_team_member_emails(
    server: str,
    email: str,
    token: str,
    team_id: str
) -> list:
    """Get just the email addresses of team members.

    Args:
        server: Jira server URL
        email: User's Atlassian email
        token: User's Atlassian API token
        team_id: Atlassian Team ID

    Returns:
        List of email addresses
    """
    members = get_team_members(server, email, token, team_id)
    return [m["email"] for m in members if m.get("email")]
