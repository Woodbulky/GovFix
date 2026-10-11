# Navnagar 3D city

The memorable element of GovFix. A realistic, explorable model of the fictional city where every open complaint is a place you can fly to, walk past and see. Built with three.js through `@react-three/fiber` + `@react-three/drei`, generated procedurally from one layout file, so it runs offline and needs no map service.

## One source of truth

`apps/web/src/features/city/layout/navnagar.json` (hand-authored in Phase 1) contains:
- `bounds`: 2400 × 2400 m, origin at the centre, +x east, +z south, y up. 1 unit = 1 metre.
- `river`: polyline with width (40–70 m) and two bridges (Juna Pool, Navin Pool).
- `railway`: polyline running north–south around x = +700, with the station.
- `roads`: polylines with `type` (arterial 24 m, main 14 m, lane 7 m) and names.
- `wards`: 10 polygons with ids, names in en/hi/mr, and a zone type.
- `landmarks`: points with en/hi/mr names and aliases.
- `parks`, `lake`, `hills`, `special` (clock tower, temple, market hall, water tank, municipal HQ, college, IT park, water treatment plant).
- `seed`: a PRNG seed string ("navnagar"); same seed, same city.

`npm run gen:city` turns the wards and landmarks into `supabase/seed/02_city.sql`, so `locate_point()` and `resolve_landmark()` in the database match the 3D world exactly.

## Wards

| # | Name (en / mr) | Character | Where |
|---|---|---|---|
| 1 | Juna Bazaar / जुना बाजार | Dense old city: 2–4 floor wadas, tiled roofs, narrow lanes, vegetable market, Ganpati temple | West-centre |
| 2 | Nadi Kinara / नदी किनारा | Riverfront ghats, promenade, both bridges, low houses | Along the river, centre-south |
| 3 | Station Road / स्टेशन रोड | Railway station, ST bus stand, shops and lodges, busier arterial road | East-centre |
| 4 | Vidya Nagar / विद्यानगर | College campus, hostels, library, tree-lined roads | North |
| 5 | Lakeview / लेकव्ह्यू | Gated housing societies with 7–14 floor towers, lake garden | North-east |
| 6 | Udyog Nagar / उद्योग नगर | Industrial sheds, warehouses, water treatment plant, wide roads | South-east, by the railway |
| 7 | Ghantaghar / घंटाघर | City centre: clock tower square, municipal head office, banks, market hall | Centre (clock tower near 0, -100) |
| 8 | Tekdi Paytha / टेकडी पायथा | Hill foothills, winding lanes, the hilltop water tank, forest edge | North-west |
| 9 | Hari Nagar / हरी नगर | Middle-class row houses and 4-floor apartments, school, playground | South-west |
| 10 | Navi Vasahat / नवी वसाहत | New extension: wide new roads, IT park, plots under construction | South |

Seed 4–6 landmarks per ward, for example: Ghantaghar Chowk, Bhaji Mandai, Ganpati Mandir, Nadi Ghat, Juna Pool, Navin Pool, Railway Station, ST Stand, Vidya College Gate, Lake Garden, Water Treatment Plant, Tekdi Water Tank, Hari Nagar School, IT Park Gate, NMC Head Office. Give each aliases in Devanagari and romanised forms (घंटाघर, ghantaghar, clock tower).

## What "realistic" means here (quality bar)

