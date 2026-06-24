import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fussballmanager.app',
  appName: 'WM Fussballmanager 2026',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
