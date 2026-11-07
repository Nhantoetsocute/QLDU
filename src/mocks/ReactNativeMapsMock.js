import React, { forwardRef } from 'react';
import { View, Text } from 'react-native';

// react-native-maps only supports native platforms. Keep web layouts usable.
const MapView = forwardRef(function MapView({ style }, ref) {
  return (
    <View ref={ref} style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8ecef' }, style]}>
      <Text>Bản đồ khả dụng trên ứng dụng di động.</Text>
    </View>
  );
});

export const Marker = () => null;
export default MapView;
