import React from 'react';
import { View, Text } from 'react-native';

const MapView = (props) => (
  <View style={[{ backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }, props.style]}>
    <Text>Map View (Mocked for Web)</Text>
  </View>
);

export const Marker = (props) => (
  <View><Text>Marker</Text></View>
);

export default MapView;
