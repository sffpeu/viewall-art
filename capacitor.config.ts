import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theoneleggedpoet.arbook',
  appName: 'AR Book',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // Camera + AR need a full-screen webview.
    contentInset: 'never',
  },
};

export default config;
