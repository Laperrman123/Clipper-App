import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { RootStackParamList } from '../types/navigation';

import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Alur Mode AI
import ApiKeySetupScreen from '../screens/ai/ApiKeySetupScreen';
import AIVideoPickerScreen from '../screens/ai/AIVideoPickerScreen';
import AIClipConfigScreen from '../screens/ai/AIClipConfigScreen';
import AIAnalyzingScreen from '../screens/ai/AIAnalyzingScreen';
import AIResultScreen from '../screens/ai/AIResultScreen';

// Alur Mode Custom
import CustomVideoPickerScreen from '../screens/custom/CustomVideoPickerScreen';
import CustomTrimScreen from '../screens/custom/CustomTrimScreen';
import CustomProcessingScreen from '../screens/custom/CustomProcessingScreen';
import CustomResultScreen from '../screens/custom/CustomResultScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primaryBright,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: '700' },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Pengaturan' }}
      />

      {/* --- Mode AI Auto-Clip --- */}
      <Stack.Screen
        name="ApiKeySetup"
        component={ApiKeySetupScreen}
        options={{ title: 'Google AI Studio API Key' }}
      />
      <Stack.Screen
        name="AIVideoPicker"
        component={AIVideoPickerScreen}
        options={{ title: 'Pilih Video' }}
      />
      <Stack.Screen
        name="AIClipConfig"
        component={AIClipConfigScreen}
        options={{ title: 'Pengaturan AI Clip' }}
      />
      <Stack.Screen
        name="AIAnalyzing"
        component={AIAnalyzingScreen}
        options={{ title: 'Menganalisis...', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="AIResult"
        component={AIResultScreen}
        options={{ title: 'Hasil Clip AI' }}
      />

      {/* --- Mode Custom Manual --- */}
      <Stack.Screen
        name="CustomVideoPicker"
        component={CustomVideoPickerScreen}
        options={{ title: 'Pilih Video' }}
      />
      <Stack.Screen
        name="CustomTrim"
        component={CustomTrimScreen}
        options={{ title: 'Atur Potongan' }}
      />
      <Stack.Screen
        name="CustomProcessing"
        component={CustomProcessingScreen}
        options={{ title: 'Memotong Video...', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="CustomResult"
        component={CustomResultScreen}
        options={{ title: 'Hasil Potongan' }}
      />
    </Stack.Navigator>
  );
}
