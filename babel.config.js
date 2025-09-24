module.exports = {
  presets: [
    "module:metro-react-native-babel-preset",
    "@babel/preset-flow"
  ],
  plugins: [
    ["@babel/plugin-transform-private-methods", { loose: true }],
    ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ["@babel/plugin-transform-class-properties", { loose: true }]
  ]
};


module.exports = {
  presets: [
    "module:metro-react-native-babel-preset", // handles React Native
    "@babel/preset-env",
    "@babel/preset-react"
  ],
};
