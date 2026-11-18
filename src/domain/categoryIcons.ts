import {
  Box, Boxes, Clapperboard, Landmark, Layers, LayoutTemplate, Lightbulb, Map, Mountain, PersonStanding, Rotate3d, ScanFace, Shirt, Smile, Sofa, Telescope, TreePine, UserRound, Wrench, ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import type { ExtractedAsset } from './productionStudio'
import type { SheetType } from './visualDevelopment'

/** One icon per kind of thing in the production bible. Used everywhere that kind is named, so it reads the same on every screen. */
export const assetIcons: Record<ExtractedAsset['type'], LucideIcon> = {
  character: UserRound,
  costume: Shirt,
  prop: Box,
  set: Mountain,
  environment: Mountain,
} as Record<ExtractedAsset['type'], LucideIcon>

export const assetIconFor = (type: string): LucideIcon => (assetIcons as Record<string, LucideIcon>)[type] ?? Box

/** One icon per reference sheet (the kinds of picture made for a character, costume, prop or set). */
export const sheetIcons: Record<SheetType, LucideIcon> = {
  Identity: ScanFace,
  Turnaround: Rotate3d,
  Expressions: Smile,
  Poses: PersonStanding,
  Wardrobe: Shirt,
  Detail: ZoomIn,
  'Multi-view': Boxes,
  Functional: Wrench,
  Establishing: Telescope,
  Interior: Sofa,
  Exterior: TreePine,
  Layout: Map,
  Lighting: Lightbulb,
}

export const sheetIconFor = (sheet: string): LucideIcon => (sheetIcons as Record<string, LucideIcon>)[sheet] ?? Layers

/** Plain words for what each sheet is, shown as the tooltip on its button. */
export const sheetHints: Record<SheetType, string> = {
  Identity: 'Face and body reference: the picture every other picture is matched to',
  Turnaround: 'Front, side and back views',
  Expressions: 'Faces showing different feelings',
  Poses: 'Body poses and attitudes',
  Wardrobe: 'What this person or costume wears',
  Detail: 'Close-ups of important details',
  'Multi-view': 'The object from several sides',
  Functional: 'How the object is used or opens',
  Establishing: 'The wide first view of the place',
  Interior: 'Inside views',
  Exterior: 'Outside views',
  Layout: 'A plan of where things are',
  Lighting: 'The place in different light',
}

export const sectionIcons = { storyboard: Clapperboard, place: Landmark, layout: LayoutTemplate } as const
