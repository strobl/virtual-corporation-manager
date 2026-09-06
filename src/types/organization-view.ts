// Adapted from strobl/org-manager-console (source prototype, 7edae2ad).
/**
 * WO-24 Organization and Network Views contracts.
 *
 * The active Organization View and Lens are URL-backed, shareable state.
 * Selection is a cross-view fact (one controller for every mounted view) and
 * routes the Inspector. The Time Window is carried here as an integration
 * seam: WO-27 owns the Play Timeline, this work order only guarantees the
 * window survives view and Lens changes.
 */

/** Views offered on the Organization surface — structure only, no playback. */
export const ORGANIZATION_VIEWS = ['tree', 'org-chart'] as const;
/** Every renderer that exists; `network` lives on the Analytics surface. */
export const ALL_VIEWS = ['tree', 'org-chart', 'network'] as const;
export type OrganizationView = (typeof ALL_VIEWS)[number];
export const DEFAULT_ORGANIZATION_VIEW: OrganizationView = 'tree';

export const LENSES = ['all', 'operating', 'assets'] as const;
export type Lens = (typeof LENSES)[number];
export const DEFAULT_LENS: Lens = 'all';

export const SELECTION_ENTITY_TYPES = ['corporation', 'member', 'factory'] as const;
export type SelectionEntityType = (typeof SELECTION_ENTITY_TYPES)[number];

export interface Selection {
  type: SelectionEntityType;
  id: string;
}

/** Inclusive window; `null` bounds mean "unbounded on that side". */
export interface TimeWindow {
  from: string | null;
  to: string | null;
}

export const OPEN_TIME_WINDOW: TimeWindow = { from: null, to: null };

export interface OrganizationViewState {
  view: OrganizationView;
  lens: Lens;
  selection: Selection | null;
  timeWindow: TimeWindow;
}

/** Raw, untrusted URL search values. Every field may be missing or invalid. */
export interface OrganizationSearch {
  view?: string | undefined;
  lens?: string | undefined;
  sel?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export const INITIAL_ORGANIZATION_VIEW_STATE: OrganizationViewState = {
  view: DEFAULT_ORGANIZATION_VIEW,
  lens: DEFAULT_LENS,
  selection: null,
  timeWindow: OPEN_TIME_WINDOW,
};

/**
 * Renderer seams owned by later work orders. WO-24 mounts placeholders that
 * consume exactly this contract so WO-25/26/27 can drop renderers in without
 * touching the controller.
 */
export interface ViewRendererProps {
  lens: Lens;
  timeWindow: TimeWindow;
  selection: Selection | null;
  onActivate: (selection: Selection | null) => void;
}

export const VIEW_RENDERER_SEAMS = {
  'org-chart': 'WO-25 SVG Org Chart renderer',
  network: 'WO-26 Canvas Network renderer',
  timeline: 'WO-27 Play Timeline',
} as const;

/** Inspector content seams (WO-34/36 own the real panels). */
export const INSPECTOR_PANEL_SEAMS = {
  corporation: 'WO-34 corporation Inspector content',
  member: 'WO-36 member Inspector content',
  factory: 'WO-21 factory Inspector content',
} as const satisfies Record<SelectionEntityType, string>;
