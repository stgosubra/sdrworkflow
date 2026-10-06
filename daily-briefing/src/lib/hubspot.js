// HubSpot v3 client. Browser-side calls to api.hubapi.com using a Private App
// Bearer token. The token is stored in localStorage by the caller.
//
// IMPORTANT: HubSpot v3 endpoints support CORS for Private App tokens. If a
// future endpoint blocks browser origins, route it through a proxy.

const BASE = "https://api.hubapi.com";

async function call(token, path, init = {}) {
  if (!token) throw new Error("HubSpot token missing");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Search owned deals. Returns { results: [...], paging? }.
// `ownerId` filters to deals where hubspot_owner_id matches.
// `properties` is the list of deal property names to return.
// `extraFilters` lets the caller add more filterGroup AND-clauses.
export async function searchDeals(token, { ownerId, properties, extraFilters = [], limit = 100, after }) {
  const body = {
    limit,
    after,
    properties,
    filterGroups: [
      {
        filters: [
          { propertyName: "hubspot_owner_id", operator: "EQ", value: String(ownerId) },
          { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
          ...extraFilters,
        ],
      },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  };
  return call(token, "/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Fetch the deal pipeline definition so we can map stage IDs to labels and order.
export async function getDealsPipeline(token, pipelineId = "default") {
  return call(token, `/crm/v3/pipelines/deals/${pipelineId}`);
}

// List all deal pipelines.
export async function listDealsPipelines(token) {
  return call(token, "/crm/v3/pipelines/deals");
}

// Fetch the list of available deal properties (for the MEDDPICC mapping UI).
export async function listDealProperties(token) {
  return call(token, "/crm/v3/properties/deals");
}

// Quick token test - any call with the token, used by Settings to verify
// the user pasted a valid Private App token.
export async function whoAmI(token) {
  return call(token, "/oauth/v1/access-tokens/info").catch(async () => {
    // Private App tokens don't have access-token-info; fall back to a tiny call.
    return call(token, "/crm/v3/properties/deals?limit=1");
  });
}
