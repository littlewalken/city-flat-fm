import type { CityFlatApi } from '../shared/types'

declare global {
  interface Window {
    api: CityFlatApi
  }
}
