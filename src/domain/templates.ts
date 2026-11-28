import type { AbilitySpec, BodyPlan, CreatureSpec, MachinePart, MachineSpec, VehicleSpec } from './variations'

/**
 * Starting points for beings, machines and powers. A template only fills in a form; nothing is saved or generated until the person presses the button,
 * and every field can be changed. "Custom" is always first and fills in nothing. Hero and villain are not templates: they are a story role that can be set
 * on any being (see creatureLab.ts).
 */
export interface Template<S> { id: string; label: string; blurb: string; fill: S }

export type CreatureFill = Pick<CreatureSpec, 'bodyPlan' | 'limbs' | 'symmetry' | 'intentional' | 'never'> & { eyes?: number; plan?: string }
export const CUSTOM = 'custom'

export const CREATURE_TEMPLATES: Array<Template<CreatureFill>> = [
  { id: CUSTOM, label: 'Custom', blurb: 'Start empty and say everything yourself.', fill: { bodyPlan: 'humanoid', limbs: [], symmetry: 'symmetric', intentional: [], never: [] } },
  { id: 'human', label: 'Human', blurb: 'Two arms with five fingers, two legs, two eyes.', fill: { bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2, digits: 5 }, { name: 'leg', count: 2 }], eyes: 2, symmetry: 'symmetric', intentional: [], never: [] } },
  { id: 'monster', label: 'Monster or beast', blurb: 'Four legs, a tail, claws; no hands.', fill: { bodyPlan: 'quadruped', limbs: [{ name: 'leg', count: 4, digits: 4 }, { name: 'tail', count: 1 }], eyes: 2, symmetry: 'symmetric', intentional: ['claws'], never: ['human hands'], plan: 'low, heavy, built to charge' } },
  { id: 'alien', label: 'Alien or other species', blurb: 'Upright, unusual on purpose: a third eye and long fingers.', fill: { bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2, digits: 4 }, { name: 'leg', count: 2 }], eyes: 3, symmetry: 'symmetric', intentional: ['a third eye', 'four long fingers on each hand'], never: ['human ears'] } },
  { id: 'serpent', label: 'Serpent', blurb: 'A long body with no legs.', fill: { bodyPlan: 'serpentine', limbs: [{ name: 'tail', count: 1 }], eyes: 2, symmetry: 'symmetric', intentional: [], never: ['legs', 'arms'] } },
  { id: 'avian', label: 'Winged being', blurb: 'Two wings, two legs, a beak.', fill: { bodyPlan: 'avian', limbs: [{ name: 'wing', count: 2 }, { name: 'leg', count: 2, digits: 3 }], eyes: 2, symmetry: 'symmetric', intentional: ['a beak'], never: [] } },
  { id: 'insect', label: 'Insect-like', blurb: 'Six legs and a segmented body.', fill: { bodyPlan: 'insectoid', limbs: [{ name: 'leg', count: 6 }], eyes: 2, symmetry: 'symmetric', intentional: ['a segmented body'], never: [] } },
]

const part = (name: string, count: number, views: MachinePart['views'], where?: string): MachinePart => ({ name, count, views, ...(where ? { where } : {}) })
export type MachineFill = Pick<MachineSpec, 'kind' | 'joints' | 'sensors' | 'panels' | 'intentional' | 'never'> & { powerSource?: string }

export const MACHINE_TEMPLATES: Array<Template<MachineFill>> = [
  { id: CUSTOM, label: 'Custom', blurb: 'Start empty and list the parts yourself.', fill: { kind: 'robot', joints: [], sensors: [], panels: [], intentional: [], never: [] } },
  { id: 'robot', label: 'Service robot', blurb: 'Biped with elbows, knees, two eye lenses and a chest hatch.', fill: { kind: 'robot', joints: [part('elbow', 2, ['front', 'side'], 'arms'), part('knee', 2, ['front', 'side'])], sensors: [part('eye lens', 2, ['front'], 'head')], panels: [part('chest hatch', 1, ['front'])], powerSource: 'a sealed core in the chest', intentional: [], never: [] } },
  { id: 'android', label: 'Android', blurb: 'Human-shaped, with a visible seam at the neck.', fill: { kind: 'android', joints: [part('elbow', 2, ['front', 'side']), part('knee', 2, ['front', 'side'])], sensors: [part('eye', 2, ['front'], 'head')], panels: [part('neck seam', 1, ['front', 'back'])], intentional: ['a visible seam at the neck'], never: ['a mouth that moves like skin'] } },
  { id: 'mech', label: 'Mech', blurb: 'Piloted walker: cockpit hatch, hip and knee joints, rear vents.', fill: { kind: 'mech', joints: [part('hip', 2, ['front', 'side']), part('knee', 2, ['front', 'side']), part('shoulder', 2, ['front', 'back'])], sensors: [part('main camera', 1, ['front'], 'head')], panels: [part('cockpit hatch', 1, ['top', 'side']), part('rear vent', 2, ['back'])], powerSource: 'a reactor behind the cockpit', intentional: [], never: [] } },
  { id: 'armor', label: 'Powered armour', blurb: 'Worn suit: shoulder, elbow and knee joints, a visor, a back pack.', fill: { kind: 'powered-armor', joints: [part('shoulder', 2, ['front', 'back']), part('elbow', 2, ['front', 'side']), part('knee', 2, ['front', 'side'])], sensors: [part('visor', 1, ['front'], 'head')], panels: [part('back pack', 1, ['back', 'side'])], powerSource: 'a battery pack on the back', intentional: [], never: [] } },
]

