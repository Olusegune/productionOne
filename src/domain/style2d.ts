import type { StyleBible } from './visualDevelopment'

/**
 * The 2D art styles. Each preset is structured data that is compiled into the actual image request, so choosing one changes what is asked of the image model.
 * A 2D preset describes how a picture LOOKS. It is separate from the animation approach it suits (said in `animation`) and from what the app makes (`output`):
 * one flat raster reference picture. It is not vector artwork, a layered file, a rigged puppet, or an animation.
 * Visual quality of each preset on each model is `unverified` until someone has generated with it and looked.
 */
export interface Style2DSpec {
  id: string
  version: number
  family2d: string
  summary: string
  line: string
  shape: string
  proportions: string
  palette: string
  shading: string
  texture: string
  perspective: string
  background: string
  edges: string
  detail: string
  /** Extra instruction for model sheets, turnarounds and prop sheets. */
  technical: string
  /** Extra instruction for places, backgrounds and storyboard frames. */
  scene: string
  /** Things this style must not look like, written for this style (not one list for every style). */
  avoid: string[]
  /** The animation approach this look suits. Not produced by the app. */
  animation: string
  /** What Production One actually makes. */
  output: string
  /** True when paper grain, brush texture, pencil grain or print texture is part of the look and must survive quality settings. */
  intentionalTexture: boolean
  providerNote: string
  visualStatus: 'unverified' | 'live-tested'
  /** What a real test found, when visualStatus is live-tested: the date, the model and what was and was not checked. */
  liveNote?: string
  preview: { kind: 'schematic'; provenance: string }
}

export const OUTPUT_2D = 'One flat 2D raster reference picture per view. Not vector artwork, not a layered file, not a rigged puppet, not an animation file, and not frame-by-frame animation.'

export const FAMILIES_2D = {
  drawn: '2D · Drawn and cel animation',
  anime: '2D · Anime-inspired',
  paint: '2D · Storybook and painterly',
  graphic: '2D · Graphic and vector',
  ink: '2D · Comics and ink',
  pixel: '2D · Pixel art',
} as const
export type Family2D = (typeof FAMILIES_2D)[keyof typeof FAMILIES_2D]

const familyDefaults: Record<Family2D, { perspective: string; background: string; technical: string; scene: string }> = {
  [FAMILIES_2D.drawn]: {
    perspective: 'Drawn perspective with clear, simple vanishing points; characters sit in the picture plane like animation layouts',
    background: 'Painted or inked background kept simpler and softer than the characters so they read first',
    technical: 'Animation model-sheet clarity: the subject alone on the plain flat field, even flat lighting, no cast shadow, no scenery, construction and proportions easy to read.',
    scene: 'A drawn layout in this style: clear staging, simple readable depth by overlap and size, no camera lens effects.',
  },
  [FAMILIES_2D.anime]: {
    perspective: 'Illustrated perspective with simple confident vanishing points; wide shots favour clean architecture lines',
    background: 'Background art drawn in the same world as the characters, usually a little softer and more detailed than the characters',
    technical: 'Character-design sheet clarity: the subject alone on the plain flat field, even flat lighting, no cast shadow, no scenery, clean construction readable from the line work.',
    scene: 'An illustrated background or key frame in this style: clear staging, drawn depth, no photographic depth of field or lens effects.',
  },
  [FAMILIES_2D.paint]: {
    perspective: 'Illustrator\'s perspective: believable but loose, bending where it helps the picture; no strict lens geometry',
    background: 'Washes, brushwork or soft shapes that carry the mood; edges dissolve into the paper rather than ending in a hard frame',
    technical: 'Reference-sheet clarity in the medium: the subject alone on the plain field, even light, no cast shadow, no scenery, shapes and colours readable; the medium\'s texture stays.',
    scene: 'A finished illustration in the medium: composed like a storybook page, with the medium\'s texture and no photographic effects.',
  },
  [FAMILIES_2D.graphic]: {
    perspective: 'Flattened or stylised perspective; depth by overlap, scale and colour layering instead of lens geometry',
    background: 'Simple shapes and flat fields; the background is part of the same graphic system as the subject',
    technical: 'Design-sheet clarity: the subject alone on the plain flat field, no cast shadow, no scenery, shapes crisp and readable.',
    scene: 'A designed picture made of the same shapes and colours as the characters: clear composition, depth by layering, no photographic effects.',
  },
  [FAMILIES_2D.ink]: {
    perspective: 'Drawn perspective chosen for drama; strong foreshortening allowed; no lens geometry',
    background: 'Inked or toned background that supports the value design; negative space is deliberate',
    technical: 'Character-sheet clarity in ink: the subject alone on the plain field, even value structure, no cast shadow, no scenery, line weight readable.',
    scene: 'An inked scene with deliberate value design and negative space; no photographic depth of field, grain or lens effects.',
  },
  [FAMILIES_2D.pixel]: {
    perspective: 'Orthographic or simple pixel-art perspective on the same pixel grid; no smooth rotation or scaling',
    background: 'A flat colour field or a simple tile-like backdrop on the same grid',
    technical: 'Sprite-sheet clarity: the subject alone on the plain flat field at one coherent pixel scale, aligned to the pixel grid, no scenery, no cast shadow.',
    scene: 'A pixel-art scene at one coherent pixel scale with a limited palette; every element on the same grid.',
  },
}

interface Input {
  id: string
  name: string
  family: Family2D
  summary: string
  line: string
  shape: string
  proportions: string
  palette: string
  shading: string
  texture: string
  edges: string
  detail: string
  avoid: string[]
  animation: string
  colors: [string, string, string, string]
  intentionalTexture?: boolean
  perspective?: string
  background?: string
  technical?: string
  scene?: string
  providerNote?: string
}

