const express = require('express');
const axios = require('axios');
const fsExtra = require('fs-extra');
const path = require('path');
const app = express();
const port = 3000;

const cacheDir = path.join(__dirname, 'cache');
fsExtra.ensureDirSync(cacheDir);

// Updated modelTypes with new HRRR parameters (organized by category)
const modelTypes = {
  HRRR: {
    surface: [
      'ref1km_ptype', 
      '2m_temperature', 
      'precipitation_rate', 
      'cloud_cover',
      'sfcrh',                  // 2m AGL Relative Humidity
      'sfct-imp',               // 2m AGL Temperature
      'sfctd-imp',              // 2m AGL Dew Point
      'sfcthetae_b',            // 2m AGL Theta-E Wind Barbs
      'sfcwind_mslp',           // MSLP + 10m AGL Winds
      'smoke_viden',            // Vertical Integrated Liquid
      'qpf_001h-imp',           // 1hr QPF
      'qpf_006h-imp',           // 6hr QPF
      'qpf_012h-imp',           // 12hr QPF
      'qpf_acc-imp',            // Total QPF
      'cloudcover',             // Cloud Cover
      'cloudcover_levels',      // Cloud Cover with Levels
      'lgtden',                 // Lightning Density
      'sim_ir',                 // IR Satellite
      'ref1km',                 // 1km AGL Reflectivity
      'refcmp'                  // Composite Reflectivity
    ],
    upper_air: [
      '500wh',                  // 500mb Height/Wind
      '700wh',                  // 700mb Height/Wind
      '850wh',                  // 850mb Height/Wind
      '700th',                  // 700mb Temp/Height/Wind
      '850th',                  // 850mb Temp/Height/Wind
      '700tadv',                // 700mb Temp Advection
      '850tadv'                 // 850mb Temp Advection
    ],
    severe: [
      'cape03',                 // 0-3km AGL CAPE
      'mlcape',                 // Mixed Layer CAPE
      'sbcin',                  // Surface Based CIN
      'mlcin',                  // Mixed Layer CIN
      'sblcl',                  // Surface Based LCL Height
      'lr75',                   // 700-500mb Lapse Rate
      'bs01',                   // 0-1km Bulk Shear
      'bs06',                   // 0-6km Bulk Shear
      'srh01',                  // 0-1km Storm Helicity
      'srh03',                  // 0-3km Storm Helicity
      'ehi01',                  // 0-1km Energy Helicity Index
      'ehi03',                  // 0-3km Energy Helicity Index
      'scp',                    // Supercell Composite
      'stp'                     // Sig Tornado Parameter
    ]
  },
  // Keep existing RAP and NAM parameters unchanged
  RAP: {
    surface: [
      'ref1km_ptype',
      '2m_temperature',
      'precipitation_rate',
      'wind_gusts',
      'sfct-imp',           // 2m AGL Temperature
      'sfctd-imp',          // 2m AGL Dew Point
      'sfcwind_mslp',       // MSLP + 10m AGL Winds
      'qpf_001h-imp',       // 1hr QPF
      'qpf_006h-imp',       // 6hr QPF
      'qpf_012h-imp',       // 12hr QPF
      'qpf_acc-imp',        // Total QPF
      'cloudcover',         // Cloud Cover
      'cloudcover_levels',  // Cloud Cover Levels
      'pwat',               // Precipitable Water
      'sim_ir',             // Simulated IR Satellite
      'refcmp'              // Composite Reflectivity
    ],
    upper_air: [
      '200wh',              // 200mb Height/Wind
      '300wh',              // 300mb Height/Wind
      '500wh',              // 500mb Height/Wind
      '700wh',              // 700mb Height/Wind
      '850wh',              // 850mb Height/Wind
      '925wh',              // 925mb Height/Wind
      '500h_change_012h',   // 500mb Height Change (12hr)
      '500th',              // 500mb Temp/Height/Wind
      '700th',              // 700mb Temp/Height/Wind
      '850th',              // 850mb Temp/Height/Wind
      '925th'               // 925mb Temp/Height/Wind
    ],
    upper_air_moisture: [
      '200rh',              // 200mb RH/Wind
      '500rh',              // 500mb RH/Wind
      '850rh',              // 850mb RH/Wind
      '850td',              // 850mb Dewpoint/Height/Wind
      '925td'               // 925mb Dewpoint/Height/Wind
    ],
    upper_air_dynamics: [
      '500hv',              // 500mb Height Vorticity
      '500hvv',             // 500mb Height/Vertical Velocity
      '700hvv',             // 700mb Height/Vertical Velocity
      '850hvv',             // 850mb Height/Vertical Velocity
      '700tadv',            // 700mb Temp Advection
      '850tadv'             // 850mb Temp Advection
    ],
    severe: [
      'cape03',             // 0-3km CAPE
      'mlcape',             // Mixed Layer CAPE
      'lr75',               // 700-500mb Lapse Rate
      'mucape',             // Most Unstable CAPE
      'sbcin',              // Surface Based CIN
      'bs06',               // 0-6km Bulk Shear
      'ehi01',              // 0-1km Energy Helicity
      'ehi03',              // 0-3km Energy Helicity
      'scp',                // Supercell Composite
      'stp'                 // Sig Tornado Parameter
    ]
  },

  NAM_4km: {
    surface: [
      'ref1km_ptype',
      '2m_temperature',
      'precipitation_rate',
      'sfcrh',               // 2m Relative Humidity
      'sfct-imp',           // 2m Temperature
      'sfctd-imp',          // 2m Dew Point
      'sfcwind_mslp',       // MSLP + 10m Winds
      'qpf_003h-imp',       // 3hr QPF
      'qpf_006h-imp',       // 6hr QPF
      'qpf_012h-imp',       // 12hr QPF
      'qpf_024h-imp',       // 24hr QPF
      'qpf_acc-imp',        // Total QPF
      'cloudcover',         // Cloud Cover
      'cloudcover_levels',  // Cloud Cover Levels
      'pwat',               // Precipitable Water
      'sim_ir',             // Simulated IR Satellite
      'refcmp'              // Composite Reflectivity
    ],
    upper_air: [
      '500wh',              // 500mb Height/Wind
      '700wh',              // 700mb Height/Wind
      '850wh',              // 850mb Height/Wind
      '700th',              // 700mb Temp/Height/Wind
      '850th'               // 850mb Temp/Height/Wind
    ],
    upper_air_dynamics: [
      '700tadv',            // 700mb Temp Advection
      '850tadv'             // 850mb Temp Advection
    ],
    severe: [
      'lr75',               // 700-500mb Lapse Rate
      'mlcape',             // Mixed Layer CAPE
      'mlcin',              // Mixed Layer CIN
      'mucape',             // Most Unstable CAPE
      'sbcape',             // Surface Based CAPE
      'sbcin',              // Surface Based CIN
      'sbli',               // Surface Lifted Index
      'bs06',               // 0-6km Bulk Shear
      'srh01',              // 0-1km Storm Relative Helicity
      'srh03',              // 0-3km Storm Relative Helicity
      'ehi01',              // 0-1km Energy Helicity Index
      'ehi03',              // 0-3km Energy Helicity Index
      'scp',                // Supercell Composite
      'stp',                // Sig Tornado Parameter
      'uh03_max',           // Updraft Helicity 0-3km
      'uh25_003h',          // Updraft Helicity 2-5km
      'crossover',          // SB CAPE
      'sbcape_hodo'         // SB CAPE Hodograph
    ]
  }
};

