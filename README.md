# CAGE Crop Intelligence — macOS Desktop (0.1.0)

An **offline-first Apple Silicon macOS application scaffold**, derived from the CAGE Crop Intelligence interface. The UI, GeoTIFF import, raster statistics, multi-index screening, 2D/3D elevation visualisation, and PDF-generation logic are bundled locally. No cloud API calls are made by the application.

## Included in this starter

- Tauri 2 application shell targeting `aarch64-apple-darwin`, with a `.app`/`.dmg` bundle configuration.
- Desktop landscape interface: left-side project/layers, central 2D/3D raster surface, full-width Insights dock at the bottom.
- Local **single-band index GeoTIFF** loading: `NDVI.tif`, `NDRE.tif`, `LCI.tif`, `VARI.tif`, `GNDVI.tif`, `SAVI.tif`; optional `DTM.tif` and `DSM.tif`.
- CRS, dimensions, grid-origin and pixel-resolution checks for layers loaded together.
- Percentile-based scouting priorities, crop-stage notes and an offline multi-index consensus algorithm (`src/anomaly.js`).
- Local PDF report export with raster visual, observations, field-check recommendations and limitations.
- `LocalModelAdapter` interface for a future **installed, validated local ML model**. **No trained disease model is bundled or implied.**

## Build on an Apple Silicon Mac

### Easiest local browser test (Python launcher)

Download or clone this repository and open Terminal in its folder. With Python 3 installed, run:

```bash
python3 run_local.py --bootstrap-node
```

The script uses only Python's standard library. It checks for Node.js 20+ and npm, optionally installs Node.js using an **existing Homebrew installation** if missing, installs exact npm dependencies from `package-lock.json`, builds the browser interface, and serves it at `http://127.0.0.1:8765/` (opening your default browser). Press Ctrl+C to stop.

If Homebrew is not installed, install Node.js 20+ yourself from nodejs.org first and run `python3 run_local.py`. The script does **not** install Python, Homebrew, macOS system packages or Apple signing certificates. Use `--install-only` to build without starting the local server, `--no-browser` to skip opening a tab, or `--port 9000` to change ports.

This launcher starts the existing **local Crop Intelligence interface**. It is not yet the Spexi-style mission network, raw-photo photogrammetry engine, or a native `.app`/`.dmg` installer.

### Native macOS application build

1. Install Xcode Command Line Tools: `xcode-select --install`.
2. Install Rust (rustup), Node.js LTS, and Apple's required macOS development components.
3. Open Terminal in this project folder and run `npm install`.
4. Run `npm test` and `npm run desktop:dev`.
5. Run `npm run desktop:build` to produce the unsigned `.app` and `.dmg` under `src-tauri/target/aarch64-apple-darwin/release/bundle/`.

The installer may require Apple code signing/notarization before it is suitable for wider distribution. Tauri's native build must be run on macOS. The app targets macOS 13+, including the user's stated macOS 27.2 subject to native compatibility testing.

## First use

The demonstration field is synthetic. To analyse your own data, export **single-band numeric index GeoTIFFs** from Pix4D, DJI Terra, QGIS or Agisoft and name each by index (e.g. `NDVI.tif`). All index/elevation layers loaded together must be co-registered onto an identical pixel grid. Select the crop and growth stage and click **Run analysis**; inspect the 2D/3D map and bottom Insights cards, then use **Export PDF**. The file chooser and downloaded-report behavior must be verified on the target Mac's WebKit runtime before field deployment.

## Scientific and functional boundaries

This is a **working desktop scaffold and statistical analysis prototype**, not a certified agronomic diagnostic tool or a complete large-raster workstation yet.

- Current JavaScript GeoTIFF loader is bounded to 18 million pixels **per layer** and loads numeric raster arrays into memory; for 8 GB Macs, begin with cropped or downsampled inputs and avoid many large layers at once. The next processing tier should use tile-streamed GDAL and on-disk caches.
- RGB orthomosaic display, OBJ/PLY/LAZ point-cloud and textured-mesh import are **not yet implemented**. Current 3D view is an elevation raster visualization when DTM/DSM is available.
- Raster extent is not the same as measured crop area. Area calculation is only indicative for projected metre-based CRS and currently does not apply an explicit crop mask.
- Lower-index pixels are **relative to a given field**, not a universal stress classification. Multiple indices may share sensor artifacts, shadows, or soil-background effects, so consensus does not prove a cause.
- The local model adapter is a contract for installing a vetted Core ML/ONNX model later; it does not silently download models or substitute an LLM-generated diagnosis.
- PDF export provides an inspection report, not a treatment prescription. Confirm suspected problems through field scouting, soil/tissue tests, crop context and qualified agronomic assessment.

## AI/ML extension plan

1. Add a native tile-streaming GeoTIFF/COG reader powered by GDAL; use overview pyramids for fast pan/zoom and bounded RAM.
2. Add an orthomosaic/3D importer and a georeferenced layer-registration workflow.
3. Establish per-crop labelled datasets with ground-truth scouting observations and defined growth stages.
4. Train/evaluate segmentation or anomaly models; export vetted ONNX/Core ML models with versioned metadata and calibration.
5. Run local inference on image tiles. Compare model outputs with spectral and terrain evidence; expose confidence, data coverage, uncertainty and known blind spots.
6. Keep all processing local, with optional explicitly chosen network features only in a later version.

## Validation performed here

`npm test`: statistical screen and missing-model checks passed. `npm run build`: production frontend compiled. The Linux execution environment lacks Cargo/Rust and macOS, so the native `.app`/`.dmg` was **not compiled or runtime-tested here**.
