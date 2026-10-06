import { met } from '../../core/time.js';
import { EPHEMERIS } from './ephemeris.js';

const LAUNCH_UTC_MS = Date.UTC(2026, 3, 1, 22, 35, 12);
const ENTRY_INTERFACE = EPHEMERIS.stats.entryInterfaceMet;

/**
 * Event times follow the Horizons "MAJOR EVENTS" table for target -1024.
 * `label` keeps the precision Horizons publishes; minute-only entries sit at the start of the minute.
 * `milestone` events drive the "now" panel and get a marker on the trajectory.
 */
const EVENTS = [
  { id: 'launch', met: met(0), label: '0/00:00:00', code: 'LIFTOFF', title: 'Liftoff', milestone: true, desc: 'SLS lifts off from LC-39B, Kennedy Space Center, at 22:35:12 UTC. Crew: Reid Wiseman, Victor Glover, Christina Koch, Jeremy Hansen.' },
  { id: 'arrays', met: met(0, 0, 20), label: '0/00:20', code: 'SA', title: 'Solar array deploy', desc: 'Orion deploys its four solar array wings in Earth orbit.' },
  { id: 'prm', met: met(0, 0, 49, 50), label: '0/00:49:50', code: 'PRM', title: 'Perigee raise maneuver', desc: 'Raises the orbit to 2,223 x 185 km.' },
  { id: 'arm', met: met(0, 1, 47, 57), label: '0/01:47:57', code: 'ARM', title: 'Apogee raise maneuver', milestone: true, desc: 'ICPS burn raises apogee to 70,377 km for the high Earth orbit checkout.' },
  { id: 'sep', met: met(0, 3, 24, 18), label: '0/03:24:18', code: 'SEP', title: 'Orion/ICPS separation', milestone: true, desc: 'Orion separates from the Interim Cryogenic Propulsion Stage. JPL trajectory data starts here.' },
  { id: 'uss', met: met(0, 4, 50), label: '0/04:50', code: 'USS', title: 'Upper stage separation burn', desc: 'Orion moves away from the spent ICPS.' },
  { id: 'disposal', met: met(0, 5, 0), label: '0/05:00', code: 'DISP', title: 'ICPS disposal burn', desc: 'ICPS burns for a Pacific Ocean disposal entry.' },
  { id: 'cubesats', met: met(0, 5, 4), label: '0/05:04', code: 'CUBE', title: 'CubeSats deploy', desc: 'ATENEA (CONAE), TACHELES (DLR), K-RadCube (KASA) and Space Weather CubeSat-1 (Saudi Space Agency) released at one-minute intervals.' },
  { id: 'prb', met: met(0, 12, 55), label: '0/12:55', code: 'PRB', title: 'Perigee raise burn', desc: 'Sets up perigee for translunar injection.' },
  { id: 'tli', met: met(1, 1, 14), label: '1/01:14', code: 'TLI', title: 'Translunar injection', milestone: true, desc: 'Five minute fifty five second burn (delta-v 388 m/s) puts Integrity on the free-return path. Ends at 1/01:19.' },
  { id: 'shadow', met: met(1, 1, 35), label: '1/01:35', code: 'ECL', title: 'Earth shadow entrance', desc: 'Orion coasts through Earth’s shadow until 1/02:41.' },
  { id: 'otc1', met: met(2, 0, 8), label: '2/00:08', code: 'OTC-1', title: 'Trajectory correction 1', cancelled: true, desc: 'Cancelled — not required.' },
  { id: 'otc2', met: met(3, 1, 8), label: '3/01:08', code: 'OTC-2', title: 'Trajectory correction 2', cancelled: true, desc: 'Cancelled — not required.' },
  { id: 'otc3', met: met(4, 4, 28, 5), label: '4/04:28:05', code: 'OTC-3', title: 'Outbound correction burn', milestone: true, desc: '18 second burn, delta-v 3 m/s. The only outbound correction flown.' },
  { id: 'soi', met: met(4, 7, 3, 32), label: '4/07:03:32', code: 'SOI', title: 'Lunar SOI entry', milestone: true, desc: 'Enters the lunar sphere of influence, 62,800 km from the Moon’s centre (Hill sphere definition).' },
  { id: 'pca', met: met(5, 0, 26), label: '5/00:26', code: 'PCA', title: 'Closest lunar approach', milestone: true, desc: 'Closest approach to the Moon: 8,282 km from its centre, over the far side.' },
  { id: 'max', met: met(5, 0, 30), label: '5/00:30', code: 'MAX', title: 'Maximum Earth distance', milestone: true, desc: '413,146.2 km from Earth’s centre — the farthest humans have ever travelled.' },
  { id: 'soix', met: met(5, 17, 47), label: '5/17:47', code: 'SOI-X', title: 'Lunar SOI exit', milestone: true, desc: 'Leaves the lunar sphere of influence on the free return home.' },
  { id: 'rtc1', met: met(6, 1, 28), label: '6/01:28', code: 'RTC-1', title: 'Return correction burn 1', milestone: true, desc: '15 second burn, total delta-v 0.49 m/s.' },
  { id: 'pilot', met: met(7, 4, 20), label: '7/04:20', code: 'PILOT', title: 'Manual piloting demo', cancelled: true, desc: 'Cancelled — oxidizer tank pressure characterization.' },
  { id: 'rtc2', met: met(8, 4, 18), label: '8/04:18', code: 'RTC-2', title: 'Return correction burn 2', milestone: true, desc: '9 second burn, total delta-v 1.62 m/s.' },
  { id: 'rtc3', met: met(8, 20, 18), label: '8/20:18', code: 'RTC-3', title: 'Return correction burn 3', milestone: true, desc: '8 second burn, total delta-v 1.28 m/s.' },
  { id: 'cmsep', met: met(9, 0, 58), label: '9/00:58', code: 'CM/SM', title: 'Crew/service module separation', milestone: true, desc: 'European Service Module jettisoned. Crew module raise burn (19 s, 3.0 m/s) at 9/01:01.' },
  { id: 'ei', met: met(9, 1, 18), label: '9/01:18', code: 'EI', title: 'Entry interface', milestone: true, desc: '122 km above Earth at about 11 km/s. Forward bay cover at 11 km, drogues at 7.6 km, mains from 2.9 km.' },
  { id: 'splash', met: met(9, 1, 32, 15), label: '9/01:32', code: 'SPLASH', title: 'Splashdown', milestone: true, desc: 'Pacific Ocean off San Diego at 00:07:27 UTC on 11 April. Recovery by USS John P. Murtha.' },
];

