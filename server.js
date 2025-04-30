const express = require('express');
const axios = require('axios');
const fsExtra = require('fs-extra');
const path = require('path');
const app = express();
const port = 3000;

const cacheDir = path.join(__dirname, 'cache');
fsExtra.ensureDirSync(cacheDir);

const modelTypes = {
  HRRR: {
    surface: [
      'ref1km_ptype', 
      'sfcrh',
      'sfct-imp',
      'sfctd-imp',
      'sfcthetae_b',
      'sfcwind_mslp',
      'smoke_viden',
      'qpf_001h-imp',
      'qpf_006h-imp',
      'qpf_012h-imp',
      'qpf_acc-imp',
      'cloudcover',
      'cloudcover_levels',
      'lgtden',
      'sim_ir',
      'ref1km',
      'refcmp'
    ],
    upper_air: [
      '500wh',
      '700wh',
      '850wh',
      '700th',
      '850th',
      '700tadv',
      '850tadv'
    ],
    severe: [
      'cape03',
      'mlcape',
      'sbcin',
      'mlcin',
      'sblcl',
      'lr75',
      'bs01',
      'bs06',
      'srh01',
      'srh03',
      'ehi01',
      'ehi03',
      'scp',
      'stp'
    ]
  },
  RAP: {
    surface: [
      'ref1km_ptype',
      'sfct-imp',
      'sfctd-imp',
      'sfcwind_mslp',
      'qpf_001h-imp',
      'qpf_006h-imp',
      'qpf_012h-imp',
      'qpf_acc-imp',
      'cloudcover',
      'cloudcover_levels',
      'pwat',
      'sim_ir',
      'refcmp'
    ],
    upper_air: [
      '200wh',
      '300wh',
      '500wh',
      '700wh',
      '850wh',
      '925wh',
      '500h_change_012h',
      '500th',
      '700th',
      '850th',
      '925th'
    ],
    upper_air_moisture: [
      '200rh',
      '500rh',
      '850rh',
      '850td',
      '925td'
    ],
    upper_air_dynamics: [
      '500hv',
      '500hvv',
      '700hvv',
      '850hvv',
      '700tadv',
      '850tadv'
    ],
    severe: [
      'cape03',
      'mlcape',
      'lr75',
      'mucape',
      'sbcin',
      'bs06',
      'ehi01',
      'ehi03',
      'scp',
      'stp'
    ]
  },
  NAM_4km: {
    surface: [
      'ref1km_ptype',
      'sfcrh',
      'sfct-imp',
      'sfctd-imp',
      'sfcwind_mslp',
      'qpf_003h-imp',
      'qpf_006h-imp',
      'qpf_012h-imp',
      'qpf_024h-imp',
      'qpf_acc-imp',
      'cloudcover',
      'cloudcover_levels',
      'pwat',
      'sim_ir',
      'refcmp'
    ],
    upper_air: [
      '500wh',
      '700wh',
      '850wh',
      '700th',
      '850th'
    ],
    upper_air_dynamics: [
      '700tadv',
      '850tadv'
    ],
    severe: [
      'lr75',
      'mlcape',
      'mlcin',
      'mucape',
      'sbcape',
      'sbcin',
      'sbli',
      'bs06',
      'srh01',
      'srh03',
      'ehi01',
      'ehi03',
      'scp',
      'stp',
      'uh03_max',
      'crossover',
      'sbcape_hodo'
    ]
  }
};

const getCurrentUTCTime = () => {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() - 1);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  
  const utcHours = now.getUTCHours();
  const soundingHour = utcHours >= 12 ? '12' : '00';
  const soundingDate = utcHours < 12 && soundingHour === '00' ? 
    new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  const soundingYear = soundingDate.getUTCFullYear();
  const soundingMonth = String(soundingDate.getUTCMonth() + 1).padStart(2, '0');
  const soundingDay = String(soundingDate.getUTCDate()).padStart(2, '0');
  const soundingTime = `${soundingYear.toString().slice(2)}${soundingMonth}${soundingDay}${soundingHour}`;
  
  return {
    yyyymmdd: `${year}${month}${day}`,
    yyyymm: `${year}${month}`,
    pivotalHour: `${year}${month}${day}${hour}`,
    baseHour: now,
    nadocastHour: '12z',
    soundingTime
  };
};