export type AbilityFill = Pick<AbilitySpec, 'language' | 'states' | 'transparency'> & { name: string }

export const ABILITY_TEMPLATES: Array<Template<AbilityFill>> = [
  { id: CUSTOM, label: 'Custom', blurb: 'Describe the power yourself.', fill: { name: '', language: { colour: '', shape: '' }, states: {}, transparency: 'none' } },
  { id: 'fire', label: 'Fire', blurb: 'Orange flame that grows from the hands.', fill: { name: 'Flame', language: { colour: 'orange and gold', shape: 'licking tongues of flame', motion: 'rising' }, states: { inactive: 'no visible effect', activation: 'a flicker in the palms', controlled: 'a steady flame held in one hand', peak: 'flame wraps the whole body and lights the room', recovery: 'embers fade from the hands', aftermath: 'scorch marks and a trace of smoke' }, transparency: 'translucent' } },
  { id: 'lightning', label: 'Lightning', blurb: 'Blue-white arcs along the skin.', fill: { name: 'Storm', language: { colour: 'blue-white', shape: 'forking arcs of light', motion: 'jumping between points' }, states: { inactive: 'no visible effect', activation: 'hair lifts and small sparks crawl on the fingers', controlled: 'arcs held between the hands', peak: 'lightning leaps from the whole body', recovery: 'sparks die away', aftermath: 'singed air and faint static' }, transparency: 'translucent' } },
  { id: 'shadow', label: 'Shadow', blurb: 'Dark smoke that pools and reaches.', fill: { name: 'Shade', language: { colour: 'ink black with violet edges', shape: 'curling ribbons of smoke', motion: 'creeping along surfaces' }, states: { inactive: 'no visible effect', activation: 'the shadow under the feet deepens', controlled: 'ribbons of smoke answer the hand', peak: 'smoke fills the space and swallows the light', recovery: 'smoke thins and drains back', aftermath: 'a lingering chill and faint dark stains' }, transparency: 'none' } },
]

export const BODY_PLAN_OF = (id: string): BodyPlan | undefined => CREATURE_TEMPLATES.find((t) => t.id === id)?.fill.bodyPlan
export const templateById = <S,>(list: Array<Template<S>>, id: string): Template<S> | undefined => list.find((t) => t.id === id)

export type VehicleFill = Pick<VehicleSpec, 'kind' | 'seats' | 'entrances' | 'features' | 'intentional' | 'never'> & { lengthM?: number; widthM?: number; heightM?: number; interiorHeightM?: number; powerSource?: string }

export const VEHICLE_TEMPLATES: Array<Template<VehicleFill>> = [
  { id: CUSTOM, label: 'Custom', blurb: 'Start empty and say everything yourself.', fill: { kind: 'car', seats: 4, entrances: [], features: [], intentional: [], never: [] } },
  { id: 'car', label: 'Car', blurb: 'Four seats, four doors, four wheels.', fill: { kind: 'car', seats: 4, lengthM: 4.5, widthM: 1.8, heightM: 1.45, interiorHeightM: 1.2, entrances: [part('door', 4, ['side'])], features: [part('wheel', 4, ['side']), part('headlight', 2, ['front']), part('taillight', 2, ['back'])], intentional: [], never: [] } },
  { id: 'truck', label: 'Truck', blurb: 'A cab with two seats and a load area.', fill: { kind: 'truck', seats: 2, lengthM: 7, widthM: 2.5, heightM: 3.2, interiorHeightM: 1.4, entrances: [part('cab door', 2, ['side'])], features: [part('wheel', 6, ['side']), part('load bed', 1, ['side', 'top'])], intentional: [], never: [] } },
  { id: 'motorbike', label: 'Motorbike', blurb: 'Two wheels, one or two riders.', fill: { kind: 'motorbike', seats: 2, lengthM: 2.1, widthM: 0.8, heightM: 1.1, entrances: [], features: [part('wheel', 2, ['side']), part('handlebar', 1, ['front', 'top']), part('headlight', 1, ['front'])], intentional: [], never: ['a roof'] } },
  { id: 'aircraft', label: 'Aircraft', blurb: 'Wings, a tail, a cockpit canopy.', fill: { kind: 'aircraft', seats: 2, lengthM: 11, widthM: 10, heightM: 3.4, interiorHeightM: 1.1, entrances: [part('canopy', 1, ['side', 'top'])], features: [part('wing', 2, ['front', 'top']), part('tail fin', 1, ['back', 'side']), part('landing gear', 3, ['front', 'side'])], intentional: [], never: [] } },
  { id: 'spacecraft', label: 'Spacecraft', blurb: 'A crewed ship with a hatch and engines.', fill: { kind: 'spacecraft', seats: 6, lengthM: 30, widthM: 12, heightM: 8, interiorHeightM: 2.4, entrances: [part('main hatch', 1, ['side', 'top'])], features: [part('engine', 3, ['back']), part('cockpit window', 1, ['front'])], powerSource: 'a reactor amidships', intentional: [], never: [] } },
  { id: 'boat', label: 'Boat', blurb: 'A hull, a deck and a mast or motor.', fill: { kind: 'boat', seats: 6, lengthM: 8, widthM: 2.8, heightM: 3, entrances: [part('deck hatch', 1, ['top'])], features: [part('mast', 1, ['side', 'front']), part('rudder', 1, ['back'])], intentional: [], never: [] } },
]
