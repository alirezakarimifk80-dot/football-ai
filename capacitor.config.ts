export interface CapacitorAppConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime: boolean;
  server: {
    androidScheme: 'https' | 'http';
    cleartext: boolean;
  };
  ios: {
    contentInset: 'automatic' | 'always' | 'never';
    backgroundColor: string;
  };
  android: {
    backgroundColor: string;
    allowMixedContent: boolean;
  };
  plugins: {
    StatusBar: {
      style: 'DARK' | 'LIGHT';
      backgroundColor: string;
    };
    SplashScreen: {
      launchShowDuration: number;
      backgroundColor: string;
      showSpinner: boolean;
    };
  };
}

const config: CapacitorAppConfig = {
  appId: 'com.footballai.platform',
  appName: 'Football AI',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#090B0E',
  },
  android: {
    backgroundColor: '#090B0E',
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090B0E',
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#090B0E',
      showSpinner: false,
    },
  },
};

export default config;
