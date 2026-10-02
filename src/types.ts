/** A part's status is the ID of a step in its build. */
export type PartStatus = string;
export type StepColor = 'sea' | 'neutral' | 'olive' | 'lemon' | 'indigo' | 'stone' | 'terra' | 'rose' | 'violet' | 'apricot' | 'basil';

export interface Step {
  id: string;
  name: string;
  color: StepColor;
}

export interface Part {
  id: string;
  buildId: string;
  name: string;
  status: PartStatus;
  updatedAt: string; // ISO
  note?: string;
  linkGroupId?: string; // parts sharing this id are one assembly and should stay in step
  /** The assembly's name, held by every member — there is no group record to hang it on. */
  linkGroupName?: string;
}

export interface Build {
  id: string;
  name: string;
  startedAt: string;
  /** A picture of the thing being made — usually the model listing's render at first. */
  image?: string;
  note?: string;
  steps: Step[];
  parts: Part[];
}
// NOTE: there is deliberately NO `deadline`. The old one had no writer and only
// ever described mock data; scheduling has no place here. See ADR-0006.

export interface ToolboxEntry {
  id: string;
  kind: 'tool' | 'technique';
  name: string;
  note?: string;
  iconId: string; // a curated swatch id, or a `data:` URL for an imported icon/photo
  favorite: boolean;
}

export interface State {
  builds: Build[];
  toolbox: ToolboxEntry[];
}

export type Screen = 'dashboard' | 'toolbox';