const PHASES = [
  { id: 'orbit', from: 0, to: met(1, 1, 14), name: 'Earth orbit', color: '#8aa4c8', view: 'earth' },
  { id: 'outbound', from: met(1, 1, 14), to: met(4, 7, 3, 32), name: 'Translunar coast', color: '#5eead4', view: 'overview' },
  { id: 'flyby', from: met(4, 7, 3, 32), to: met(5, 17, 47), name: 'Lunar flyby', color: '#fbbf24', view: 'moon' },
  { id: 'return', from: met(5, 17, 47), to: met(9, 1, 18), name: 'Trans-Earth coast', color: '#7dd3fc', view: 'overview' },
  { id: 'entry', from: met(9, 1, 18), to: met(9, 1, 32, 15), name: 'Entry & splashdown', color: '#f87171', view: 'earth' },
];

/** Horizons "SPACECRAFT TRAJECTORY" table: NASA/JSC navigation file covering each span (stop time, TDB). */
const NAVIGATION_FILES = [
  ['Orion_OEM_20260401_0335.V0.1', '2026-04-02T03:27'],
  ['Orion_OEM_20260402_1414.V0.1', '2026-04-02T12:45'],
  ['Orion_OEM_20260403_0318.V0.3', '2026-04-03T00:03'],
  ['EPH_OEM_20260403_1626.V0.1', '2026-04-03T17:36'],
  ['NoBurn_Orion_OEM_20260404_2046.V0.1', '2026-04-04T11:58'],
  ['traj_em2_260404-260406_260405_od011v1', '2026-04-05T02:45'],
  ['Orion_OEM_20260405_1125.V0.1', '2026-04-05T04:35'],
  ['Orion_OEM_20260406_1028.V0.1', '2026-04-05T23:59'],
  ['JPL_od014v1_260406_07_dco096_0515', '2026-04-06T17:35'],
  ['Orion_OEM_20260408_0223.V0.1', '2026-04-08T04:38'],
  ['Orion_OEM_20260408_1023.V0.1', '2026-04-08T14:31'],
  ['Orion_OEM_20260409_0312.V0.1', '2026-04-09T09:24'],
  ['Orion_OEM_20260410_0411.V0.1', '2026-04-10T06:24'],
  ['Orion_OEM_20260410_0908.V0.1', '2026-04-10T23:51'],
].map(([name, stop]) => ({ name, stopMet: (Date.parse(`${stop}Z`) - LAUNCH_UTC_MS) / 1000 }));

export default {
  id: 'artemis-ii',
  name: 'Artemis II',
  vehicle: 'Orion “Integrity”',
  spacecraftName: 'Orion',
  spacecraftLabel: 'ORION',
  launchUtcMs: LAUNCH_UTC_MS,
  initialMet: met(1, 0, 30),
  ephemeris: EPHEMERIS,
  events: EVENTS,
  phases: PHASES,
  navigationFiles: NAVIGATION_FILES,
  /** Ascent and entry play back at 1 min/s instead of 30 min/s so they stay watchable. */
  slowMotion: [[0, met(0, 0, 15)], [met(9, 0, 50), Infinity]],
  /** Inside the atmosphere the Earth-relative speed is the meaningful one. */
  usesEarthRelativeSpeed: (t) => t < 500 || t >= ENTRY_INTERFACE,
  reconstructedNotes: {
    before: 'No public vectors before ICPS separation · ascent blend and gravity + J2 propagation',
    after: 'After the last JPL vector (23:51 UTC) · J2 propagation to entry, modelled descent to splashdown',
  },
};