// Everything below this stays EXACTLY THE SAME //
// Get current UTC time for URL construction
const getCurrentUTCTime = () => {
  const now = new Date();
  // Use previous hour to account for model run delays
  now.setUTCHours(now.getUTCHours() - 1);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return {
    yyyymmdd: `${year}${month}${day}`,
    yyyymm: `${year}${month}`,
    pivotalHour: `${year}${month}${day}${hour}`,
    namBaseHour: now, // Base time for NAM fallback
    nadocastHour: '12z'
  };
};

// Pad forecast hour to three digits (e.g., 1 -> 001, 36 -> 036)
const padForecastHour = (fh) => String(fh).padStart(3, '0');

// Fetch and cache image for HRRR, RAP, Nadocast, SPC
const fetchAndCacheImage = async (url, cachePath, modelName) => {
  try {
    const cacheExists = await fsExtra.pathExists(cachePath);
    if (cacheExists) {
      console.log(`Using cached image for ${modelName}: ${cachePath}`);
      return `/cache/${path.basename(cachePath)}`;
    }

    console.log(`Fetching image for ${modelName}: ${url}`);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    await fsExtra.writeFile(cachePath, response.data);
    console.log(`Cached new image for ${modelName}: ${cachePath}`);
    return `/cache/${path.basename(cachePath)}`;
  } catch (error) {
    console.error(`Error fetching ${modelName} from ${url}:`, error.message, error.response ? error.response.status : 'No status');
    return null;
  }
};

