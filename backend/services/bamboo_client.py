"""BambooHR API client for time-off and holiday data.

Uses user-provided credentials (similar to Jira integration).
"""

from datetime import datetime, timedelta
from typing import Optional
import requests


def make_bamboo_request(
    api_key: str,
    subdomain: str,
    endpoint: str,
    params: dict = None
) -> Optional[dict]:
    """Make authenticated request to BambooHR API.

    Args:
        api_key: User's BambooHR API key
        subdomain: Company subdomain (e.g., 'acme' for acme.bamboohr.com)
        endpoint: API endpoint path
        params: Optional query parameters

    Returns:
        Response JSON or None on error
    """
    base_url = f"https://api.bamboohr.com/api/gateway.php/{subdomain}/v1"

    try:
        response = requests.get(
            f"{base_url}{endpoint}",
            auth=(api_key, "x"),  # BambooHR uses API key as username
            headers={"Accept": "application/json"},
            params=params,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException:
        return None


def get_company_holidays(
    api_key: str,
    subdomain: str,
    start_date: str = None,
    end_date: str = None
) -> list:
    """Get company-wide holidays.

    Args:
        api_key: User's BambooHR API key
        subdomain: Company subdomain
        start_date: Start of date range (YYYY-MM-DD). Defaults to today.
        end_date: End of date range (YYYY-MM-DD). Defaults to 90 days from start.

    Returns:
        List of holiday objects with name and date.
    """
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end = datetime.now() + timedelta(days=90)
        end_date = end.strftime("%Y-%m-%d")

    data = make_bamboo_request(
        api_key, subdomain,
        "/time_off/whos_out/",
        params={"start": start_date, "end": end_date}
    )

    if not data:
        return []

    holidays = []
    for entry in data:
        if entry.get("type") == "holiday":
            holidays.append({
                "name": entry.get("name", "Company Holiday"),
                "date": entry.get("start"),
                "endDate": entry.get("end")
            })

    return holidays


def get_employees(api_key: str, subdomain: str) -> list:
    """Get employee directory for matching with Jira/Atlassian users.

    Args:
        api_key: User's BambooHR API key
        subdomain: Company subdomain

    Returns:
        List of employee info dicts
    """
    data = make_bamboo_request(api_key, subdomain, "/employees/directory")
    if not data or "employees" not in data:
        return []

    return [
        {
            "id": emp.get("id"),
            "displayName": emp.get("displayName"),
            "firstName": emp.get("firstName"),
            "lastName": emp.get("lastName"),
            "workEmail": emp.get("workEmail"),
            "department": emp.get("department"),
            "jobTitle": emp.get("jobTitle")
        }
        for emp in data["employees"]
    ]


def get_time_off_requests(
    api_key: str,
    subdomain: str,
    start_date: str = None,
    end_date: str = None,
    employee_emails: list = None
) -> list:
    """Get approved time-off requests.

    Args:
        api_key: User's BambooHR API key
        subdomain: Company subdomain
        start_date: Start of date range (YYYY-MM-DD). Defaults to today.
        end_date: End of date range (YYYY-MM-DD). Defaults to 90 days from start.
        employee_emails: Optional list of employee emails to filter by.

    Returns:
        List of time-off entries.
    """
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end = datetime.now() + timedelta(days=90)
        end_date = end.strftime("%Y-%m-%d")

    data = make_bamboo_request(
        api_key, subdomain,
        "/time_off/whos_out/",
        params={"start": start_date, "end": end_date}
    )

    if not data:
        return []

    # If filtering by emails, we need to get employee directory first
    email_to_id = {}
    if employee_emails:
        employees = get_employees(api_key, subdomain)
        email_to_id = {
            emp["workEmail"].lower(): emp["id"]
            for emp in employees
            if emp.get("workEmail")
        }
        valid_employee_ids = {
            email_to_id[email.lower()]
            for email in employee_emails
            if email.lower() in email_to_id
        }
    else:
        valid_employee_ids = None

    time_off = []
    for entry in data:
        # Skip holidays
        if entry.get("type") == "holiday":
            continue

        employee_id = str(entry.get("employeeId", ""))

        # Filter by employee IDs if provided
        if valid_employee_ids and employee_id not in valid_employee_ids:
            continue

        time_off.append({
            "employeeId": employee_id,
            "employeeName": entry.get("name", "Unknown"),
            "startDate": entry.get("start"),
            "endDate": entry.get("end"),
            "type": entry.get("type", "timeOff")
        })

    return time_off


def calculate_capacity_adjustment(
    api_key: str,
    subdomain: str,
    sprint_start: str,
    sprint_end: str,
    team_member_emails: list = None,
    team_size: int = None
) -> dict:
    """Calculate capacity adjustment for a sprint based on time off.

    Args:
        api_key: User's BambooHR API key
        subdomain: Company subdomain
        sprint_start: Sprint start date (YYYY-MM-DD)
        sprint_end: Sprint end date (YYYY-MM-DD)
        team_member_emails: List of team member emails to check time off for
        team_size: Number of people on the team (defaults to len of emails)

    Returns:
        Dictionary with capacity details and adjustment factor.
    """
    if team_size is None:
        team_size = len(team_member_emails) if team_member_emails else 5

    holidays = get_company_holidays(api_key, subdomain, sprint_start, sprint_end)
    time_off = get_time_off_requests(
        api_key, subdomain, sprint_start, sprint_end, team_member_emails
    )

    # Calculate working days in sprint
    start = datetime.strptime(sprint_start, "%Y-%m-%d")
    end = datetime.strptime(sprint_end, "%Y-%m-%d")
    delta = (end - start).days + 1
    # Exclude weekends
    working_days = sum(
        1 for d in range(delta)
        if (start + timedelta(days=d)).weekday() < 5
    )

    total_person_days = working_days * team_size

    # Count holiday days (affects everyone)
    holiday_days = len(holidays) * team_size

    # Count PTO days
    pto_days = 0
    for entry in time_off:
        pto_start = datetime.strptime(entry["startDate"], "%Y-%m-%d")
        pto_end = datetime.strptime(entry["endDate"], "%Y-%m-%d")
        # Count only days within sprint range
        actual_start = max(pto_start, start)
        actual_end = min(pto_end, end)
        if actual_start <= actual_end:
            # Only count working days in PTO range
            pto_range_days = (actual_end - actual_start).days + 1
            pto_working_days = sum(
                1 for d in range(pto_range_days)
                if (actual_start + timedelta(days=d)).weekday() < 5
            )
            pto_days += pto_working_days

    days_off = holiday_days + pto_days
    available_days = max(total_person_days - days_off, 0)
    adjustment_factor = available_days / total_person_days if total_person_days > 0 else 1.0

    return {
        "sprintStart": sprint_start,
        "sprintEnd": sprint_end,
        "teamSize": team_size,
        "workingDays": working_days,
        "totalPersonDays": total_person_days,
        "holidayDays": holiday_days,
        "ptoDays": pto_days,
        "availablePersonDays": available_days,
        "adjustmentFactor": round(adjustment_factor, 2),
        "holidays": holidays,
        "timeOff": time_off
    }
