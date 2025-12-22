
import { FixtureConfig, AudioReactiveConfig } from './types';

export const DEFAULT_WS_URL = 'ws://localhost:8000';
export const MAX_CHANNELS = 512;
export const MAX_DMX_VALUE = 255;

// Added missing 'autoMode' property to the default configuration
const createDefaultAudioConfig = (): AudioReactiveConfig => ({
  enabled: false,
  autoMode: false,
  frequency: 'mid',
  threshold: 20,
  sensitivity: 1.2,
  decay: 0.92,
});

export const INITIAL_FIXTURES: FixtureConfig[] = [
  // --- Page 1: Old PAR (1ch) ---
  { id: 'p1', type: 'dimmer', name: 'PAR Left - Red', startChannel: 1, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p2', type: 'dimmer', name: 'PAR Left - Green', startChannel: 2, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p3', type: 'dimmer', name: 'PAR Left - Blue', startChannel: 3, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p4', type: 'dimmer', name: 'PAR Left - White', startChannel: 4, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p5', type: 'dimmer', name: 'PAR Right - White', startChannel: 5, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p6', type: 'dimmer', name: 'PAR Right - Blue', startChannel: 6, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p7', type: 'dimmer', name: 'PAR Right - Green', startChannel: 7, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 'p8', type: 'dimmer', name: 'PAR Right - Red', startChannel: 8, group: 'WASH', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },

  // --- Page 2: Top Wash ---
  { id: 't1', type: 'dimmer', name: 'Top Wash 1', startChannel: 9, group: 'TOP', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 't2', type: 'dimmer', name: 'Top Wash 2', startChannel: 10, group: 'TOP', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 't3', type: 'dimmer', name: 'Top Wash 3', startChannel: 11, group: 'TOP', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },
  { id: 't4', type: 'dimmer', name: 'Top Wash 4', startChannel: 12, group: 'TOP', values: [0], manualValues: [0], mutes: [false], audioConfigs: [createDefaultAudioConfig()] },

  // --- LED PAR 36 (6ch) ---
  { id: 'l1', type: 'led_par', name: 'Backdrop L', startChannel: 33, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },
  { id: 'l2', type: 'led_par', name: 'Backdrop R', startChannel: 49, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },
  { id: 'l3', type: 'led_par', name: 'Mid R', startChannel: 65, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },
  { id: 'l4', type: 'led_par', name: 'Mid L', startChannel: 81, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },
  { id: 'l5', type: 'led_par', name: 'Front R', startChannel: 97, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },
  { id: 'l6', type: 'led_par', name: 'Front L', startChannel: 113, group: 'LED', values: Array(6).fill(0), manualValues: Array(6).fill(0), mutes: Array(6).fill(false), audioConfigs: Array(6).fill(null).map(createDefaultAudioConfig) },

  // --- Spider LM30 (13ch) ---
  { id: 's1', type: 'spider', name: 'Spider Left', startChannel: 129, group: 'FX', values: Array(13).fill(0), manualValues: Array(13).fill(0), mutes: Array(13).fill(false), audioConfigs: Array(13).fill(null).map(createDefaultAudioConfig) },
  { id: 's2', type: 'spider', name: 'Spider Center', startChannel: 145, group: 'FX', values: Array(13).fill(0), manualValues: Array(13).fill(0), mutes: Array(13).fill(false), audioConfigs: Array(13).fill(null).map(createDefaultAudioConfig) },
  { id: 's3', type: 'spider', name: 'Spider Right', startChannel: 161, group: 'FX', values: Array(13).fill(0), manualValues: Array(13).fill(0), mutes: Array(13).fill(false), audioConfigs: Array(13).fill(null).map(createDefaultAudioConfig) },

  // --- Cold Spark & Laser ---
  { id: 'cs1', type: 'spark', name: 'Spark 1', startChannel: 177, group: 'FX', values: [0,0], manualValues: [0,0], mutes: [false, false], audioConfigs: [createDefaultAudioConfig(), createDefaultAudioConfig()] },
  { id: 'cs2', type: 'spark', name: 'Spark 2', startChannel: 179, group: 'FX', values: [0,0], manualValues: [0,0], mutes: [false, false], audioConfigs: [createDefaultAudioConfig(), createDefaultAudioConfig()] },
  { id: 'ls1', type: 'laser', name: 'Laser F2750', startChannel: 184, group: 'FX', values: Array(8).fill(0), manualValues: Array(8).fill(0), mutes: Array(8).fill(false), audioConfigs: Array(8).fill(null).map(createDefaultAudioConfig) },
];

export const FIXTURE_LAYOUTS = {
  dimmer: [{ offset: 0, label: 'Int', type: 'intensity' }],
  led_par: [
    { offset: 0, label: 'Red', type: 'red' },
    { offset: 1, label: 'Grn', type: 'green' },
    { offset: 2, label: 'Blu', type: 'blue' },
    { offset: 3, label: 'Macro', type: 'fx' },
    { offset: 4, label: 'Strob', type: 'strobe' },
    { offset: 5, label: 'Speed', type: 'speed' },
  ],
  spider: [
    { offset: 0, label: 'TiltA', type: 'tilt' },
    { offset: 1, label: 'TiltB', type: 'tilt' },
    { offset: 2, label: 'Mast', type: 'master' },
    { offset: 3, label: 'Strob', type: 'strobe' },
    { offset: 4, label: 'R-A', type: 'red' },
    { offset: 5, label: 'G-A', type: 'green' },
    { offset: 6, label: 'B-A', type: 'blue' },
    { offset: 7, label: 'W-A', type: 'white' },
    { offset: 8, label: 'R-B', type: 'red' },
    { offset: 9, label: 'G-B', type: 'green' },
    { offset: 10, label: 'B-B', type: 'blue' },
    { offset: 11, label: 'W-B', type: 'white' },
    { offset: 12, label: 'Srvc', type: 'fx' },
  ],
  spark: [
    { offset: 0, label: 'FIRE', type: 'fx' },
    { offset: 1, label: 'Mode', type: 'fx' },
  ],
  laser: [
    { offset: 0, label: 'Pat1', type: 'fx' },
    { offset: 1, label: 'Pat2', type: 'fx' },
    { offset: 2, label: 'Pat3', type: 'fx' },
    { offset: 3, label: 'Pat4', type: 'fx' },
    { offset: 4, label: 'Colr', type: 'fx' },
    { offset: 5, label: 'Rotat', type: 'fx' },
    { offset: 6, label: 'PosX', type: 'pan' },
    { offset: 7, label: 'PosY', type: 'tilt' },
  ]
};