// Fetch NAM 4km with fallback to earlier hours
const fetchAndCacheImageWithFallback = async (param, fh, cacheDir, modelName, baseTime) => {
  const maxAttempts = 6; // Try up to 6 hours back
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptTime = new Date(baseTime);
    attemptTime.setUTCHours(attemptTime.getUTCHours() - attempt);
    const year = attemptTime.getUTCFullYear();
    const month = String(attemptTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(attemptTime.getUTCDate()).padStart(2, '0');
    const hour = String(attemptTime.getUTCHours()).padStart(2, '0');
    const pivotalHour = `${year}${month}${day}${hour}`;
    const forecastHour = padForecastHour(fh);
    const url = `https://m1o.pivotalweather.com/maps/models/nam4km/${pivotalHour}/${forecastHour}/${param}.conus.png`;
    const cachePath = path.join(cacheDir, `nam4km_${param}_${pivotalHour}_${forecastHour}.png`);

    try {
      const cacheExists = await fsExtra.pathExists(cachePath);
      if (cacheExists) {
        console.log(`Using cached image for ${modelName} (hour ${pivotalHour}, fh ${fh}): ${cachePath}`);
        return `/cache/${path.basename(cachePath)}`;
      }

      console.log(`Attempt ${attempt + 1}/${maxAttempts} - Fetching ${modelName} for hour ${pivotalHour}, fh ${fh}: ${url}`);
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      await fsExtra.writeFile(cachePath, response.data);
      console.log(`Cached new image for ${modelName} (hour ${pivotalHour}, fh ${fh}): ${cachePath}`);
      return `/cache/${path.basename(cachePath)}`;
    } catch (error) {
      console.error(`Attempt ${attempt + 1}/${maxAttempts} - Error fetching ${modelName} from ${url}:`, error.message, error.response ? error.response.status : 'No status');
      if (attempt === maxAttempts - 1) {
        console.error(`Failed to fetch ${modelName} after ${maxAttempts} attempts`);
        return null;
      }
    }
  }
};

app.use('/cache', express.static(cacheDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/images', async (req, res) => {
  const { param = 'ref1km_ptype', fh = '1' } = req.query;
  const forecastHour = padForecastHour(fh);
  const { yyyymmdd, yyyymm, pivotalHour, nadocastHour, namBaseHour } = getCurrentUTCTime();

  try {
    const imagePromises = [
      fetchAndCacheImage(
        `https://m2o.pivotalweather.com/maps/models/hrrr/${pivotalHour}/${forecastHour}/${param}.conus.png`,
        path.join(cacheDir, `hrrr_${param}_${pivotalHour}_${forecastHour}.png`),
        'HRRR'
      ),
      fetchAndCacheImage(
        `https://m2o.pivotalweather.com/maps/models/rap/${pivotalHour}/${forecastHour}/${param}.conus.png`,
        path.join(cacheDir, `rap_${param}_${pivotalHour}_${forecastHour}.png`),
        'RAP'
      ),
      fetchAndCacheImageWithFallback(
        param,
        fh,
        cacheDir,
        'NAM_4km',
        namBaseHour
      ),
      fetchAndCacheImage(
        `http://data.nadocast.com/${yyyymm}/${yyyymmdd}/t${nadocastHour}/nadocast_2022_models_conus_tornado_${yyyymmdd}_t${nadocastHour}_f02-23.png`,
        path.join(cacheDir, `nadocast_${yyyymmdd}_${nadocastHour}.png`),
        'Nadocast'
      ),
      fetchAndCacheImage(
        `https://www.spc.noaa.gov/products/outlook/day1otlk_2000.gif`,
        path.join(cacheDir, `spc_outlook.gif`),
        'SPC_Outlook'
      )
    ];

    const images = await Promise.all(imagePromises);
    res.json({
      hrrr: images[0],
      rap: images[1],
      nam4km: images[2],
      nadocast: images[3],
      spc_outlook: images[4],
      modelTypes
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
