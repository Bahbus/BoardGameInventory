export interface MaintenanceRequest {
  operation: "add" | "update" | "remove";
  bggId: string;
  name: string;
  slug: string;
  parentId: string;
  notes: string;
}

export function buildIssueUrl(repositoryUrl: string, request: MaintenanceRequest): string {
  const params = new URLSearchParams({
    template: `inventory-${request.operation}.yml`,
    "bgg-id": request.bggId,
    "game-name": request.name,
    slug: request.slug,
    "parent-bgg-id": request.parentId,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}
