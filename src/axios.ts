import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

const instance = axios.create({
  timeout: 5000,
})

instance.interceptors.request.use(
  function(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    return config
  },
  function(error: unknown): Promise<never> {
    return Promise.reject(error)
  },
)

instance.interceptors.response.use(
  function(res: AxiosResponse): unknown {
    return res.data
  },
  function(error: unknown): Promise<never> {
    return Promise.reject(error)
  },
)

export default instance
