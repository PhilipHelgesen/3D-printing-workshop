export type PartStatus =
  | 'queued'
  | 'printing'
  | 'smoothing'
  | 'priming'
  | 'painting'
  | 'assembling'
  | 'done';
// NOTE: there is deliberately NO 'failed' status. If a part breaks the maker
// moves it back to 'queued'. Do not add a failure state.

export interface Part {
  id: string;
  buildId: string;
  name: string;
  status: PartStatus;
  updatedAt: string; // ISO
  note?: string;
  curingUntil?: string; // ISO — part is hands-off until this time (also a running print)
  linkGroupId?: string; // parts sharing this id are one assembly and should stay in step
}

export interface Build {
  id: string;
  name: string;
  startedAt: string;
  deadline?: string;
  parts: Part[];
}

export interface ToolboxEntry {
  id: string;
  kind: 'tool' | 'technique';
  name: string;
  note?: string;
  iconId: string; // a curated swatch id, or a `data:` URL for an imported icon/photo
  favorite: boolean;
}

export interface Material {
  name: string;
  stock: 'in stock' | 'running low' | 'none';
}

export interface State {
  builds: Build[];
  toolbox: ToolboxEntry[];
}

export type Screen = 'dashboard' | 'toolbox';
