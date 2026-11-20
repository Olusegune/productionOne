/**
 * The in-app documentation. Plain data, so a test can check that every picture exists and every chapter says what it should. Written for someone opening the app
 * for the first time; every step names a button or screen that is really there.
 */
export type Workspace = 'Projects' | 'Story' | 'Design' | 'Review' | 'Direct' | 'Deliver' | 'Assistant'

export interface HelpImage { file: string; caption: string }
export interface HelpBlock {
  /** A short heading for this part of the chapter. */
  title: string
  /** Paragraphs. */
  text: string[]
  /** Numbered steps, each naming something on screen. */
  steps?: string[]
  /** A picture from the running app. */
  image?: HelpImage
  /** A boxed hint or warning. */
  note?: { kind: 'tip' | 'cost' | 'careful'; text: string }
}
export interface HelpChapter {
  id: string
  title: string
  /** One line shown in the contents. */
  summary: string
  /** The screen this chapter is about, so the Help Center can offer to open it. */
  workspace?: Workspace
  blocks: HelpBlock[]
}

export const helpChapters: HelpChapter[] = [
  {
    id: 'welcome',
    title: 'Welcome: what Production One is',
    summary: 'The idea, the six steps, and what it does not do',
    workspace: 'Projects',
    blocks: [
      {
        title: 'What it does',
        text: [
          'Production One is your AI production department for the work that comes before shooting or animating: it prepares the **characters, props, sets, environments, reference sheets and storyboards** that other tools (video generators, animation software, a human crew) then build on.',
          'It does **not** assemble or render a finished film. Its job is to make sure everything that goes into one is designed, consistent and approved.',
        ],
        image: { file: 'help/01-projects.webp', caption: 'The Projects screen: your project, its progress and the Golden Path.' },
      },
      {
        title: 'The Golden Path',
        text: [
          'Every project follows one path: **Create, Analyze, Design, Generate, Review, Deliver**. A seventh step, **Direct** (storyboards and an animatic), appears only if you turn it on.',
          'The big highlighted button on the Projects screen and in the left sidebar always names the **next step**. If you are ever lost, press it. Optional extras (Shape, Camera and light, Visual review, Looks) show under the path once you start using them; they never block you and never change your progress.',
        ],
        note: { kind: 'tip', text: 'Nothing is made until you press a Generate button, and you approve every picture yourself. The app never approves anything for you.' },
      },
      {
        title: 'Where things are',
        text: [
          'The left sidebar has seven screens: **Projects** (overview and files), **Story** (your script), **Design** (characters, sets, props, style), **Review** (approve pictures), **Direct** (optional storyboards), **Deliver** (audit and export) and **Assistant** (a chat that can do much of this for you).',
          'The bottom bar shows the picture queue and how many requests have been made. The icons in the top bar open the command list (Ctrl+K) and Providers and keys; the small icons at the bottom of the sidebar open Appearance and more.',
        ],
      },
    ],
  },
  {
    id: 'setup',
    title: 'Before you start: keys, costs and local AI',
    summary: 'Connect an image provider, set a spending limit, or use your own computer',
    blocks: [
      {
        title: 'Connecting an image provider',
        text: [
          'Pictures are made by an image model. Production One works with several providers (Kie.ai, Google Gemini, OpenAI, fal.ai, OpenRouter) and with models on your own computer (ComfyUI). You need **one** to generate pictures.',
          'Open **Tools, Provider Settings** (or the wand icon, "Providers and keys", in the top bar), choose a provider, paste your key and press Save. Keys are stored only in the **Windows Credential Manager** (the macOS Keychain on a Mac). They are never written into a project file, an export or a log.',
        ],
        steps: ['Open Tools, Provider Settings (or the wand icon in the top bar).', 'Pick the provider you have an account with.', 'Paste the key and press Save. The status changes to "key saved".', 'In Design, open the model picker and choose a model. Models without a key show "no key".'],
        image: { file: 'help/02-providers.webp', caption: 'The Providers dialog. A saved key is shown as saved, never as text.' },
        note: { kind: 'cost', text: 'Generating pictures costs money on your provider account. Production One shows an estimate from the price you enter and stops at the ceiling you set. It cannot know your real bill.' },
      },
      {
        title: 'Spending limits',
        text: ['Before a batch runs you set a **price per picture** and a **budget**. The queue will not start past the ceiling. In the Assistant, a run cannot start without both numbers.'],
      },
      {
        title: 'Using your own computer (Local AI)',
        text: ['If you run ComfyUI, Ollama or LM Studio, Production One finds them (the **Local AI** button in the top bar). Local models cost nothing per picture. Ollama or LM Studio can also read scenes, write scripts and, with a vision model, check pictures. Nothing is sent online when you use them.'],
      },
    ],
  },
  {
    id: 'start',
    title: 'Start a project: a script, pictures, or both',
    summary: 'Bring your own script, characters and images',
    workspace: 'Story',
    blocks: [
      {
        title: 'Bring a script',
        text: [
          'Go to **Story**. Paste a script, or press **Import** and choose a Word (.docx), PDF, text, Fountain or Final Draft file. Press **Analyze script**.',
          'Production One reads the script and lists the **characters, props, costumes, sets and environments** it found, with the lines they come from. Check the list: you can rename, merge or add anything it missed. Details you confirm (age, role, what must never change) are carried into every picture prompt.',
        ],
        steps: ['Open Story.', 'Paste your script or press Import.', 'Press Analyze script.', 'Read the found items; add or fix any that are wrong.'],
        image: { file: 'help/03-story.webp', caption: 'Story: your script on the left, what Production One found on the right.' },
      },
      {
        title: 'Bring your own images and characters',
        text: [
          'You do not need a script to start. In **Design**, press **Add to the bible** to add a character, prop, costume or set by name, with a description. **Add and make a first concept** makes one first picture from your description (one image request). **Use my image** attaches a picture you already have.',
          'You can also add many pictures at once: each becomes an item named from its file, with your picture as its approved reference. If a picture\'s file name matches someone already in the project (for example `marcus.png` for MARCUS from your script), it is attached to that person instead of making a duplicate. An item that already has an approved picture is never overwritten.',
        ],
        note: { kind: 'tip', text: 'Name image files after the character, prop or place (marcus.png, old_harbour.jpg). Production One uses the file name to match them to your script.' },
      },
    ],
  },
  {
    id: 'style',
    title: 'Choose and lock the look of the film',
    summary: 'Pick a visual style from 150 examples',
    workspace: 'Design',
    blocks: [
      {
        title: 'The style gallery',
        text: [
          'Open **Design** and press **Approve a visual style**. The gallery shows 150 styles, each with a real example picture (the same lighthouse keeper in every one, so you can compare). Search by name or family, open a card to read what it does, and press **Use this style**.',
          'Press **Lock style** when you are happy. A locked style is applied to every picture, so the film looks like one film. Changing it later marks earlier pictures as "made in an earlier style"; nothing is replaced for you.',
        ],
        image: { file: 'help/04-style-gallery.webp', caption: 'The style gallery. The picture is an example of the look, not a promise for every model.' },
        note: { kind: 'tip', text: 'A single character or set can have its own style (Override for this asset). Flat 2D styles use drawn layouts rather than lens effects.' },
      },
    ],
  },
  {
    id: 'design',
    title: 'Design: characters, props and sets',
    summary: 'Make and approve reference sheets',
    workspace: 'Design',
    blocks: [
      {
        title: 'The production bible',
        text: ['The left list is your **production bible**: characters, costumes, props and sets. Select one to work on it. Each has tabs: **Sheets** (pictures), **Identity** (who it is), **Motion**, and **Voice and sound**.'],
        image: { file: 'help/05-design.webp', caption: 'Design: the bible on the left, the selected character on the right.' },
      },
      {
        title: 'Identity',
        text: ['Fill in what must stay true: age, role, a description, and a **Never** line (for example "never a teeth-showing smile"). These facts go into every picture of that character so they stay the same person.'],
      },
      {
        title: 'Sheets and views',
        text: ['A **sheet** is a set of views: Identity, Turnaround, Expressions, Poses, Wardrobe and Detail for a character; Multi-view for a prop; Establishing and Layout for a place. **Generate and approve the front view first**: every other view then uses it as the reference so the character stays the same person.'],
        steps: ['Open the Sheets tab and pick a sheet type.', 'Choose a shape (aspect ratio) and the image model.', 'Press **Test one first** to make one picture and check it.', 'Press **Generate** for the rest, or tick views and **Regenerate**.', 'Open each picture, then **Approve**, **Reject** or ask for changes.'],
        image: { file: 'help/06-sheets.webp', caption: 'A sheet: views, the model picker and the Generate buttons.' },
        note: { kind: 'careful', text: 'Approving is your decision. An approved picture is never replaced; a new attempt is always a new revision beside it.' },
      },
    ],
  },
  {
    id: 'shape',
    title: 'Shape and proportions',
    summary: 'Tall, compact, long-limbed, large-eyed: set the body on purpose',
    workspace: 'Design',
    blocks: [
      {
        title: 'Target proportions',
        text: [
          'In a character\'s **Identity** tab, press **Set target proportions**. Pick a starting point (Natural, Elongated, Compact, Large-headed, Long-limbed, Angular, Rounded) and adjust: **Stylization** moves a group of controls together; any control you move yourself stays yours. Reset one control, reset the profile, undo and redo.',
          'The **schematic** is a diagram drawn from your numbers. It is not a picture of the character. **Generate preview** asks an image model for one candidate; moving a slider never contacts a model.',
        ],
        image: { file: 'help/07-proportions.webp', caption: 'Target proportions with the schematic preview.' },
        note: { kind: 'tip', text: 'A large eye or a long arm is a valid design. Press "This is intentional" on a warning so it is never treated as a problem.' },
      },
      {
        title: 'Fit rules and scale',
        text: ['From the proportions and the character\'s height, Production One **proposes** sizes for chairs, desks, doorways, reach and handles. You approve, reject or mark them intentionally cramped or oversized. The **Scale and Fit** reference puts a lineup, doorway, chair, desk, step and prop to one scale. Sizes are labelled illustrative.'],
      },
    ],
  },
  {
    id: 'direct',
    title: 'Direct: storyboards, camera and light',
    summary: 'Plan shots, set camera and lighting, block the scene, make frames',
    workspace: 'Direct',
    blocks: [
      {
        title: 'Turn it on and plan the shots',
        text: ['Direct is optional. Open **Direct** and press **Turn on the Director\'s room**. Press **Plan the coverage for this scene** (or **Plan all**) and Production One proposes a shot list from your script: an establishing shot, a master, over-the-shoulder pairs for dialogue that respect the 180-degree rule, close-ups where feeling peaks, and inserts for important props. It is a starting point to edit.'],
        image: { file: 'help/08-direct.webp', caption: 'The Director\'s room: shots in the middle, the shot editor on the right.' },
      },
      {
        title: 'Edit a shot: camera and lighting',
        text: [
          'Select a shot to edit its size, angle, lens, movement, composition, cast and wardrobe. **Camera details** adds height, distance, sensor, focus, depth of field and optical character, with eight presets (intimate dialogue, environmental portrait, restrained close-up and more) and a field-of-view readout. **Lighting design** sets the key light direction and height, source size, contrast, rim, practicals and colour temperature.',
          'These controls **guide** the picture an image model draws. They do not simulate a physical camera, and a different lighting is a new candidate, not a relit copy.',
        ],
        image: { file: 'help/09-camera.webp', caption: 'Camera details with the field-of-view readout and coverage suggestions.' },
      },
      {
        title: 'Blocking map',
        text: ['Open **Blocking map** in the shot editor for a top-down view of the scene in metres. Add people and props, seat a character on a chair, say who a chair belongs to, and place the camera for this shot. Moving the camera never moves anyone; moving someone between shots is recorded with a reason.'],
        image: { file: 'help/10-blocking.webp', caption: 'The blocking map: people, chairs and a camera with its field of view.' },
      },
      {
        title: 'Make frames and play the animatic',
        text: ['Pick the project **shape** first (16:9, 9:16 for TikTok, 4:5 and more): it sets your frames and video. Press **Generate frame** on a shot, or generate all. Frames use your approved characters and sets as references. The **animatic** plays your frames in order with timing.'],
      },
    ],
  },
  {
    id: 'review',
    title: 'Review and approve',
    summary: 'Look at each picture beside its reference, then decide',
    workspace: 'Review',
    blocks: [
      {
        title: 'One picture at a time',
        text: ['**Review** shows a new picture large, next to the approved reference it has to match. Technical checks (size, blank or cropped images) appear apart from your creative decision. Press **Approve**, **Reject** (the file is kept) or **Request changes** (opens the sheet to adjust the notes). Rejected pictures stay under "Turned down" and can be approved later.'],
        image: { file: 'help/11-review.webp', caption: 'Review: the picture, its reference, and the decision buttons.' },
      },
      {
        title: 'Visual review',
        text: ['At the bottom of Review, **Run checks** compares each picture with your own records (proportions, style, layout, fit) for free. **Check with a vision model** is a separate option that uses a model on your computer. A picture shows **Not checked** until a check has run (that is not a pass), then Passed, Needs review or Unable to assess. Each finding offers View evidence, Accept, Dismiss, Mark intentional, or **Regenerate this view with a fix** (a new revision of that view only; it waits for your approval and stops after 3 attempts or $1.00).'],
      },
    ],
  },
  {
    id: 'looks',
    title: 'Looks: colour grading',
    summary: 'Give scenes a look without changing the original pictures',
    workspace: 'Direct',
    blocks: [
      {
        title: 'Non-destructive grades',
        text: ['Under the animatic, **Looks and grade** lets you add a look (exposure, temperature, tint, contrast, saturation, tints) and apply it to the whole project, a scene or a single shot. The picture file is **never changed**: a look is a recipe applied on top. Compare with **Show the original**, change the strength, or reset. The colour script lists every scene with its look. LUTs are not available yet.'],
        image: { file: 'help/12-looks.webp', caption: 'Looks and grade with the colour script.' },
      },
    ],
  },
  {
    id: 'assistant',
    title: 'The Assistant: hand it your script, characters and images',
    summary: 'Attach what you have; it plans, you approve, it makes the storyboard',
    workspace: 'Assistant',
    blocks: [
      {
        title: 'What you can give it',
        text: [
          'Open **Assistant** and press the paperclip. You can attach a **script** (Word, PDF, text, Fountain, Final Draft), and **pictures** of your own characters, props, places or costumes. Or type your story as one line per beat, or a short idea (a language model then writes the script, using the items you already have) (this needs a language model: Gemini, OpenAI, OpenRouter, Ollama or LM Studio, chosen under "Writing model").',
          'When you attach pictures it asks what they are (characters, props, places or costumes) and makes an item for each with **your picture as the approved reference**. A picture named after a character in your script (marcus.png) is attached to that character.',
        ],
        image: { file: 'help/13-assistant.webp', caption: 'The Assistant: chat on the left, the plan and budget on the right.' },
      },
      {
        title: 'Plan, budget, go',
        text: ['The right-hand **Plan** shows how many items and pictures there will be and the estimated cost. Choose **Quick** (one sheet each) or **Standard** (turnaround, expressions, poses, costume, prop and place sheets), tick **storyboard frames** to have it plan the shots from your script and make a frame for each in your project shape, enter your **price per picture** and **budget**, then press **Start**. Nothing is made before you press Start, and it will not start without a price and a budget.'],
        steps: ['Attach your script and pictures, or type your story one line per beat.', 'Tell it what the pictures are.', 'Check the plan on the right.', 'Tick storyboard frames if you want the storyboard.', 'Enter a price per picture and a budget, then press Start.', 'It makes a first concept for every item and stops so you can approve, replace or reject each (the default).', 'Press Continue: it makes the sheets from your approved concepts, then the storyboard frames.'],
        note: { kind: 'tip', text: 'A storyboard is planned from scenes, so it needs a story. If you only have pictures, type your story as one line per beat (for example: Marcus finds the lantern on the Old Harbour pier at dusk). The Assistant turns your own words into scenes using your characters, places and props, with no language model and nothing sent anywhere, then plans the shots.' },
      },
      {
        title: 'Connected agents',
        text: ['Advanced: other programs on your computer (for example Claude Desktop) can read your project and ask for a plan through a local connection that is **off by default**. They cannot start a run unless you also switch that on, with a spending limit.'],
      },
    ],
  },
  {
    id: 'deliver',
    title: 'Deliver: audit and export',
    summary: 'Check everything is approved, then export a package',
    workspace: 'Deliver',
    blocks: [
      {
        title: 'The audit',
        text: ['**Deliver** checks that every asset is approved with a real file. A **verified** package needs every approved picture to be on this computer; a **draft** package can include gaps and says so. The package holds your style bible, an asset ledger, manifests, the approved references and `design_records.json` (proportions, camera and lighting direction, looks, findings and approvals).'],
        image: { file: 'help/14-deliver.webp', caption: 'Deliver: the audit and the export button.' },
        note: { kind: 'careful', text: 'A package that would include a key, a credentials file or a local model file is refused with the reason. Keys never go into a package.' },
      },
      {
        title: 'Saving and backups',
        text: ['Projects are saved as **.pone** files (File, Save As). Legacy Production Guy **.pguy** files open and are never changed. **Autosave** keeps a working copy after every change; saving to a file is separate.'],
      },
    ],
  },
  {
    id: 'windows',
    title: 'Windows tips: desktop shortcut, taskbar, shortcuts',
    summary: 'Pin it, open it faster, and the keyboard shortcuts',
    blocks: [
      {
        title: 'Put Production One on the desktop or taskbar',
        text: ['The installer adds a desktop shortcut and a Start menu entry. If you use the portable program, open **Help, Add Production One to the Desktop** to make a desktop shortcut. To pin it to the taskbar, start the app, right-click its icon in the taskbar and choose **Pin to taskbar**, or right-click the desktop shortcut and choose **Show more options, Pin to taskbar**.'],
      },
      {
        title: 'Keyboard',
        text: ['Ctrl+K opens the command list: type what you want ("go to Review", "export") and press Enter. F1 opens this guide; **Help, Keyboard Shortcuts** lists them all. Ctrl+S saves, Ctrl+Shift+S saves as, Ctrl+O opens, Ctrl+N starts a new project, Ctrl+B hides the sidebar, F11 is fullscreen.'],
      },
    ],
  },
  {
    id: 'trouble',
    title: 'When something goes wrong',
    summary: 'Common messages and what to do',
    blocks: [
      {
        title: 'Pictures fail or never start',
        text: ['A picture that fails says why (a rejected key, no credits, a model that cannot take references). **402** means the provider account has no credit for that model; check Provider Settings and try another model. **401 or 403** means the key was rejected: paste it again. Failed pictures never block other work, and **Retry** makes a new attempt.'],
      },
      {
        title: 'A project will not open or looks wrong',
        text: ['Only .pone and legacy .pguy files open; the message says what is wrong with the file. After a crash, reopen the app: the last autosaved state comes back, and your saved .pone files are untouched. **View, Reset Layout** restores zoom and the sidebar.'],
      },
      {
        title: 'What is and is not checked',
        text: ['Many controls guide a picture rather than control it: image models may not follow proportion, camera or lighting wording exactly. Review every picture yourself; the checks are aids, not a verdict.'],
      },
    ],
  },
  {
    id: 'glossary',
    title: 'Glossary',
    summary: 'Words used in the app',
    blocks: [
      {
        title: 'Terms',
        text: [
          '**Asset**: a character, costume, prop, set or environment in your production bible.',
          '**Sheet**: a set of views of one asset (for example a character turnaround).',
          '**Reference / anchor**: an approved picture that later pictures are built from, so the subject stays the same.',
          '**Revision**: every new attempt at a view. Earlier attempts and approvals are never overwritten.',
          '**Style bible**: the locked look (palette, materials, rendering) applied to every picture.',
          '**Golden Path**: the guided order of work and the next-step button.',
          '**Candidate**: a generated picture you have not approved yet.',
          '**Provenance**: the record of which proportions and references a picture was made with.',
        ],
      },
    ],
  },
]

export const helpImages: string[] = [...new Set(helpChapters.flatMap((c) => c.blocks.flatMap((b) => (b.image ? [b.image.file] : []))))]

/** Chapters whose title, summary or text contain every word of the query (case-insensitive). An empty query lists all. */
export function searchHelp(query: string): HelpChapter[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return helpChapters
  return helpChapters.filter((c) => {
    const hay = [c.title, c.summary, ...c.blocks.flatMap((b) => [b.title, ...b.text, ...(b.steps ?? []), b.note?.text ?? ''])].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
