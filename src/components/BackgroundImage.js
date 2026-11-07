import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// Keep background images behind content without the deprecated ImageBackground.
const BackgroundImage = ({ source, style, imageStyle, resizeMode, children }) => {
  const { resizeMode: styleResizeMode, ...containerStyle } = StyleSheet.flatten(style) || {};

  return (
    <View style={containerStyle}>
      <Image
        source={source}
        resizeMode={resizeMode || styleResizeMode || 'cover'}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }, imageStyle]}
        pointerEvents="none"
        accessible={false}
      />
      {children}
    </View>
  );
};

export default BackgroundImage;
