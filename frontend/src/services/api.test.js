import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import {
  validateCredentials,
  getBoards,
  getSprints,
  getMetricsSummary,
  getVelocityMetrics,
  getCompletionMetrics,
  getQualityMetrics
} from './api'

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn()
    }))
  }
}))

const mockCredentials = {
  server: 'https://test.atlassian.net',
  email: 'test@example.com',
  token: 'test-token'
}

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateCredentials', () => {
    it('should call auth validate endpoint with credentials', async () => {
      axios.post.mockResolvedValue({
        data: {
          data: {
            valid: true,
            user: { displayName: 'Test User' }
          }
        }
      })

      const result = await validateCredentials(
        mockCredentials.server,
        mockCredentials.email,
        mockCredentials.token
      )

      expect(axios.post).toHaveBeenCalledWith('/api/auth/validate', {
        server: mockCredentials.server,
        email: mockCredentials.email,
        token: mockCredentials.token
      })
      expect(result.data.valid).toBe(true)
    })

    it('should propagate errors from API', async () => {
      axios.post.mockRejectedValue(new Error('Invalid credentials'))

      await expect(
        validateCredentials('server', 'email', 'bad-token')
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('getBoards', () => {
    it('should create client with correct headers', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { data: [{ id: 1, name: 'Board 1' }] }
      })
      axios.create.mockReturnValue({ get: mockGet })

      await getBoards(mockCredentials)

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: '/api',
        headers: {
          'Content-Type': 'application/json',
          'X-Jira-Server': mockCredentials.server,
          'X-Jira-Email': mockCredentials.email,
          'X-Jira-Token': mockCredentials.token
        }
      })
    })

    it('should return boards data', async () => {
      const boards = [
        { id: 1, name: 'Board 1' },
        { id: 2, name: 'Board 2' }
      ]
      const mockGet = vi.fn().mockResolvedValue({ data: { data: boards } })
      axios.create.mockReturnValue({ get: mockGet })

      const result = await getBoards(mockCredentials)

      expect(mockGet).toHaveBeenCalledWith('/boards')
      expect(result).toEqual(boards)
    })
  })

  describe('getSprints', () => {
    it('should fetch sprints with default limit', async () => {
      const sprints = [{ id: 100, name: 'Sprint 1' }]
      const mockGet = vi.fn().mockResolvedValue({ data: { data: sprints } })
      axios.create.mockReturnValue({ get: mockGet })

      const result = await getSprints(mockCredentials, 123)

      expect(mockGet).toHaveBeenCalledWith('/boards/123/sprints', {
        params: { limit: 6 }
      })
      expect(result).toEqual(sprints)
    })

    it('should fetch sprints with custom limit', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: [] } })
      axios.create.mockReturnValue({ get: mockGet })

      await getSprints(mockCredentials, 123, 10)

      expect(mockGet).toHaveBeenCalledWith('/boards/123/sprints', {
        params: { limit: 10 }
      })
    })
  })

  describe('getMetricsSummary', () => {
    it('should fetch metrics without filters', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getMetricsSummary(mockCredentials, 123)

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/summary', { params: {} })
    })

    it('should include excluded spaces in params', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getMetricsSummary(mockCredentials, 123, ['PROJ1', 'PROJ2'])

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/summary', {
        params: { excluded_spaces: 'PROJ1,PROJ2' }
      })
    })

    it('should include date range in params', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getMetricsSummary(mockCredentials, 123, [], {
        startDate: '2024-01-01',
        endDate: '2024-03-31'
      })

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/summary', {
        params: {
          start_date: '2024-01-01',
          end_date: '2024-03-31'
        }
      })
    })

    it('should include sprint count in params', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getMetricsSummary(mockCredentials, 123, [], { sprintCount: 12 })

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/summary', {
        params: { sprint_count: 12 }
      })
    })

    it('should include service label in params', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getMetricsSummary(mockCredentials, 123, [], null, 'service-work')

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/summary', {
        params: { service_label: 'service-work' }
      })
    })
  })

  describe('getVelocityMetrics', () => {
    it('should fetch velocity metrics', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: { averageVelocity: 25 } } })
      axios.create.mockReturnValue({ get: mockGet })

      const result = await getVelocityMetrics(mockCredentials, 123)

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/velocity', { params: {} })
      expect(result.averageVelocity).toBe(25)
    })

    it('should include date range params', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: {} } })
      axios.create.mockReturnValue({ get: mockGet })

      await getVelocityMetrics(mockCredentials, 123, {
        startDate: '2024-01-01',
        endDate: '2024-06-30'
      })

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/velocity', {
        params: {
          start_date: '2024-01-01',
          end_date: '2024-06-30'
        }
      })
    })
  })

  describe('getCompletionMetrics', () => {
    it('should fetch completion metrics', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: { averageCompletionRate: 85 } } })
      axios.create.mockReturnValue({ get: mockGet })

      const result = await getCompletionMetrics(mockCredentials, 123)

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/completion', { params: {} })
      expect(result.averageCompletionRate).toBe(85)
    })
  })

  describe('getQualityMetrics', () => {
    it('should fetch quality metrics', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: { sprints: [] } } })
      axios.create.mockReturnValue({ get: mockGet })

      const result = await getQualityMetrics(mockCredentials, 123)

      expect(mockGet).toHaveBeenCalledWith('/metrics/123/quality', { params: {} })
      expect(result.sprints).toEqual([])
    })
  })
})
