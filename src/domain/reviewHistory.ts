export interface ReviewSnapshot { id: string; assetId: string; revision: number; reviewer: string; decision: 'approved' | 'rejected' | 'annotated'; dependencyRevision: string; notes: string[]; createdAt: string }
export function recordReview(history: ReviewSnapshot[], snapshot: Omit<ReviewSnapshot, 'id' | 'createdAt'>, now = new Date().toISOString()): ReviewSnapshot[] {
  return [...history, { ...snapshot, id: `review-${history.length + 1}`, createdAt: now }]
}
export function latestReview(history: ReviewSnapshot[], assetId: string, revision: number): ReviewSnapshot | undefined { return history.filter((item) => item.assetId === assetId && item.revision === revision).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] }
