# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in D:\adt-bundle-windows-x86-20140321\sdk/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}
 -optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

#When declaring third-party jar packages, ignore the.so files within the third-party jar packages (if any).
#-libraryjars src/main/libsref/uhf.jar
#-libraryjars src/main/libsref/scankey.jar
#-libraryjars src/main/libs/android-support-v4.jar

#No WARN is issued for third-party jar packages here
#-dontwarn com.seuic.scankey.**
#-dontwarn com.seuic.uhf.**
#-dontwarn com.seuic.uhfserver.**

-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.backup.BackupAgentHelper
-keep public class * extends android.preference.Preference

-keepclasseswithmembernames class * {
native <methods>;
}

-keepclasseswithmembers class * {
public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
public <init>(android.content.Context, android.util.AttributeSet, int);
}

-keepclassmembers class * extends android.app.Activity {
public void *(android.view.View);
}

-keepclassmembers enum * {
public static **[] values();
public static ** valueOf(java.lang.String);
}

-keep class * implements android.os.Parcelable {
public static final android.os.Parcelable$Creator *;
}

#Do not confuse the classes in third-party jar packages
-keep class com.seuic.scankey.** {*;}
-keep class com.seuic.uhf.** {*;}
-keep class com.seuic.uhfserver.** {*;}
-keep class android.support.v4.** {*;}

-dontwarn android.telephony.gsm.SmsManager
-dontwarn org.achartengine.**
-dontwarn org.apache.http.client.entity.GzipDecompressingEntity

-keep class org.greenrobot.eventbus.** {*;}
-keepattributes *Annotation*
-keepclassmembers class ** {
	    @org.greenrobot.eventbus.Subscribe <methods>;
}
-keep enum org.greenrobot.eventbus.ThreadMode { *; }
-verbose
#-keep class android.support.v4.** {*;}

-dontwarn org.apache.**
-keep class org.apache.http.** {*;}

-dontwarn net.tsz.afinal.**
-keep class net.tsz.afinal.**{*;}

-dontwarn com.android.util.**
-keep class com.android.util.**{*;}
#-keep class com.seuic.uhftool.UhfService {*;}

-dontwarn com.zhy.http.**
-keep class com.zhy.http.**{*;}

-dontwarn okio.**
-keep class okio.**{*;}

#Unconfused classes
#-keep class com.seuic.ycky.annotation.** {*;}
#-keep class com.seuic.ycky.core.** {*;}
#-keep class com.seuic.ycky.db.** {*;}
#-keep class com.seuic.ycky.entity.** {*;}
#-keep class com.seuic.ycky.entitys.** {*;}
#-keep class com.seuic.ycky.mpos.** {*;}
#-keep class com.seuic.ycky.views.** {*;}


-keepattributes *Annotation*
-keepclassmembers class * {
    @org.greenrobot.eventbus.Subscribe <methods>;
}
-keep enum org.greenrobot.eventbus.ThreadMode { *; }

# Only required if you use AsyncExecutor
-keepclassmembers class * extends org.greenrobot.eventbus.util.ThrowableFailureEvent {
    <init>(java.lang.Throwable);
}