/** Styles that were generated with a real image model and looked at. One test each: a character front view made from a description. Everything not listed here is unverified. */
const LIVE = 'Live-tested 2026-11-19 on Kie.ai (google/pro-image-to-image): one character front view made from a text description. The style was clearly followed, on a flat neutral background with no photographic look. One test only: other models, other views and other subjects are not checked.'
const liveTests: Record<string, string> = {
  '2d-clean-digital-cel': LIVE,
  '2d-watercolor-storybook': LIVE,
  '2d-flat-vector': LIVE,
  '2d-graphic-novel': LIVE,
  '2d-pixel-low': LIVE + ' The pixels looked coherent, but they are the model\'s own drawing, not a true pixel grid: clean-up in a pixel editor may be needed.',
}

const DEFAULT_PROVIDER_NOTE = 'Request construction is supported on every image provider here. Visual quality has not been checked on any model for this style: make one view first and look at it before generating a whole sheet.'

function build(i: Input): { spec: Style2DSpec; style: StyleBible } {
  const f = familyDefaults[i.family]
  const spec: Style2DSpec = {
    id: i.id, version: 1, family2d: i.family, summary: i.summary, line: i.line, shape: i.shape, proportions: i.proportions, palette: i.palette, shading: i.shading, texture: i.texture,
    perspective: i.perspective ?? f.perspective, background: i.background ?? f.background, edges: i.edges, detail: i.detail,
    technical: i.technical ?? f.technical, scene: i.scene ?? f.scene, avoid: i.avoid, animation: i.animation, output: OUTPUT_2D,
    intentionalTexture: i.intentionalTexture ?? false, providerNote: i.providerNote ?? DEFAULT_PROVIDER_NOTE, visualStatus: liveTests[i.id] ? 'live-tested' : 'unverified', ...(liveTests[i.id] ? { liveNote: liveTests[i.id] } : {}),
    preview: { kind: 'schematic', provenance: 'A schematic swatch drawn by the app from this preset\'s settings. It is not an example image made by a model.' },
  }
  const style: StyleBible = {
    name: i.name, description: i.summary, palette: [...i.colors], materials: i.texture, rendering: `Flat 2D: ${i.shading}`, lighting: 'Flat, even lighting that suits the style (no studio or cinematic light)',
    locked: false, revision: 1, family: i.family, animationApproach: i.animation, shapeLanguage: i.shape, surfaceTreatment: i.texture, lineTreatment: i.line, detailLevel: i.detail, spec2d: spec,
  }
  return { spec, style }
}

const A = FAMILIES_2D.drawn, B = FAMILIES_2D.anime, C = FAMILIES_2D.paint, D = FAMILIES_2D.graphic, E = FAMILIES_2D.ink, F = FAMILIES_2D.pixel

