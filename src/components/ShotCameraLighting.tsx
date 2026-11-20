import { useMemo } from 'react'
import { CAMERA_DISCLAIMER, applyCameraPreset, cameraHeights, cameraPresets, fieldOfView, presetById, sensorFor, sensors, type CameraDirection, type DepthOfField, type OpticalCharacter, type SensorId } from '../domain/camera'
import { adviseShot } from '../domain/coverageAdvice'
import { LIGHTING_NOTE, describeLighting, lightingPresetById, lightingPresets, type LightingRecord } from '../domain/lighting'
import { movementLabels, sizeLabels } from '../domain/direct'
import type { ExtractedAsset, ShotRecord } from '../domain/productionStudio'
import { Fold } from './Fold'

interface Props {
  shot: ShotRecord
  sceneShots: ShotRecord[]
  assets: ExtractedAsset[]
  /** A flat 2D style: virtual framing only, so lens-related controls are switched off. */
  flat2D: boolean
  styleName: string
  update: (id: string, patch: Partial<ShotRecord>) => void
  /** Asks for one picture per lighting condition for the focus character. Only called when the person presses the button. */
  onLightingTest?: (shot: ShotRecord) => void
  /** What the whole lighting test is likely to cost (for example "about $0.32"). */
  testCost?: string
}

const neutralLighting = lightingPresets[0].record

