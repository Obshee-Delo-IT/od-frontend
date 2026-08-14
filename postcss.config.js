module.exports = {
  plugins: [
    [
      '@csstools/postcss-global-data',
      {
        files: ['./src/shared/ui/styles/media.css'],
      },
    ],
    'postcss-nested-import',
    'postcss-nested',
    // Runs autoprefixer itself, off the same browserslist — there is no separate
    // `autoprefixer` entry in this list for that reason.
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
  ],
};