- **Indian city texture, not a generic grid.** Organic old-city blocks next to planned societies. Rooftop black water tanks, balconies, shop awnings, compound walls around societies, a temple shikhar, a clock tower, ghats with steps to the river, a railway line with a platform roof.
- **Scale that feels right.** Wadas 8–12 m tall, apartments 12–18 m, society towers 25–45 m, sheds 8 m with wide footprints. Footprints 10–40 m. Roads at the widths above, with sidewalks.
- **Materials.** Plaster in warm off-whites, pale yellows, faded pinks and light blues. Terracotta tile on old roofs. Concrete and glass in Navi Vasahat. Asphalt with lane markings on arterials and worn concrete in lanes. Procedural canvas textures for windows (lit at night) and facades; no downloaded textures needed.
- **Lighting and atmosphere.** Drei `<Sky>` with sun position from **sim time** (day and night follow the Time Machine). Hemisphere + directional light with shadows on the near field only. Distance fog. Hills as a backdrop to the north (matching the mockup's skyline).
- **Life.** Instanced trees (neem/gulmohar-like shapes), streetlights along roads, a few auto-rickshaws and buses moving along the arterial roads on looped splines, birds as a cheap particle flock over the river. Keep it subtle.

## Complaints in the world

- **Markers.** A pin per visible request at (`loc_x`, `loc_z`). Category icon on top. Colour and text from SlaBadge status (on track, at risk, past deadline, paused). Past-deadline pins pulse (disabled under reduced motion). An L1/L2 ring around escalated ones. Selected pin: larger, with a label.
- **Issue props** (the wow detail; small and cheap):
  - streetlight_out: that streetlight renders dark at night while the complaint is open.
  - water_leak: an animated puddle decal plus a small spray particle.
  - garbage_not_collected: a garbage pile mesh by the road edge.
  - pothole: a dark decal on the road surface.
  - drainage_overflow: a dark wet decal with ripple.
  - stray_animals: two simple dog silhouettes.
  - Props disappear when the request is RESOLVED or CLOSED. That makes "fixing the city" visible during the demo.
- **Photos.** Selecting a pin opens a side drawer (the shared request summary: photo carousel, stepper, SLA, actions for this role). In 3D, a framed photo billboard floats above the selected pin (drei `<Html>` or a textured plane). In walk mode, coming within 25 m of a visible complaint shows its photo as a notice-board frame at the spot. **Photos only render for users allowed to see them** (owner and staff). The public view shows no photos and no descriptions.
- **Clustering.** When zoomed out, pins collapse to one count bubble per ward, coloured by the worst status in that ward.

## Navigation modes

| Mode | Controls | Use |
|---|---|---|
| Overview (default) | Drag to pan, scroll or pinch to zoom, right-drag or two-finger to rotate (drei `<CameraControls>`) | Map-like browsing; mobile default |
| Fly | WASD/arrow keys to move, mouse to look (pointer lock), Shift to go faster, Q/E for down/up | Fast travel, demo flythroughs |
| Walk | WASD at 1.7 m eye height, mouse look, collision against building boxes, can't leave the ground | Street-level view of a complaint |
| Fly-to | Camera tween to a ward, landmark or ticket. Triggered by search, list clicks and NIVA's `fly_to` | Guided navigation |

UI overlay:
- top-left search ("ticket, landmark or ward");
- top-right mode switch and layer toggles (complaints, ward boundaries, past-deadline heat by ward, issue props, day/night follow sim time);
- bottom-right 2D minimap with your position and ward;
- bottom-left legend.

All controls are keyboard reachable, Esc leaves pointer lock, and on-screen help appears on first use.

## Location picker (citizens filing a complaint)

Picker mode adds a crosshair cursor. Clicking the ground raycasts to (x, z) → `locate_point(x, z)` → "Near Ghantaghar Chowk, Ward 7" with a draggable pin to adjust. A point outside the city bounds or in the river is refused, with a message. The same component works in the 2D fallback.

## Performance budget

- Target: 60 fps on an integrated-GPU laptop in overview, ≥45 fps in walk mode.
- Budget: ≤200 draw calls and ≤300k triangles visible.
- InstancedMesh for buildings (per archetype), trees, streetlights and vehicles. Merge road and sidewalk geometry per ward. Shadows only within 300 m of the camera.
- `frameloop="demand"` in overview when nothing is animating. DPR capped at 1.5. drei `<PerformanceMonitor>` drops shadows, then vehicles, then the DPR.
- Generate the city in a Web Worker on first load and cache the geometry. Lazy-load the city route; the home hero shows a poster image until the scene is ready.

## 2D fallback

`CityMap2D.tsx` renders the same layout JSON as SVG (river, roads, wards, landmarks, pins). It is used when WebGL is unavailable, when the user picks "Lite mode", and as the location picker until the 3D city lands in Phase 8.

## File layout

```
apps/web/src/features/city/
  layout/navnagar.json
  gen/        prng.ts, blocks.ts, buildings.ts, roads.ts, trees.ts, worker.ts
  scene/      CityCanvas.tsx, Terrain.tsx, River.tsx, Buildings.tsx, Roads.tsx, Vegetation.tsx, Traffic.tsx, SkyAndLight.tsx
  markers/    Markers.tsx, IssueProps.tsx, PhotoBillboard.tsx, Clusters.tsx
  controls/   Overview.tsx, Fly.tsx, Walk.tsx, flyTo.ts
  ui/         Search.tsx, Layers.tsx, Minimap.tsx, Legend.tsx, PickerOverlay.tsx
  CityMap2D.tsx
  useCityData.ts   (public_markers() for anon; RLS-scoped requests + realtime for signed-in users)
```