const inputs: Input[] = [
  // ---------- A. Drawn and cel animation ----------
  { id: '2d-handdrawn-feature', name: 'Traditional hand-drawn feature animation', family: A, summary: 'Rich hand-drawn character animation: fluid, weighty forms with soft, varied pencil-and-ink line and painted colour.',
    line: 'Hand-inked line that thickens and thins with pressure, slightly broken where light hits, coloured darker than the fill on lit areas', shape: 'Organic, curving, built from flowing gesture lines with clear secondary shapes', proportions: 'Appealing, slightly stylised proportions with a strong silhouette and expressive hands and face',
    palette: 'Rich, harmonised colour with warm lights and cooler shadows', shading: 'Soft painted shadow shapes with gentle gradients inside the form', texture: 'Subtle painted and pencil grain, never plastic', edges: 'Soft where form turns, crisp on silhouette', detail: 'Moderate: clothing folds and hair clumps simplified to readable shapes',
    avoid: ['3D render or CG look', 'photographic skin or lens effects', 'hard cel-shaded outlines of uniform weight'], animation: 'Full character animation, drawn frame by frame', colors: ['#2b2a33', '#c9894f', '#6e8fa0', '#efe2c4'] },
  { id: '2d-clean-digital-cel', name: 'Clean digital cel animation', family: A, summary: 'Crisp digital cel look: confident uniform outlines, flat fills and one clear shadow shape.',
    line: 'Clean, smooth vector-like outline of even weight, closed shapes, no sketchiness', shape: 'Simple, clear, geometric-organic shapes that animate cleanly', proportions: 'Consistent, designed proportions; model-sheet precise',
    palette: 'Flat local colours with a small, harmonised palette per character', shading: 'Flat fills with one hard-edged shadow shape and an optional highlight shape; no gradients', texture: 'None: smooth flat colour', edges: 'Crisp and clean everywhere', detail: 'Low to moderate; patterns simplified',
    avoid: ['soft airbrushed gradients', 'photographic or 3D shading', 'painterly texture', 'sketchy overlapping lines'], animation: 'Digital cel animation with simple shadow shapes', colors: ['#1c2330', '#e0635a', '#4aa3b5', '#f4ecd8'] },
  { id: '2d-limited-tv', name: 'Limited-animation television', family: A, summary: 'Economical television-cartoon look: bold simple shapes, flat colour, graphic design over detail.',
    line: 'Bold, simple outline, often thicker than in feature animation, minimal interior lines', shape: 'Strong, graphic, easily repeated shapes designed to be redrawn quickly', proportions: 'Stylised and consistent; heads and hands simplified',
    palette: 'Flat, saturated, limited palette with strong contrast between foreground and background', shading: 'Almost none: flat colour, rare single shadow tone', texture: 'None, or a faint background paint texture', edges: 'Crisp', detail: 'Low: only what reads at small size',
    avoid: ['rendered shading or gradients', 'fine realistic detail', '3D or photographic look'], animation: 'Limited animation with held poses and reused drawings', colors: ['#202938', '#f2b134', '#d4503c', '#7cc6c1'] },
  { id: '2d-expressive-cartoon', name: 'Expressive cartoon', family: A, summary: 'Elastic, exaggerated cartoon design built for big acting and squash and stretch.',
    line: 'Lively brush-like line with confident variation, curves pushed to extremes', shape: 'Rounded, elastic, exaggerated shapes; big readable silhouettes', proportions: 'Strongly exaggerated: huge heads or hands, tiny or stretched bodies as the character needs',
    palette: 'Bright, punchy, contrasting colour with funny colour accents', shading: 'Simple flat shadow shapes or none; mood comes from colour', texture: 'None', edges: 'Crisp with rounded forms', detail: 'Low to moderate; the pose and face carry the picture',
    avoid: ['realistic proportions', 'subtle naturalistic acting', '3D or photographic rendering'], animation: 'Expressive cartoon acting with squash and stretch', colors: ['#2a1f3a', '#ff7a3d', '#38b6a8', '#ffe08a'] },
  { id: '2d-restrained-natural', name: 'Restrained naturalistic 2D', family: A, summary: 'Quiet, believable drawn animation: natural proportions, soft colour and subtle acting.',
    line: 'Fine, soft line close in colour to the fill, light variation, nothing decorative', shape: 'Natural, observed shapes with minimal exaggeration', proportions: 'True-to-life proportions drawn with a light stylised hand',
    palette: 'Muted, harmonised everyday colour; gentle contrasts', shading: 'Soft, naturalistic shadow shapes with mild gradients', texture: 'A faint paper or paint grain', edges: 'Soft and natural', detail: 'Moderate: believable clothing, hair and places drawn simply',
    avoid: ['cartoon exaggeration', 'photographic skin or lens effects', '3D render look', 'strong black outlines'], animation: 'Naturalistic performance with restrained acting', colors: ['#2a2e33', '#a98c68', '#7b8f8a', '#e9e2d3'], intentionalTexture: true },
  { id: '2d-retro-theatrical', name: 'Retro theatrical cartoon', family: A, summary: 'Mid-century theatrical shorts: stylised, snappy, graphic shapes on painted backgrounds.',
    line: 'Confident ink line with slight wobble, thin to medium weight', shape: 'Angular-meets-round mid-century design; caricatured and graphic', proportions: 'Stylised with small bodies, large expressive heads and limbs that bend freely',
    palette: 'Limited, slightly dusty vintage colour; backgrounds painted in flatter, muted tones', shading: 'Flat colour with a simple cast of one darker tone', texture: 'Light print and paper grain typical of old film', edges: 'Crisp', detail: 'Low to moderate',
    avoid: ['modern glossy gradients', '3D or photographic look', 'digital lens flare'], animation: 'Theatrical short cartoon timing', colors: ['#2e2a28', '#c94f3a', '#e8b84a', '#7fa79a'], intentionalTexture: true },
  { id: '2d-rubber-hose', name: 'Rubber-hose cartoon', family: A, summary: '1930s rubber-hose characters: tube limbs, circle shapes and chunky black ink.',
    line: 'Thick, rounded black ink outline of even weight', shape: 'Circles and tubes: round heads, pie-cut eyes, noodle limbs with no joints', proportions: 'Tiny bodies, huge round heads, tube arms and legs, white-gloved hands',
    palette: 'Black and white with optional limited flat colour', shading: 'None or a few ink spots; flat fills', texture: 'A trace of old-film grain and ink bleed', edges: 'Crisp and rounded', detail: 'Low',
    avoid: ['realistic anatomy', 'gradient shading', '3D or photographic look', 'modern thin line'], animation: 'Bouncy rubber-hose limited cycles', colors: ['#111111', '#f1ead7', '#c8372d', '#6b8aa3'], intentionalTexture: true },
  { id: '2d-european-clean-line', name: 'Clean-line European illustration', family: A, summary: 'Clear, even-line illustration with flat, airy colour in the tradition of European adventure comics and books.',
    line: 'Even, precise, mid-weight line of constant thickness; no hatching', shape: 'Simplified yet realistic forms; architecture drawn carefully', proportions: 'Realistic proportions with slightly simplified features',
    palette: 'Flat, open, harmonised colour with soft complementary accents', shading: 'Flat colour with minimal shading, mostly shadow shapes in a darker tint', texture: 'None: smooth flat colour', edges: 'Crisp and clean', detail: 'Moderate to high in backgrounds and costume, drawn with the same even line',
    avoid: ['painterly texture', 'photographic or 3D rendering', 'line-weight variation for drama'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#1d2733', '#d6643c', '#4c8da8', '#f0e6c8'] },

  // ---------- B. Anime-inspired (described by their look, not by studio or artist) ----------
  { id: '2d-anime-classic-cel', name: 'Classic cel-anime aesthetic', family: B, summary: 'Hand-painted cel look: dark-toned line, flat colour, one shadow tone and slightly muted, film-like colour.',
    line: 'Fine to medium line in a dark tone matched to the colour (not pure black), tapering at the ends', shape: 'Slim, angular-leaning figures with large expressive eyes and sharp hair clumps', proportions: 'Long limbs, small mouth and nose, large eyes; slender stylised proportions',
    palette: 'Slightly muted, film-like colour with soft pastel highlights', shading: 'Flat fill with a single hard shadow shape and a simple highlight', texture: 'A light film-grain softness only on backgrounds', edges: 'Crisp on characters', detail: 'Moderate: hair in clumps, clothing folds as a few lines',
    avoid: ['3D render', 'photographic realism', 'soft airbrushed shading', 'western cartoon exaggeration'], animation: 'Cel animation on twos with held cuts', colors: ['#2a2f45', '#d9a09a', '#7aa7c7', '#efe6d6'] },
  { id: '2d-anime-contemporary', name: 'Contemporary clean-line anime', family: B, summary: 'Modern digital anime: very clean line, polished colour, light gradients and glowing highlights.',
    line: 'Very clean, thin-to-medium coloured lines, perfectly smooth', shape: 'Polished, graceful shapes, detailed eyes with layered highlights', proportions: 'Slender, idealised proportions with detailed hair and clothing',
    palette: 'Bright, clean, high-clarity colour with luminous accents', shading: 'Layered soft cel shadows with subtle gradients and rim light', texture: 'None', edges: 'Crisp with soft light bloom allowed only as a drawn glow', detail: 'High in eyes, hair and costume',
    avoid: ['3D or CG render look', 'photographic skin texture', 'muddy colour', 'heavy outlines'], animation: 'Digital anime animation with selective detail', colors: ['#1b2540', '#5ec2e6', '#f08ab8', '#fbf3e6'] },
  { id: '2d-chibi', name: 'Simplified chibi', family: B, summary: 'Cute, compact chibi design: tiny bodies, oversized heads, minimal features and bold simple colour.',
    line: 'Rounded, medium-weight clean line, few interior lines', shape: 'Round and soft; blob-like torso, short stubby limbs', proportions: 'About two to three heads tall: giant head, tiny body, hands and feet as simple mitts',
    palette: 'Bright, soft, high-key colour', shading: 'Flat colour with a soft simple shadow tone and one cheek blush', texture: 'None', edges: 'Rounded and clean', detail: 'Very low: features reduced to dots and small shapes',
    avoid: ['realistic proportions', 'detailed anatomy', '3D or photographic look'], animation: 'Simple bouncy limited animation', colors: ['#3a3050', '#ff8fb1', '#8fd3f4', '#fff1d6'] },

  // ---------- C. Storybook and painterly ----------
  { id: '2d-gouache', name: 'Gouache illustration', family: C, summary: 'Opaque matte gouache: flat blocks of rich colour with soft brush edges and a chalky finish.',
    line: 'Little or no outline; shapes defined by colour blocks, with occasional thin painted line', shape: 'Simplified, graphic shapes with confident brush edges', proportions: 'Stylised and simple, often a little blocky',
    palette: 'Rich, opaque, slightly chalky colour; harmonised limited palette', shading: 'Flat blocks with painted tonal steps; layered opaque colour, not transparent glazes', texture: 'Visible brush marks and paper tooth under matte paint', edges: 'Soft painterly edges where blocks meet', detail: 'Low to moderate',
    avoid: ['glossy or glowing digital shading', 'transparent watercolour washes', '3D or photographic look', 'hard vector outlines'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#2a3347', '#d97d4a', '#5f8f86', '#f0e2c2'], intentionalTexture: true },
  { id: '2d-ink-watercolor', name: 'Ink and watercolor', family: C, summary: 'Loose pen-and-ink drawing with transparent watercolour washes that bleed past the line.',
    line: 'Loose pen line, varied and slightly scratchy, often broken', shape: 'Sketchy and organic; forms suggested rather than closed', proportions: 'Observational and slightly exaggerated',
    palette: 'Transparent, light, slightly uneven colour with white paper left showing', shading: 'Washes layered wet-on-wet and dry, colour pooling at edges', texture: 'Paper grain, pigment blooms and granulation', edges: 'Soft, bleeding edges and deliberate white gaps', detail: 'Moderate in the ink, low in the colour',
    avoid: ['opaque flat fills', 'digital gradients', '3D or photographic look', 'perfectly clean line'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#2c3a4a', '#d99b6c', '#7fa9a6', '#f5efe2'], intentionalTexture: true },
  { id: '2d-soft-pastel', name: 'Soft pastel', family: C, summary: 'Chalky soft pastel: velvety blended colour, gentle edges and a dreamy, quiet mood.',
    line: 'No hard outline; soft crayon-like edges and occasional pastel-stick line', shape: 'Soft, rounded, simplified shapes', proportions: 'Gentle and simplified',
    palette: 'Muted, powdery, harmonised pastels with soft contrast', shading: 'Smooth blended tonal transitions with chalky layering', texture: 'Visible chalk grain and paper tooth', edges: 'Very soft and smudged', detail: 'Low',
    avoid: ['sharp vector edges', 'strong black outlines', 'glossy or 3D rendering', 'photographic look'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#4a4560', '#e7a6b0', '#9fc4bd', '#f6ecdc'], intentionalTexture: true },
  { id: '2d-colored-pencil', name: 'Colored pencil', family: C, summary: 'Layered coloured-pencil drawing: visible directional strokes, built-up colour and white-paper highlights.',
    line: 'Fine pencil contour in a darker tone of the local colour, slightly wavering', shape: 'Observational, gently simplified forms', proportions: 'Natural with a light hand-drawn wobble',
    palette: 'Layered, slightly waxy colour that builds from light to dark', shading: 'Hatched and cross-hatched strokes and smooth burnished passes', texture: 'Paper tooth and visible pencil strokes', edges: 'Soft strokes; lights left as bare paper', detail: 'Moderate to high in focus areas',
    avoid: ['digital smooth gradients', 'airbrushed shading', '3D or photographic look', 'hard vector outline'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#3b3a46', '#d1794e', '#6d9a73', '#f3ecdc'], intentionalTexture: true },
  { id: '2d-textured-pencil', name: 'Textured pencil drawing', family: C, summary: 'Graphite or charcoal pencil drawing: tonal shading, grainy texture and a hand-sketched feel.',
    line: 'Graphite line from light construction to dark accents, with visible overdrawing', shape: 'Sketched forms with visible construction', proportions: 'Observational',
    palette: 'Monochrome graphite greys on warm off-white paper (colour only if asked)', shading: 'Smudged and hatched tonal modelling', texture: 'Rough paper grain, smudges and eraser marks', edges: 'Soft smudged edges with some crisp accents', detail: 'Moderate to high where the drawing is resolved, looser elsewhere',
    avoid: ['clean digital line', 'flat colour fills', '3D or photographic look', 'glossy shading'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#2a2a2a', '#7a7a76', '#b9b5ab', '#efeadf'], intentionalTexture: true },
  { id: '2d-painterly-digital', name: 'Painterly digital 2D', family: C, summary: 'Digital painting with visible brushwork: confident strokes, rich colour and clear light, still flat 2D.',
    line: 'No outline; edges made by value and colour change with a few lost-and-found edges', shape: 'Big readable shapes built from brush planes', proportions: 'Natural to lightly stylised',
    palette: 'Rich, harmonised colour with warm and cool temperature shifts', shading: 'Painted form and cast shadows with controlled soft gradients', texture: 'Visible digital brush marks, no photographic grain', edges: 'Lost and found: soft in shadow, crisp at the focal point', detail: 'Moderate; detail only at the focus',
    avoid: ['3D render look', 'photographic texture or lens effects', 'plastic smooth airbrush', 'uniform outline'], animation: 'Not an animation style; suits painted frames', colors: ['#232a35', '#c98b55', '#5e8a99', '#e9dcc0'], intentionalTexture: true },
  { id: '2d-folk-art', name: 'Folk-art illustration', family: C, summary: 'Folk-art pattern and symbol: flat decorative shapes, repeating ornament and bright traditional colour.',
    line: 'Simple, even painted outline or none; ornament drawn as repeated marks', shape: 'Flat, symmetrical, decorative shapes with pattern fills', proportions: 'Naive and simplified; no foreshortening',
    palette: 'Bright, bold, traditional colour with strong contrasts', shading: 'None: pattern and colour carry the form', texture: 'Painted wood or paper surface suggested lightly', edges: 'Crisp painted edges', detail: 'Moderate, in ornament and pattern rather than anatomy',
    avoid: ['realistic shading', 'depth and perspective', '3D or photographic look', 'gradient colour'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#2b2a4a', '#d6452f', '#e8b53a', '#4e9a6e'], intentionalTexture: true },

  // ---------- D. Graphic and vector ----------
  { id: '2d-flat-vector', name: 'Flat vector', family: D, summary: 'Clean flat vector shapes: solid colour, crisp edges, no outlines or gradients needed.',
    line: 'No outline, or a very thin uniform one; shapes are defined by colour', shape: 'Clean geometric and rounded vector shapes, simplified', proportions: 'Simplified, consistent, often slightly stylised',
    palette: 'Flat, limited, harmonised palette of solid colours', shading: 'Flat fills with at most one or two flat shadow tones; no gradients or textures', texture: 'None', edges: 'Perfectly crisp and smooth', detail: 'Low',
    avoid: ['gradients and soft shading', 'texture or grain', '3D, glossy or photographic look', 'sketchy line'], animation: 'Motion-graphics style; suits simple rigged animation (not produced here)', colors: ['#1f2937', '#ef6b57', '#3fb8af', '#f4efe3'] },
  { id: '2d-bold-geometric', name: 'Bold geometric', family: D, summary: 'Everything built from circles, triangles and rectangles in strong, high-contrast colour.',
    line: 'No outline; hard shape edges', shape: 'Strict geometry: circles, triangles, squares and arcs, sharply cut', proportions: 'Abstracted into geometric blocks while staying recognisable',
    palette: 'Bold, saturated, high-contrast colour blocks', shading: 'Flat shapes and hard-edged shadow wedges only', texture: 'None', edges: 'Razor crisp', detail: 'Very low',
    avoid: ['organic soft shapes', 'gradients', '3D or photographic look', 'fine detail'], animation: 'Graphic motion design', colors: ['#16213a', '#f25c4c', '#f2c230', '#2fa6a0'] },
  { id: '2d-minimalist-editorial', name: 'Minimalist editorial', family: D, summary: 'Sparse editorial illustration: few shapes, lots of space, a restrained palette and clever simplification.',
    line: 'Thin, confident line used sparingly, or none', shape: 'Few simple shapes that imply the whole', proportions: 'Elegantly simplified and elongated',
    palette: 'Two to four muted colours with generous white space', shading: 'Minimal: flat tone or none', texture: 'A hint of paper', edges: 'Clean', detail: 'Very low: what is left out matters',
    avoid: ['busy detail', 'gradients', '3D or photographic look', 'strong outlines'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#252a31', '#c7794f', '#8fa7a0', '#f3efe6'], intentionalTexture: true },
  { id: '2d-midcentury', name: 'Mid-century modern illustration', family: D, summary: 'Mid-century graphic design: angular shapes, offset colour, textured flats and a calm optimistic mood.',
    line: 'Thin line floating beside the colour, deliberately offset from the fills (loose registration)', shape: 'Angular, stylised, atomic-age shapes; boomerangs and starbursts', proportions: 'Stylised, long limbed and elegant',
    palette: 'Warm muted teal, mustard, orange, olive and cream', shading: 'Flat shapes with overprint-like darker overlaps', texture: 'Light grain and print texture', edges: 'Crisp with slight misregistration', detail: 'Low',
    avoid: ['gradients', 'glossy 3D rendering', 'photographic look', 'neon colour'], animation: 'Mid-century graphic motion (not produced here)', colors: ['#25465a', '#e0a431', '#d4622b', '#efe2c0'], intentionalTexture: true },
  { id: '2d-silhouette-puppet', name: 'Silhouette and shadow-puppet', family: D, summary: 'Pure black silhouettes on glowing flat backgrounds, with cut-out joints and open detail shapes.',
    line: 'No line: all form is the outer silhouette with small cut-out openings', shape: 'Intricate cut-out silhouettes with clear jointed limbs', proportions: 'Stylised, profile-based, long limbs and strong profile read',
    palette: 'Black shapes on one or two warm or cool flat colours', shading: 'None: solid black with cut-out light openings', texture: 'None', edges: 'Crisp, like cut paper or leather', detail: 'Detail only as cut-out openings and edge shapes',
    technical: 'Silhouette sheet: the subject as a solid black shape on the plain flat field, shown in clean profile or front pose; no interior shading, no scenery.',
    avoid: ['interior shading or colour', 'gradients', '3D or photographic look', 'outline-only drawing'], animation: 'Shadow-puppet animation with jointed pieces (not produced here)', colors: ['#0e0e12', '#f0b44c', '#5b7d96', '#f4e8cf'] },
  { id: '2d-paper-cutout', name: 'Paper-cutout aesthetic', family: D, summary: 'Flat 2D pictures that look cut from coloured paper: crisp edges, layered shapes and small shadows between layers.',
    line: 'No outline; the cut edge of each paper piece is the line', shape: 'Simple cut shapes with slightly irregular scissor edges, stacked in layers', proportions: 'Simplified and chunky so each piece can be cut',
    palette: 'Flat coloured papers with a limited harmonised set', shading: 'A thin soft shadow under each layer; otherwise flat', texture: 'Fine visible paper fibre on each piece', edges: 'Crisp cut edges, slightly uneven', detail: 'Low to moderate, built as layers',
    avoid: ['painted gradients', '3D sculpted depth beyond layering', 'photographic look', 'drawn outlines'], animation: 'Cut-out animation (not produced here)', colors: ['#2d3a55', '#e4604a', '#f2c14e', '#7fb69e'], intentionalTexture: true },
  { id: '2d-collage-mixed', name: 'Collage and mixed-media 2D', family: D, summary: 'Mixed collage: torn paper, printed textures, drawn line and painted shapes combined in one flat picture.',
    line: 'Mixed: hand-drawn marker or pencil line over cut and torn shapes', shape: 'Irregular torn and cut shapes combined with drawn forms', proportions: 'Expressive and simplified',
    palette: 'Varied but controlled: found-paper colours with one accent', shading: 'Texture and overlap rather than shading; occasional painted shadow', texture: 'Torn edges, print textures, tape, staples and paint marks', edges: 'Torn and cut edges', detail: 'Moderate, varied between pieces',
    avoid: ['smooth digital gradients', '3D or photographic look', 'one uniform line style', 'real photographs as the subject'], animation: 'Cut-out and collage animation (not produced here)', colors: ['#32302f', '#cf5f45', '#d9b85f', '#6f93a0'], intentionalTexture: true },
  { id: '2d-screenprint', name: 'Screen-print / limited-ink aesthetic', family: D, summary: 'Screen-print poster: two to four flat inks, overprint blends and slightly off registration.',
    line: 'Bold flat shapes, or a single dark ink line as one of the layers', shape: 'Graphic, poster-like shapes with strong silhouettes', proportions: 'Stylised and simplified',
    palette: 'Two to four flat inks only; overlaps make new mixed colours', shading: 'Flat ink layers with overprint overlaps; halftone dots allowed for tone', texture: 'Ink grain and slight misregistration on a paper stock', edges: 'Crisp with slight offset between layers', detail: 'Low to moderate',
    avoid: ['gradients and soft blends', 'more than four flat inks', '3D or photographic look', 'digital glow'], animation: 'Not an animation style; suits poster-like frames', colors: ['#22263a', '#e8453c', '#f4c430', '#3aa0a8'], intentionalTexture: true },

  // ---------- E. Comics and ink ----------
  { id: '2d-clean-line-comic', name: 'Clean-line comic', family: E, summary: 'Modern comic art: smooth confident inks with flat colour and simple cel-like shadows.',
    line: 'Smooth, confident inked line with clear weight variation, thicker on the outside contour', shape: 'Strong, readable, dynamic forms', proportions: 'Heroic or natural proportions drawn with graphic clarity',
    palette: 'Flat digital colour, saturated but controlled', shading: 'Flat colour with hard-edged shadow shapes and spot blacks', texture: 'None: clean digital finish', edges: 'Crisp', detail: 'Moderate',
    avoid: ['painterly texture', 'photographic or 3D rendering', 'soft airbrush shading'], animation: 'Not an animation style; suits comic panels', colors: ['#151a25', '#e05a3a', '#3b7fa3', '#f1e6c9'] },
  { id: '2d-graphic-novel', name: 'Graphic novel', family: E, summary: 'Book-length ink drawing with considered colour: expressive line, textured shading and mood over polish.',
    line: 'Expressive hand-inked line with strong weight variation and some dry-brush breaks', shape: 'Grounded, observed forms with strong shapes', proportions: 'Natural, grounded, individual characters',
    palette: 'Restrained, mood-driven colour, often with one dominant hue', shading: 'Hatching, spot blacks and flat colour or wash tones; no airbrush', texture: 'Ink and paper texture, subtle grain', edges: 'Mix of crisp ink and soft wash', detail: 'Moderate to high in faces and places',
    avoid: ['clean vector uniformity', 'photographic or 3D look', 'glossy gradients', 'bright cartoon colour'], animation: 'Not an animation style; suits comic and storyboard frames', colors: ['#14171c', '#a6573c', '#58747c', '#e8dfc9'], intentionalTexture: true },
  { id: '2d-manga-mono', name: 'Manga-inspired monochrome', family: E, summary: 'Black-and-white manga page: fine ink line, screentone greys and strong speed and emotion.',
    line: 'Fine to medium ink line, tapering, with speed lines and thick-thin variation', shape: 'Slender graceful figures, large expressive eyes, sharp hair', proportions: 'Slender, stylised proportions',
    palette: 'Black ink and white paper only, with screentone greys', shading: 'Screentone dot patterns and hatching in black and grey', texture: 'Screentone dots and clean ink', edges: 'Crisp', detail: 'Moderate to high in hair, clothes and backgrounds',
    avoid: ['colour', 'soft gradients', '3D or photographic look', 'painted texture'], animation: 'Not an animation style; suits manga panels', colors: ['#0e0e0e', '#555555', '#bdbdbd', '#f6f4ef'] },
  { id: '2d-ink-brush', name: 'Ink-brush illustration', family: E, summary: 'Calligraphic brush-ink drawing: sweeping tapered strokes, bold blacks and dry-brush texture.',
    line: 'Loaded-brush stroke that swells and tapers, with dry-brush breakup', shape: 'Gestural, economical shapes found in a few strokes', proportions: 'Expressive and economical',
    palette: 'Black ink on pale paper with one optional accent colour', shading: 'Grey ink washes and solid black masses', texture: 'Dry-brush bristle marks and paper grain', edges: 'Varied: sharp at stroke starts, feathered at ends', detail: 'Low: strokes carry everything',
    avoid: ['uniform digital line', 'gradient colour', '3D or photographic look', 'over-detailed rendering'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#0f0f10', '#6a6a66', '#b6b2a6', '#f1ece0'], intentionalTexture: true },
  { id: '2d-halftone-print', name: 'Halftone / vintage print', family: E, summary: 'Vintage four-colour print: visible halftone dots, off-register inks and yellowed paper.',
    line: 'Bold black ink outline in the print plate', shape: 'Graphic comic-book shapes', proportions: 'Stylised, heroic or caricatured',
    palette: 'Four-colour print palette: cyan, magenta, yellow and black on aged paper', shading: 'Halftone dot gradients and flat spot colours', texture: 'Visible halftone dots, off-register colour, paper toning and ink spread', edges: 'Slightly soft from ink spread', detail: 'Moderate',
    avoid: ['smooth digital gradients', '3D or photographic look', 'perfect registration', 'clean glossy finish'], animation: 'Not an animation style; suits comic panels', colors: ['#1d1c22', '#2fa7c9', '#e03a8e', '#f3e7a3'], intentionalTexture: true },

  // ---------- F. Pixel art ----------
  { id: '2d-pixel-low', name: 'Low-resolution pixel art', family: F, summary: 'Chunky low-resolution pixel art: very few pixels per character, tiny palette and hard blocky edges.',
    line: 'One-pixel outline or none, drawn on the grid', shape: 'Blocky silhouettes, details reduced to single pixels', proportions: 'Compact, chunky, readable at a glance (about 16 to 32 pixels tall)',
    palette: 'A small fixed palette of 8 to 16 colours; no blended colours', shading: 'Flat colour with one or two stepped tones; dithering only if asked', texture: 'None: crisp square pixels', edges: 'Hard stair-stepped pixel edges, no anti-aliasing', detail: 'Very low',
    technical: 'Sprite-sheet clarity: the subject alone on the plain flat field at one coherent pixel scale, every pixel the same size, aligned to the grid, no smoothing.',
    avoid: ['smooth or anti-aliased edges', 'mixed pixel sizes', 'gradients and blur', '3D or photographic look'], animation: 'Frame-by-frame sprite animation (not produced here)', colors: ['#1a1c2c', '#b13e53', '#38b764', '#f4f4f4'],
    providerNote: 'Request construction is supported. Image models often draw soft or inconsistent pixels: check the pixel scale on one view first. A true pixel grid may need clean-up in a pixel editor.' },
  { id: '2d-pixel-detailed', name: 'Detailed pixel art', family: F, summary: 'High-detail pixel art: a larger canvas, a richer palette, careful shading and clean hand-placed pixels.',
    line: 'Selective outline in darker tones of the fill colour, placed pixel by pixel', shape: 'Readable forms with hand-placed detail clusters', proportions: 'Natural to stylised, about 48 to 96 pixels tall',
    palette: 'A richer palette of 32 to 64 colours in ramps', shading: 'Stepped colour ramps with controlled dithering and selective anti-aliasing', texture: 'None: crisp square pixels', edges: 'Stair-stepped with clean pixel clusters, no blur', detail: 'High but every pixel intentional',
    technical: 'Sprite-sheet clarity: the subject alone on the plain flat field at one coherent pixel scale, aligned to the grid, no scenery, no smooth scaling.',
    avoid: ['blurry or smoothed pixels', 'mixed pixel sizes', 'photographic noise or gradients', '3D or photographic look'], animation: 'Frame-by-frame sprite animation (not produced here)', colors: ['#1b1b2f', '#c8553d', '#5ea36a', '#ede6d1'],
    providerNote: 'Request construction is supported. Image models often draw soft or inconsistent pixels: check the pixel scale on one view first. A true pixel grid may need clean-up in a pixel editor.' },
]

const built = inputs.map(build)
/** The new 2D presets. */
export const styles2D: StyleBible[] = built.map((b) => b.style)

/**
 * 2D specifications for presets that already existed. They keep their name, description and every other field; only the structured 2D spec is added,
 * so what those presets do for saved projects does not change and new picks of them get the same careful 2D prompts.
 */
export const existing2DSpecs: Record<string, Style2DSpec> = {
  'Watercolor Storybook': build({ id: '2d-watercolor-storybook', name: 'Watercolor Storybook', family: C, summary: 'Hand-painted storybook shapes, soft edges, visible pigment variation and expressive simplified forms.',
    line: 'Little or no outline; soft pencil or pen line used sparingly, in a darker tone of the colour', shape: 'Soft, rounded, simplified storybook shapes', proportions: 'Simplified and gently stylised, with expressive faces',
    palette: 'Transparent, harmonised colour with unpainted paper as the highlight', shading: 'Layered watercolour washes, wet-on-wet blends and a few glazed shadow shapes', texture: 'Paper grain, pigment granulation, blooms and soft dry-brush edges', edges: 'Soft and bleeding, with deliberate white gaps', detail: 'Low to moderate',
    avoid: ['opaque flat vector fills', 'photographic or 3D look', 'hard digital outlines', 'airbrushed gradients'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#203447', '#d9b77b', '#91a9a3', '#efe1bd'], intentionalTexture: true }).spec,
  'Graphic Novel Noir': build({ id: '2d-graphic-novel-noir', name: 'Graphic Novel Noir', family: E, summary: 'Strong silhouette design, graphic shadow shapes, selective colour and expressive ink linework.',
    line: 'Heavy, expressive ink line with dry-brush edges and thick shadow masses', shape: 'Hard angular shadow shapes and strong silhouettes', proportions: 'Grounded, dramatic and lean',
    palette: 'Near-monochrome black, grey and warm paper, with one selective accent colour', shading: 'Solid black shadow masses, hatching and high-contrast light cutting through shapes', texture: 'Ink, paper and halftone grain', edges: 'Crisp ink against soft grey wash', detail: 'Moderate: detail only in the light',
    avoid: ['bright cheerful colour', 'soft gradients', 'photographic or 3D look', 'even flat lighting'], animation: 'Not an animation style; suits comic panels and storyboard frames', colors: ['#101318', '#e1c27a', '#7a3030', '#c8c9c2'], intentionalTexture: true }).spec,
  'Hand-Painted Fantasy Anime': build({ id: '2d-painterly-bg-anime', name: 'Hand-Painted Fantasy Anime', family: B, summary: 'Quiet wonder, organic environments, expressive hand-drawn acting and delicate painted backgrounds.',
    line: 'Soft, fine line in a coloured pencil tone; characters drawn simply', shape: 'Gentle organic shapes, soft faces, flowing hair and clothing', proportions: 'Natural-leaning anime proportions with expressive faces',
    palette: 'Soft, natural, luminous colour; greens and blues in nature, warm light', shading: 'Soft cel shadows on characters; backgrounds painted with gouache and watercolour layering', texture: 'Visible paper and brush texture in the backgrounds, clean characters', edges: 'Crisp on characters, soft painted edges in backgrounds', detail: 'Moderate on characters, high and delicate in painted backgrounds',
    avoid: ['3D render', 'photographic realism', 'harsh black outlines', 'flat vector backgrounds'], animation: 'Hand-drawn animation with painted backgrounds', colors: ['#35545b', '#d9b77e', '#9bbd9a', '#f2e5c7'], intentionalTexture: true,
    background: 'Painted backgrounds in gouache and watercolour that are intentionally softer and more textured than the characters (this relationship between character and background is part of the style)' }).spec,
  'Cel-Shaded Action': build({ id: '2d-high-contrast-action', name: 'Cel-Shaded Action', family: B, summary: 'Crisp graphic planes, decisive silhouettes, dynamic poses, controlled line weight and readable action staging.',
    line: 'Bold, confident line with strong weight variation, thick on shadow side and in motion', shape: 'Sharp, angular, dynamic shapes with strong diagonals', proportions: 'Athletic, stylised, exaggerated foreshortening in action',
    palette: 'High-contrast saturated colour with deep shadows and bright accent colours', shading: 'Hard-edged cel shadows, strong rim lights and graphic spot blacks', texture: 'None or light speed-line texture', edges: 'Razor crisp', detail: 'Moderate',
    avoid: ['soft airbrush shading', 'photographic or 3D render look', 'flat low-contrast lighting', 'timid line'], animation: 'Dynamic cel animation with held impact frames', colors: ['#111827', '#ef6c58', '#3b82a8', '#f2d18b'] }).spec,
  'Graphic Ink and Gouache': build({ id: '2d-ink-gouache', name: 'Graphic Ink and Gouache', family: E, summary: 'Bold editorial shapes, expressive brushwork, a limited palette and strong visual storytelling.',
    line: 'Bold brush-ink line and shapes, dry-brush edges', shape: 'Bold editorial shapes with strong silhouettes', proportions: 'Stylised, graphic and expressive',
    palette: 'Limited opaque gouache palette with black ink and one or two accent colours', shading: 'Flat gouache blocks and solid ink masses; no soft gradients', texture: 'Rough paper, dry brush and collage texture', edges: 'Painted and brushed edges', detail: 'Low to moderate',
    avoid: ['glossy digital gradients', 'photographic or 3D look', 'timid thin line', 'realistic rendering'], animation: 'Not an animation style; suits illustrated sequences', colors: ['#202124', '#d9674e', '#e5c27a', '#6c8790'], intentionalTexture: true }).spec,
}

export const is2D = (style: Pick<StyleBible, 'spec2d'> | undefined | null): boolean => !!style?.spec2d

/** A short, stable text that changes whenever the style's compiled instructions would change. Stored with each picture so a later style change can mark it as made in an earlier style. */
export function styleFingerprint(style: StyleBible): string {
  const text = compile2D(style, 'technical') + '|' + compile2D(style, 'scene') + '|' + [style.name, style.description, style.rendering, style.materials, style.lighting, style.lineTreatment, style.shapeLanguage, style.surfaceTreatment, style.detailLevel, style.animationApproach, style.worldTreatment, style.cameraBehavior].join('|')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${style.name}#${(h >>> 0).toString(36)}`
}

/** What to ask the image model for in a 2D style. Empty for a style that is not 2D. */
export function compile2D(style: StyleBible, context: 'technical' | 'scene' = 'technical'): string {
  const s = style.spec2d
  if (!s) return ''
  // Edits made in Look settings (creative direction, materials, line, shape, detail) override the preset's own text, so editing a 2D style changes the request.
  const line = style.lineTreatment || s.line
  const shape = style.shapeLanguage || s.shape
  const texture = style.surfaceTreatment || style.materials || s.texture
  const detail = style.detailLevel || s.detail
  return [
    `2D art style "${style.name}" (${s.family2d.replace('2D · ', '')}): ${style.description || s.summary}`,
    `Line: ${line}. Shape language: ${shape}. Proportions: ${s.proportions}.`,
    `Palette: ${s.palette}. Shading: ${s.shading}. Texture: ${texture}. Edges: ${s.edges}. Detail level: ${detail}.`,
    `Perspective: ${s.perspective}. Background treatment: ${s.background}.`,
    style.worldTreatment ? `World: ${style.worldTreatment}.` : '',
    context === 'technical' ? s.technical : s.scene,
    'This is one flat 2D picture drawn in this style. It is not a 3D render and not a photograph.',
    `Avoid: ${s.avoid.join('; ')}.`,
  ].filter(Boolean).join(' ')
}

/** Words in the shared view instructions that suit a photographed or 3D subject. In a 2D style they are put in terms of drawing, so they cannot pull the picture toward a render or a photograph. */
const leaks: Array<[RegExp, string]> = [
  [/believable anatomy/gi, 'clear, well-constructed anatomy'],
  [/skin texture visible/gi, 'skin drawn in this style'],
  [/\bmacro close-up\b/gi, 'large close-up'],
  [/orthographic feel/gi, 'flat orthographic drawing'],
  [/\bsoft studio lighting\b/gi, 'flat lighting'],
  [/\bphotograph(ic|ed)?\b/gi, 'drawn'],
]
export function adaptViewFor2D(text: string): string {
  return leaks.reduce((t, [re, to]) => t.replace(re, to), text)
}

export const twoDAnchoredLine = 'The attached picture is the approved design of this exact subject: keep precisely the same face or design, silhouette, body proportions, linework, palette, costume construction, accessories and identifying marks. Change only the pose, angle or expression this view asks for. Draw this view as a fresh 2D drawing in the same style: redraw it, do not mirror or flip another view.'
export const twoDPhotoLine = 'Any attached photographs are IDENTITY references only (who or what it is). Redraw them in the 2D style above: do not copy their photographic rendering, lighting, skin texture, materials or depth of field.'
export const twoDReinterpretLine = 'Reinterpret the attached picture as a new design revision in the 2D style above: keep who or what it is (face or design, silhouette, proportions, costume, accessories, identifying marks) but replace its rendering, lighting, materials and texture with this style. Identity may not carry over exactly; this is a new picture for review.'
