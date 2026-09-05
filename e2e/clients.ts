import { ApiClient } from "./api-client"
import { readTokens } from "./context"

export function adminClient(): ApiClient {
  return new ApiClient(readTokens().platformAdmin)
}

export function b2bClient(): ApiClient {
  return new ApiClient(readTokens().b2b)
}

export function customerClient(subdomain: string): ApiClient {
  return new ApiClient(readTokens().customer, {
    "X-Tenant-Subdomain": subdomain,
  })
}

export function publicClient(subdomain: string): ApiClient {
  return new ApiClient("", {
    "X-Tenant-Subdomain": subdomain,
  })
}
