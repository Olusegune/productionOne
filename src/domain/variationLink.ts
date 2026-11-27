/** What a generated picture was made for: one revision of a variation record, and what the picture is for. Kept apart so the queue does not depend on the variation records. */
export interface VariationLink {
  id: string
  revision: number
  /** For example 'garment-preview' or 'fit-candidate'. */
  role: string
  /** Other revisions the picture was made with (the garment a fit used, the body variant), and which reference played which part. */
  uses?: Array<{ id: string; revision: number; role: string; path?: string }>
}
