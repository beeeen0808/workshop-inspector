import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

// This redirects to the scan tab - used for deep linking
export default function Scanner() {
  return <Redirect href="/(tabs)/scan" />;
}
