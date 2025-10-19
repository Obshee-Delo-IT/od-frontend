module.exports = {
  plugins: [
    [
      '@csstools/postcss-global-data',
      {
        files: ['./src/shared/ui/styles/media.css'],
      },
    ],
    'postcss-flexbugs-fixes',
    'postcss-nested-import',
    'postcss-nested',
    [
      'postcss-preset-env',
      {
        stage: 2,
        features: {
          'custom-media-queries': true,
        },
      },
    ],
    [
      'cssnano',
      {
        discardUnused: false,
      },
    ],
    'autoprefixer',
  ],
};
