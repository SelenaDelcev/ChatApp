module.exports = function override(config, env) {
    if (env === 'development') {
      config.devServer = {
        ...config.devServer,
        compress: false, // Disable compression
      };
    }
    return config;
  };