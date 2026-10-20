// Deklarasi tipe untuk impor per-icon-set react-native-vector-icons.
// Paket ini tidak mengirim .d.ts untuk subpath (mis. /Ionicons), jadi kita
// deklarasikan sendiri agar bisa dikonsumsi TypeScript dengan path import.
declare module 'react-native-vector-icons/Ionicons' {
  import * as React from 'react';
  import { StyleProp, TextStyle } from 'react-native';

  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
    backgroundColor?: string;
  }

  export default class Icon extends React.Component<IconProps> {}
}
