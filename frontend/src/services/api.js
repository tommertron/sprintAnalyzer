import axios from 'axios'

const API_BASE = '/api'

/**
 * Create axios instance with Jira credentials in headers
 */
function createClient(credentials) {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Content-Type': 'application/json',
      'X-Jira-Server': credentials.server,
      'X-Jira-Email': credentials.email,
      'X-Jira-Token': credentials.token
    }
  })
}

/**
 * Validate Jira credentials
 */
export async function validateCredentials(server, email, token) {
  const response = await axios.post(`${API_BASE}/auth/validate`, {
    server,
    email,
    token
  })
  return response.data
}

/**
 * Get list of accessible boards
 */
export async function getBoards(credentials) {
  const client = createClient(credentials)
  const response = await client.get('/boards')
  return response.data.data
}

/**
 * Get sprints for a board
 */
export async function getSprints(credentials, boardId, limit = 6) {
  const client = createClient(credentials)
  const response = await client.get(`/boards/${boardId}/sprints`, {
    params: { limit }
  })
  return response.data.data
}

/**
 * Get all metrics summary for a board
 * @param {Object} credentials - Jira credentials
 * @param {number} boardId - Board ID
 * @param {Array} excludedSpaces - Optional project keys to exclude from alignment
 * @param {Object} dateRange - Optional { startDate, endDate } or { sprintCount } for filtering
 * @param {string} serviceLabel - Optional label to identify service investment initiatives
 */
export async function getMetricsSummary(credentials, boardId, excludedSpaces = [], dateRange = null, serviceLabel = null) {
  const client = createClient(credentials)
  const params = {}
  if (excludedSpaces.length > 0) {
    params.excluded_spaces = excludedSpaces.join(',')
  }
  if (dateRange) {
    if (dateRange.sprintCount) {
      params.sprint_count = dateRange.sprintCount
    } else {
      if (dateRange.startDate) params.start_date = dateRange.startDate
      if (dateRange.endDate) params.end_date = dateRange.endDate
    }
  }
  if (serviceLabel) {
    params.service_label = serviceLabel
  }
  const response = await client.get(`/metrics/${boardId}/summary`, { params })
  return response.data.data
}

/**
 * Get velocity metrics
 */
export async function getVelocityMetrics(credentials, boardId, dateRange = null) {
  const client = createClient(credentials)
  const params = {}
  if (dateRange) {
    if (dateRange.sprintCount) {
      params.sprint_count = dateRange.sprintCount
    } else {
      if (dateRange.startDate) params.start_date = dateRange.startDate
      if (dateRange.endDate) params.end_date = dateRange.endDate
    }
  }
  const response = await client.get(`/metrics/${boardId}/velocity`, { params })
  return response.data.data
}

/**
 * Get completion metrics
 */
export async function getCompletionMetrics(credentials, boardId, dateRange = null) {
  const client = createClient(credentials)
  const params = {}
  if (dateRange) {
    if (dateRange.sprintCount) {
      params.sprint_count = dateRange.sprintCount
    } else {
      if (dateRange.startDate) params.start_date = dateRange.startDate
      if (dateRange.endDate) params.end_date = dateRange.endDate
    }
  }
  const response = await client.get(`/metrics/${boardId}/completion`, { params })
  return response.data.data
}

/**
 * Get quality metrics
 */
export async function getQualityMetrics(credentials, boardId, dateRange = null) {
  const client = createClient(credentials)
  const params = {}
  if (dateRange) {
    if (dateRange.sprintCount) {
      params.sprint_count = dateRange.sprintCount
    } else {
      if (dateRange.startDate) params.start_date = dateRange.startDate
      if (dateRange.endDate) params.end_date = dateRange.endDate
    }
  }
  const response = await client.get(`/metrics/${boardId}/quality`, { params })
  return response.data.data
}

/**
 * Get future sprints for a board (not yet started)
 */
export async function getFutureSprints(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/boards/${boardId}/sprints`, {
    params: { state: 'future', limit: 10 }
  })
  return response.data.data
}

/**
 * Get active sprint for a board
 */
export async function getActiveSprint(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/boards/${boardId}/sprints`, {
    params: { state: 'active', limit: 1 }
  })
  return response.data.data
}

/**
 * Get planning metrics for a specific sprint
 * @param {Object} credentials - Jira credentials
 * @param {number} boardId - Board ID
 * @param {number} sprintId - Sprint ID to analyze
 * @param {number} velocitySprintCount - Number of past sprints for velocity average (default: 6)
 */
export async function getPlanningMetrics(credentials, boardId, sprintId, velocitySprintCount = 6) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/planning/${sprintId}`, {
    params: { velocity_sprint_count: velocitySprintCount }
  })
  return response.data.data
}

/**
 * Get per-person velocity metrics (contributor velocity)
 * @param {Object} credentials - Jira credentials
 * @param {number} boardId - Board ID
 * @param {number} sprintCount - Number of sprints to analyze (default: 6)
 */
export async function getContributorVelocity(credentials, boardId, sprintCount = 6) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/contributors`, {
    params: { sprint_count: sprintCount }
  })
  return response.data.data
}

// ============================================
// BambooHR / Capacity Planning APIs
// ============================================

/**
 * Create axios instance with both Jira and BambooHR credentials
 */
function createBambooClient(jiraCredentials, bambooCredentials) {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Content-Type': 'application/json',
      'X-Jira-Server': jiraCredentials.server,
      'X-Jira-Email': jiraCredentials.email,
      'X-Jira-Token': jiraCredentials.token,
      ...(bambooCredentials && {
        'X-Bamboo-Token': bambooCredentials.token,
        'X-Bamboo-Subdomain': bambooCredentials.subdomain
      })
    }
  })
}

/**
 * Get project members (users who worked on recent sprints)
 */
export async function getProjectMembers(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/bamboo/project-members/${boardId}`)
  return response.data.data.members
}

/**
 * Get company holidays from BambooHR
 */
export async function getHolidays(jiraCredentials, bambooCredentials, startDate, endDate) {
  const client = createBambooClient(jiraCredentials, bambooCredentials)
  const response = await client.get('/bamboo/holidays', {
    params: { start_date: startDate, end_date: endDate }
  })
  return response.data.data
}

/**
 * Get time-off data for a team
 */
export async function getTeamTimeOff(jiraCredentials, bambooCredentials, boardId, teamId, startDate, endDate) {
  const client = createBambooClient(jiraCredentials, bambooCredentials)
  const response = await client.get(`/bamboo/time-off/${boardId}`, {
    params: { team_id: teamId, start_date: startDate, end_date: endDate }
  })
  return response.data.data
}

/**
 * Get capacity adjustment for a sprint
 * @param {Array} memberEmails - List of team member emails to check time off for
 */
export async function getCapacity(jiraCredentials, bambooCredentials, boardId, sprintStart, sprintEnd, memberEmails, teamSize) {
  const client = createBambooClient(jiraCredentials, bambooCredentials)
  const params = {
    sprint_start: sprintStart,
    sprint_end: sprintEnd
  }
  if (memberEmails && memberEmails.length > 0) {
    params.member_emails = memberEmails.join(',')
  }
  if (teamSize) params.team_size = teamSize
  const response = await client.get(`/bamboo/capacity/${boardId}`, { params })
  return response.data.data
}
