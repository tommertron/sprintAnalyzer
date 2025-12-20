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
