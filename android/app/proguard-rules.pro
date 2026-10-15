# Radar MBG ProGuard Rules
-keep class id.go.bgn.radarmbg.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
