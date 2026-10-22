// The primary action's class list. With PRI_FEATURE_INSTRUMENT on, a v1.0
// page's primary button also carries .c-btn-primary (margin.css): the teal
// pill, the only control allowed the pill radius. With the flag off this is
// the v1.0 class list exactly, so nothing changes there.
import { featureEnabled } from '../platform/features.js';

export const PRIMARY = featureEnabled('instrument') ? 'btn btn-primary c-btn c-btn-primary' : 'btn btn-primary';
