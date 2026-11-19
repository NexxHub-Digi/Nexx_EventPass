module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== 'preview' && process.env.EXPO_PUBLIC_RELEASE_CHANNEL !== 'preview') {
    return config;
  }

  const value = process.env.EXPO_PUBLIC_API_URL;
  const productionValue = process.env.EXPO_PUBLIC_PRODUCTION_API_URL || 'https://nexx-eventpass.vercel.app';
  let preview;
  let production;
  try {
    preview = new URL(value);
    production = new URL(productionValue);
  } catch {
    throw new Error('Configure EXPO_PUBLIC_API_URL with the HTTPS staging origin for the preview build.');
  }

  if (preview.protocol !== 'https:' || preview.pathname !== '/' || preview.search || preview.hash ||
      preview.username || preview.password || preview.hostname === production.hostname ||
      preview.hostname === 'nexx-eventpass.vercel.app' || preview.hostname === 'localhost') {
    throw new Error('Preview builds require a standalone HTTPS staging origin, distinct from production.');
  }

  return config;
};
