export interface MaintenanceRequest {
  operation: "add" | "update" | "remove";
  bggId: string;
  sourceUrl: string;
  name: string;
  slug: string;
  parentId: string;
  parentSlug: string;
  notes: string;
}

export interface WishlistRequest {
  bggId: string;
  sourceUrl: string;
  name: string;
  notes: string;
}

export function buildIssueUrl(repositoryUrl: string, request: MaintenanceRequest): string {
  const params = new URLSearchParams({
    template: `inventory-${request.operation}.yml`,
    "bgg-id": request.bggId,
    "source-url": request.sourceUrl,
    "game-name": request.name,
    slug: request.slug,
    "parent-bgg-id": request.parentId,
    "parent-slug": request.parentSlug,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}

export function buildWishlistIssueUrl(repositoryUrl: string, request: WishlistRequest): string {
  const params = new URLSearchParams({
    template: "game-request.yml",
    "bgg-id": request.bggId,
    "source-url": request.sourceUrl,
    "game-name": request.name,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}
