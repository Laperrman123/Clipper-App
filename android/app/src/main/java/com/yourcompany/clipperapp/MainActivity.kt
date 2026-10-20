package com.yourcompany.clipperapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Nama component yang diregistrasi dari JavaScript (lihat index.js).
   */
  override fun getMainComponentName(): String = "POTONGIN"

  /**
   * Delegate memakai DefaultReactActivityDelegate supaya New Architecture bisa
   * dinyalakan lewat flag `fabricEnabled`.
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