const padForecastHour = (fh) => String(fh).padStart(3, '0');

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
    console.error(`Error fetching ${modelName} from ${url}:`, error.message);
    return null;
  }
};

const fetchHRRRImage = async (param, fh, baseTime) => {
  const forecastHour = padForecastHour(fh);
  const { pivotalHour } = getCurrentUTCTime();
  
  const url = `https://m2o.pivotalweather.com/maps/models/hrrr/${pivotalHour}/${forecastHour}/${param}.conus.png`;
  const cachePath = path.join(cacheDir, `hrrr_${param}_${pivotalHour}_${forecastHour}.png`);
  
  return fetchAndCacheImage(url, cachePath, 'HRRR');
};

const fetchRAPImage = async (param, fh, baseTime) => {
  const maxHourAttempts = 6;
  const maxDayAttempts = 3;
  const targetFh = parseInt(fh);
  const targetValidTime = new Date(baseTime);
  targetValidTime.setUTCHours(targetValidTime.getUTCHours() + targetFh);
  
  for (let dayAttempt = 0; dayAttempt < maxDayAttempts; dayAttempt++) {
    const dayAttemptTime = new Date(baseTime);
    dayAttemptTime.setUTCDate(dayAttemptTime.getUTCDate() - dayAttempt);
    
    for (let hourAttempt = 0; hourAttempt < maxHourAttempts; hourAttempt++) {
      const attemptInitTime = new Date(dayAttemptTime);
      attemptInitTime.setUTCHours(attemptInitTime.getUTCHours() - hourAttempt);
      
      const timeDiffHours = (targetValidTime - attemptInitTime) / (1000 * 60 * 60);
      const neededFh = Math.floor(timeDiffHours);
      
      if (neededFh < 0 || neededFh > 60) continue;
      
      const year = attemptInitTime.getUTCFullYear();
      const month = String(attemptInitTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(attemptInitTime.getUTCDate()).padStart(2, '0');
      const hour = String(attemptInitTime.getUTCHours()).padStart(2, '0');
      const pivotalHour = `${year}${month}${day}${hour}`;
      const forecastHour = padForecastHour(neededFh);
      const url = `https://m2o.pivotalweather.com/maps/models/rap/${pivotalHour}/${forecastHour}/${param}.conus.png`;
      const cachePath = path.join(cacheDir, `rap_${param}_${pivotalHour}_${forecastHour}.png`);

      try {
        const cacheExists = await fsExtra.pathExists(cachePath);
        if (cacheExists) {
          console.log(`Using cached image for RAP (init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}): ${cachePath}`);
          return `/cache/${path.basename(cachePath)}`;
        }

        console.log(`Attempt ${dayAttempt * maxHourAttempts + hourAttempt + 1}/${maxHourAttempts * maxDayAttempts} - Fetching RAP init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        await fsExtra.writeFile(cachePath, response.data);
        console.log(`Cached new image for RAP (init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}): ${cachePath}`);
        return `/cache/${path.basename(cachePath)}`;
      } catch (error) {
        console.error(`Attempt ${dayAttempt * maxHourAttempts + hourAttempt + 1}/${maxHourAttempts * maxDayAttempts} - Error fetching RAP from ${url}:`, error.message);
        
        if (dayAttempt === maxDayAttempts - 1 && hourAttempt === maxHourAttempts - 1) {
          console.error(`Failed to fetch RAP after ${maxHourAttempts * maxDayAttempts} attempts`);
          return null;
        }
      }
    }
  }
  return null;
};

const fetchNAMImage = async (param, fh, baseTime) => {
  const maxHourAttempts = 6;
  const maxDayAttempts = 3;
  const targetFh = parseInt(fh);
  const targetValidTime = new Date(baseTime);
  targetValidTime.setUTCHours(targetValidTime.getUTCHours() + targetFh);
  
  for (let dayAttempt = 0; dayAttempt < maxDayAttempts; dayAttempt++) {
    const dayAttemptTime = new Date(baseTime);
    dayAttemptTime.setUTCDate(dayAttemptTime.getUTCDate() - dayAttempt);
    
    for (let hourAttempt = 0; hourAttempt < maxHourAttempts; hourAttempt++) {
      const attemptInitTime = new Date(dayAttemptTime);
      attemptInitTime.setUTCHours(attemptInitTime.getUTCHours() - hourAttempt);
      
      const timeDiffHours = (targetValidTime - attemptInitTime) / (1000 * 60 * 60);
      const neededFh = Math.floor(timeDiffHours);
      
      if (neededFh < 0 || neededFh > 60) continue;
      
      const year = attemptInitTime.getUTCFullYear();
      const month = String(attemptInitTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(attemptInitTime.getUTCDate()).padStart(2, '0');
      const hour = String(attemptInitTime.getUTCHours()).padStart(2, '0');
      const pivotalHour = `${year}${month}${day}${hour}`;
      const forecastHour = padForecastHour(neededFh);
      const url = `https://m1o.pivotalweather.com/maps/models/nam4km/${pivotalHour}/${forecastHour}/${param}.conus.png`;
      const cachePath = path.join(cacheDir, `nam4km_${param}_${pivotalHour}_${forecastHour}.png`);

      try {
        const cacheExists = await fsExtra.pathExists(cachePath);
        if (cacheExists) {
          console.log(`Using cached image for NAM (init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}): ${cachePath}`);
          return `/cache/${path.basename(cachePath)}`;
        }

        console.log(`Attempt ${dayAttempt * maxHourAttempts + hourAttempt + 1}/${maxHourAttempts * maxDayAttempts} - Fetching NAM init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        await fsExtra.writeFile(cachePath, response.data);
        console.log(`Cached new image for NAM (init ${pivotalHour}, fh ${forecastHour} for target fh ${fh}): ${cachePath}`);
        return `/cache/${path.basename(cachePath)}`;
      } catch (error) {
        console.error(`Attempt ${dayAttempt * maxHourAttempts + hourAttempt + 1}/${maxHourAttempts * maxDayAttempts} - Error fetching NAM from ${url}:`, error.message);
        
        if (dayAttempt === maxDayAttempts - 1 && hourAttempt === maxHourAttempts - 1) {
          console.error(`Failed to fetch NAM after ${maxHourAttempts * maxDayAttempts} attempts`);
          return null;
        }
      }
    }
  }
  return null;
};

const fetchSoundingImage = async (station, fh, baseTime, soundingTime) => {
  const forecastHour = padForecastHour(fh);
  const maxHourAttempts = 6;

  for (let hourAttempt = 0; hourAttempt < maxHourAttempts; hourAttempt++) {
    const attemptInitTime = new Date(baseTime);
    attemptInitTime.setUTCHours(attemptInitTime.getUTCHours() - hourAttempt);
    
    const year = attemptInitTime.getUTCFullYear();
    const month = String(attemptInitTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(attemptInitTime.getUTCDate()).padStart(2, '0');
    const hour = attemptInitTime.getUTCHours() >= 12 ? '12' : '00';
    const attemptSoundingTime = `${year.toString().slice(2)}${month}${day}${hour}`;
    
    const url = `https://www.spc.noaa.gov/exper/soundings/${attemptSoundingTime}_OBS/${station}.gif`;
    const cachePath = path.join(cacheDir, `sounding_${station}_${attemptSoundingTime}_${forecastHour}.gif`);
    
    try {
      const cacheExists = await fsExtra.pathExists(cachePath);
      if (cacheExists) {
        console.log(`Using cached sounding for ${station}: ${cachePath}`);
        return `/cache/${path.basename(cachePath)}`;
      }

      console.log(`Fetching sounding for ${station}: ${url}`);
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      await fsExtra.writeFile(cachePath, response.data);
      console.log(`Cached new sounding for ${station}: ${cachePath}`);
      return `/cache/${path.basename(cachePath)}`;
    } catch (error) {
      console.error(`Error fetching sounding for ${station} from ${url}:`, error.message);
      if (hourAttempt === maxHourAttempts - 1) {
        return null;
      }
    }
  }
  return null;
};

const fetchNadocastWithFallback = async (cacheDir, baseTime, yyyymm) => {
  const maxDayAttempts = 3;
  const initHours = ['12z', '00z'];
  const maxAttempts = maxDayAttempts * initHours.length;

  for (let dayAttempt = 0; dayAttempt < maxDayAttempts; dayAttempt++) {
    const attemptDate = new Date(baseTime);
    attemptDate.setUTCDate(attemptDate.getUTCDate() - dayAttempt);

    const year = attemptDate.getUTCFullYear();
    const month = String(attemptDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(attemptDate.getUTCDate()).padStart(2, '0');
    const attemptYyyyMm = `${year}${month}`;
    const attemptYyyyMmDd = `${year}${month}${day}`;

    for (let hourIndex = 0; hourIndex < initHours.length; hourIndex++) {
      const nadocastHour = initHours[hourIndex];
      const attemptNumber = dayAttempt * initHours.length + hourIndex + 1;

      const url = `http://data.nadocast.com/${attemptYyyyMm}/${attemptYyyyMmDd}/t${nadocastHour}/nadocast_2022_models_conus_tornado_${attemptYyyyMmDd}_t${nadocastHour}_f02-23.png`;
      const cachePath = path.join(cacheDir, `nadocast_${attemptYyyyMmDd}_${nadocastHour}.png`);

      try {
        const cacheExists = await fsExtra.pathExists(cachePath);
        if (cacheExists) {
          console.log(`Using cached Nadocast image for ${attemptYyyyMmDd} ${nadocastHour}: ${cachePath}`);
          return `/cache/${path.basename(cachePath)}`;
        }

        console.log(`Attempt ${attemptNumber}/${maxAttempts} - Fetching Nadocast for ${attemptYyyyMmDd} ${nadocastHour}: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        await fsExtra.writeFile(cachePath, response.data);
        console.log(`Cached new Nadocast image for ${attemptYyyyMmDd} ${nadocastHour}: ${cachePath}`);
        return `/cache/${path.basename(cachePath)}`;
      } catch (error) {
        console.error(`Attempt ${attemptNumber}/${maxAttempts} - Error fetching Nadocast from ${url}:`, error.message);
        if (dayAttempt === maxDayAttempts - 1 && hourIndex === initHours.length - 1) {
          console.error(`Failed to fetch Nadocast after ${maxAttempts} attempts`);
          return null;
        }
      }
    }
  }
  return null;
};

app.use('/cache', express.static(cacheDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/images', async (req, res) => {
  const { param = 'ref1km_ptype', fh = '1' } = req.query;
  const forecastHour = padForecastHour(fh);
  const { yyyymmdd, yyyymm, pivotalHour, nadocastHour, baseHour, soundingTime } = getCurrentUTCTime();

  try {
    const imagePromises = [
      fetchHRRRImage(param, fh, baseHour),
      fetchRAPImage(param, fh, baseHour),
      fetchNAMImage(param, fh, baseHour),
      fetchNadocastWithFallback(cacheDir, baseHour, yyyymm),
      fetchAndCacheImage(
        `https://www.spc.noaa.gov/products/outlook/day1otlk_2000.gif`,
        path.join(cacheDir, `spc_outlook.gif`),
        'SPC_Outlook'
      ),
      fetchAndCacheImage(
        `https://www.spc.noaa.gov/exper/soundings/${soundingTime}_OBS/sndgmap.gif`,
        path.join(cacheDir, `noaa_soundings_base_${fh}.gif`),
        'NOAA_Soundings'
      )
    ];

    const images = await Promise.all(imagePromises);
    res.json({
      hrrr: images[0],
      rap: images[1],
      nam4km: images[2],
      nadocast: images[3],
      spc_outlook: images[4],
      noaa_soundings: { baseImage: images[5] },
      modelTypes
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

app.get('/sounding', async (req, res) => {
  const { station, fh = '1' } = req.query;
  const { baseHour, soundingTime } = getCurrentUTCTime();

  if (!station) {
    return res.status(400).json({ error: 'Station ID is required' });
  }

  try {
    const image = await fetchSoundingImage(station, fh, baseHour, soundingTime);
    if (!image) {
      return res.status(404).json({ error: `No sounding available for station ${station}` });
    }
    res.json({ image });
  } catch (error) {
    console.error(`Error fetching sounding for ${station}:`, error);
    res.status(500).json({ error: 'Failed to fetch sounding image' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
