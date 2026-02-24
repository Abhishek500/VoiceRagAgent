import axios, { AxiosInstance } from 'axios'

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
})

export default api

