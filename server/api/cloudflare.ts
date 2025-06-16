import axios from 'axios';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
  throw new Error('Cloudflare API token or zone ID not set in environment variables');
}

const cfHeaders = {
  'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Create a custom hostname (domain) in Cloudflare
export async function handleCloudflareCustomDomain(domain: string, serverId: string) {
  try {
    const res = await axios.post(
      `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames`,
      {
        hostname: domain,
        ssl: {
          method: 'http', // Use http validation
          type: 'dv',
        },
        metadata: {
          serverId,
        },
      },
      { headers: cfHeaders }
    );
    return res.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.errors?.[0]?.message || error.message || 'Cloudflare API error');
  }
}

// Verify and activate a custom hostname (patch to trigger DCV)
export async function verifyCloudflareCustomDomain(domain: string, serverId: string) {
  try {
    // Find the custom hostname ID first
    const listRes = await axios.get(
      `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${domain}`,
      { headers: cfHeaders }
    );
    const hostnameObj = listRes.data.result?.[0];
    if (!hostnameObj) {
      throw new Error('Custom hostname not found in Cloudflare');
    }
    // PATCH to trigger validation
    const patchRes = await axios.patch(
      `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameObj.id}`,
      {
        ssl: {
          method: 'http',
          type: 'dv',
        },
      },
      { headers: cfHeaders }
    );
    // Return status info
    return {
      status: patchRes.data.result?.ssl?.status || 'pending',
      error: patchRes.data.errors?.[0]?.message,
      cloudflare: patchRes.data,
    };
  } catch (error: any) {
    return {
      status: 'error',
      error: error?.response?.data?.errors?.[0]?.message || error.message || 'Cloudflare API error',
    };
  }
}

// Delete a custom hostname from Cloudflare
export async function deleteCloudflareCustomDomain(domain: string, serverId: string) {
  try {
    // Find the custom hostname ID first
    const listRes = await axios.get(
      `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${domain}`,
      { headers: cfHeaders }
    );
    const hostnameObj = listRes.data.result?.[0];
    if (!hostnameObj) {
      // Already deleted or never existed
      return;
    }
    await axios.delete(
      `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameObj.id}`,
      { headers: cfHeaders }
    );
  } catch (error: any) {
    // Ignore not found errors
    if (error?.response?.status === 404) return;
    throw new Error(error?.response?.data?.errors?.[0]?.message || error.message || 'Cloudflare API error');
  }
} 