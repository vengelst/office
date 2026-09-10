// Local development gets its own Android identity alongside the distributed app.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'development') return config;
  return {
    ...config,
    name: 'VH Kiosk Test',
    scheme: 'vhkiosk-dev',
    android: { ...config.android, package: 'de.vivahome.kiosk.dev' },
  };
};
