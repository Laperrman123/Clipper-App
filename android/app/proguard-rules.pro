# Add project specific ProGuard rules here.
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# FFmpeg Kit (dipakai untuk memotong video) — jangan sampai di-strip.
-keep class com.arthenica.ffmpegkit.** { *; }
-keep class com.arthenica.smartexception.** { *; }

# Simpan nama native method yang dipanggil dari JS.
-keepclasseswithmembernames class * {
    native <methods>;
}

# react-native-vector-icons
-keep class com.oblador.vectoricons.** { *; }
