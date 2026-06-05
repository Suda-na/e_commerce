module.exports = function override(config, env) {
  if (env === 'development') {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/build/**',
        '**/.git/**',
        '**/*.hot-update.*',
        '**/*.hot-update.json',
      ],
      aggregateTimeout: 600,
      poll: false,
    };

    if (config.devServer) {
      config.devServer.client = {
        ...config.devServer.client,
        overlay: { errors: true, warnings: false },
      };
      config.devServer.watchFiles = {
        paths: ['src/**/*.{js,jsx,ts,tsx,json,css}'],
        options: {
          ignored: ['**/node_modules/**', '**/build/**'],
          usePolling: false,
        },
      };
    }

    config.optimization = {
      ...config.optimization,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    };
  }

  return config;
};
