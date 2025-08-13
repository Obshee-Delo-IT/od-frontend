/** @type {import('stylelint').Config} */
const config = {
  extends: ['stylelint-config-recommended', 'stylelint-config-idiomatic-order'],
  plugins: ['stylelint-order'],
  rules: {
    'block-no-empty': true,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
  },
};

export default config;
