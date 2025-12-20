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
 */
export async function getMetricsSummary(credentials, boardId, initiativeBoards = []) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/summary`, {
    params: {
      initiative_boards: initiativeBoards.join(',')
    }
  })
  return response.data.data
}

/**
 * Get velocity metrics
 */
export async function getVelocityMetrics(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/velocity`)
  return response.data.data
}

/**
 * Get completion metrics
 */
export async function getCompletionMetrics(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/completion`)
  return response.data.data
}

/**
 * Get quality metrics
 */
export async function getQualityMetrics(credentials, boardId) {
  const client = createClient(credentials)
  const response = await client.get(`/metrics/${boardId}/quality`)
  return response.data.data
}