/** The extra camera and lighting controls for one shot. They add to the existing size, angle, lens and movement; a shot that uses none of them is unchanged. */
export function ShotCameraLighting({ shot, sceneShots, assets, flat2D, styleName, update, onLightingTest, testCost }: Props) {
  const camera = shot.camera ?? {}
  const lighting = shot.lightingRecord
  const inShot = assets.filter((a) => shot.assetIds.includes(a.id))
  const setCamera = (patch: Partial<CameraDirection>) => update(shot.id, { camera: { ...camera, ...patch } })
  const setLight = (patch: Partial<LightingRecord>) => update(shot.id, { lightingRecord: { ...(lighting ?? neutralLighting), ...patch } })
  const sensor = sensorFor(camera.sensor)
  const fov = fieldOfView(shot.lens ?? 40, sensor)
  const advice = useMemo(() => adviseShot(shot, { sceneShots, styleName, hasSet: inShot.some((a) => a.type === 'set' || a.type === 'environment'), characters: inShot.filter((a) => a.type === 'character').length }), [shot, sceneShots, styleName, inShot])
  const preset = camera.presetId ? presetById(camera.presetId) : undefined
  const applyPreset = (id: string) => { const p = presetById(id); if (!p) return; const { fields, camera: cam } = applyCameraPreset(p); update(shot.id, { ...fields, cameraFraming: sizeLabels[fields.size], cameraMovement: movementLabels[fields.movement], camera: { ...camera, ...cam } }) }

  return (
    <>
      <Fold title="Camera details" hint={camera.presetId ? preset?.label ?? 'custom' : 'optional'} id="camera-details">
        <p className="helper">{CAMERA_DISCLAIMER} Where the camera stands sets the perspective; a different focal length at the same spot only crops more or less of it.</p>
        <label><span>Start from a preset</span>
          <select aria-label="Camera preset" value="" onChange={(e) => e.target.value && applyPreset(e.target.value)}>
            <option value="">Choose…</option>
            {cameraPresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {preset && <small className="helper">{preset.label}: {preset.purpose} Every value stays editable.</small>}
        <div className="dr-two">
          <label><span>Camera height</span><select aria-label="Camera height" value={camera.height ?? ''} onChange={(e) => setCamera({ height: (e.target.value || undefined) as CameraDirection['height'] })}><option value="">Not set</option>{cameraHeights.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
          <label><span>Distance to subject (m)</span><input aria-label="Distance to subject in metres" type="number" min={0.1} max={500} step={0.1} value={camera.distanceM ?? ''} placeholder="optional" onChange={(e) => setCamera({ distanceM: e.target.value === '' ? undefined : Math.max(0.1, Number(e.target.value)) })} /></label>
          <label><span>Sensor or format</span><select aria-label="Sensor or format" value={camera.sensor ?? 'unspecified'} onChange={(e) => setCamera({ sensor: e.target.value as SensorId })} disabled={flat2D}>{sensors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label><span>Focus on</span><select aria-label="Focus target" value={camera.focusTarget ?? ''} onChange={(e) => setCamera({ focusTarget: e.target.value || undefined })}><option value="">Not set</option>{inShot.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}<option value="foreground">Foreground</option><option value="background">Background</option></select></label>
          <label><span>Depth of field</span><select aria-label="Depth of field" value={camera.dof ?? 'unspecified'} onChange={(e) => setCamera({ dof: e.target.value as DepthOfField })} disabled={flat2D}><option value="unspecified">Not set</option><option value="deep">Deep</option><option value="moderate">Moderate</option><option value="shallow">Shallow</option></select></label>
          <label><span>Optical character</span><select aria-label="Optical character" value={camera.optical ?? 'none'} onChange={(e) => setCamera({ optical: e.target.value as OpticalCharacter })} disabled={flat2D}><option value="none">None</option><option value="clean">Clean</option><option value="soft-vintage">Soft, vintage</option><option value="anamorphic-feel">Anamorphic feel</option><option value="wide-distortion-free">Wide, no distortion</option></select></label>
        </div>
        {flat2D
          ? <small className="helper" role="status">This style is flat 2D: it uses virtual framing and depth layers. Lens blur, distortion and sensor choices are not applied.</small>
          : <small className="helper" role="status" data-testid="fov">{shot.lens ?? 40} mm on {sensor.assumed ? 'an assumed Super 35 sensor' : sensor.label}: about {fov.horizontal}° across, {fov.vertical}° high.</small>}
        {advice.length > 0 && (
          <div className="dr-advice" role="group" aria-label="Coverage suggestions">
            <b>Other ways to cover this shot</b>
            <ul>{advice.map((a) => (
              <li key={a.preset.id}><span><b>{a.preset.label}</b> ({a.confidence} confidence): {a.rationale}</span> <button type="button" className="secondary" onClick={() => applyPreset(a.preset.id)}>Try this</button></li>
            ))}</ul>
            <small className="helper">{advice[0].limits}</small>
          </div>
        )}
      </Fold>
      <Fold title="Lighting design" hint={lighting ? (lighting.presetId ? lightingPresetById(lighting.presetId)?.label ?? 'custom' : 'custom') : 'from the scene'} id="lighting-design">
        <p className="helper">{LIGHTING_NOTE} Lighting is separate from the colour grade, which is applied later over a finished picture.</p>
        <label><span>Start from a lighting preset</span>
          <select aria-label="Lighting preset" value="" onChange={(e) => { const p = lightingPresetById(e.target.value); if (p) update(shot.id, { lightingRecord: { ...p.record } }) }}>
            <option value="">Choose…</option>
            {lightingPresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {lighting ? (
          <>
            <div className="dr-two">
              <label><span>Key light direction ({lighting.keyAzimuth}°)</span><input aria-label="Key light direction" type="range" min={-180} max={180} step={5} value={lighting.keyAzimuth} onChange={(e) => setLight({ keyAzimuth: Number(e.target.value) })} /></label>
              <label><span>Key light height ({lighting.keyElevation}°)</span><input aria-label="Key light height" type="range" min={0} max={90} step={5} value={lighting.keyElevation} onChange={(e) => setLight({ keyElevation: Number(e.target.value) })} /></label>
              <label><span>Source size</span><select aria-label="Source size" value={lighting.sourceSize} onChange={(e) => setLight({ sourceSize: e.target.value as LightingRecord['sourceSize'] })}><option value="small">Small, hard</option><option value="medium">Medium</option><option value="large">Large, soft</option></select></label>
              <label><span>Contrast</span><select aria-label="Contrast" value={lighting.contrast} onChange={(e) => setLight({ contrast: e.target.value as LightingRecord['contrast'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label><span>Ambient</span><select aria-label="Ambient light" value={lighting.ambient} onChange={(e) => setLight({ ambient: e.target.value as LightingRecord['ambient'] })}><option value="dark">Dark</option><option value="dim">Dim</option><option value="normal">Normal</option><option value="bright">Bright</option></select></label>
              <label><span>Colour temperature ({lighting.colorTempK} K)</span><input aria-label="Colour temperature" type="range" min={2000} max={9000} step={100} value={lighting.colorTempK} onChange={(e) => setLight({ colorTempK: Number(e.target.value) })} /></label>
              <label><span>Exposure intention</span><select aria-label="Exposure intention" value={lighting.exposure} onChange={(e) => setLight({ exposure: e.target.value as LightingRecord['exposure'] })}><option value="under">Low-key (darker)</option><option value="normal">Normal</option><option value="over">High-key (brighter)</option></select></label>
              <label className="dr-check"><input type="checkbox" aria-label="Rim or back light" checked={lighting.rim} onChange={(e) => setLight({ rim: e.target.checked })} /> Rim or back light</label>
            </div>
            <label><span>Practical lights (lamps, windows)</span><input aria-label="Practical lights" value={lighting.practicals} onChange={(e) => setLight({ practicals: e.target.value })} /></label>
            <small className="helper" data-testid="lighting-words">{describeLighting(lighting)}</small>
            <div className="dr-tools">
              {onLightingTest && <button type="button" className="secondary" onClick={() => onLightingTest(shot)}>Make a lighting test of the focus character ({lightingPresets.length} pictures{testCost ? `, ${testCost}` : ''})</button>}
              <button type="button" className="secondary" onClick={() => update(shot.id, { lightingRecord: undefined })}>Clear lighting design</button>
            </div>
          </>
        ) : <small className="helper">Not set: this shot uses the lighting written for the scene.</small>}
      </Fold>
    </>
  )
}
