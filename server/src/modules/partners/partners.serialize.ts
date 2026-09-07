import type { PartnerOrganizationDoc } from '../../models/PartnerOrganization';

/** Public-facing partner card (safe for citizens to see on the routing screen). */
export function serializePartnerPublic(p: PartnerOrganizationDoc) {
  return {
    id: String(p._id),
    name: p.name,
    type: p.type,
    location: { lat: p.location.lat, lng: p.location.lng, address: p.location.address ?? '' },
    serviceAreas: p.serviceAreas,
    supportedSchemeCodes: p.supportedSchemeCodes ?? [],
    focusSchemeCodes: p.focusSchemeCodes ?? [],
    authorization: p.authorization,
    status: p.status,
    acceptingApplications: p.acceptingApplications,
    capacity: p.capacity,
    activeAssignments: p.activeAssignments,
    freeSlots: Math.max(0, p.capacity - p.activeAssignments),
    operationalMetricsSimulated: p.operationalMetricsSimulated,
    metricsAsOf: p.metricsAsOf,
  };
}

/** Admin view — adds contact + timestamps. */
export function serializePartnerAdmin(p: PartnerOrganizationDoc) {
  return {
    ...serializePartnerPublic(p),
    contactEmail: p.contactEmail ?? '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
