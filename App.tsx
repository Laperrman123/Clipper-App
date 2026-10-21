import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/components/Toast';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <ThemedApp />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Dipisah supaya bisa membaca tema dari ThemeProvider di atasnya. */
function ThemedApp() {
  const { colors } = useTheme();
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
}
