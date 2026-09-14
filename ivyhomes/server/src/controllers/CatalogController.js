import { asyncHandler } from '../core/ApiError.js';
import { datasetService } from '../services/DatasetService.js';
import { insightsService } from '../services/InsightsService.js';

/** Read-only endpoints over the corrected snapshot. */
export class CatalogController {
  listings = asyncHandler(async (req, res) => res.json(datasetService.searchListings(req.query)));

  listing = asyncHandler(async (req, res) => {
    const listing = datasetService.getListing(req.params.id);
    res.json({
      listing,
      similar: datasetService.similarTo(listing.listing_id),
      project: listing.project_id ? datasetService.projects.find((p) => p.project_id === listing.project_id) ?? null : null,
    });
  });

  rentals = asyncHandler(async (req, res) => res.json(datasetService.searchRentals(req.query)));
  rental = asyncHandler(async (req, res) => res.json({ rental: datasetService.getRental(req.params.id) }));

  projects = asyncHandler(async (req, res) => res.json(datasetService.searchProjects(req.query)));

  project = asyncHandler(async (req, res) => {
    const project = datasetService.getProject(req.params.id);
    const listings = datasetService.listingsForProject(project.project_id);
    res.json({ project, listings: listings.filter((l) => l.is_live && !l.is_corrupt) });
  });

  facets = asyncHandler(async (_req, res) => res.json(datasetService.facets));
  insights = asyncHandler(async (_req, res) => res.json(insightsService.build()));
}

export const catalogController = new CatalogController();
