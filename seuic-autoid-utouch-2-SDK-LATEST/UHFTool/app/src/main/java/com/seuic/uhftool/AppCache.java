package com.seuic.uhftool;

import android.util.Log;

public class AppCache {
    public static Runnable mRestartFragment = null;

    private static boolean scanEnable = true;

    private static int isSetting = 0;
    public static boolean ledfun=false;
    private static Boolean isOpened = false;

    static Object object = new Object();

    static boolean isSrceenOff = false;

    static int fragmentId = -1;

    static boolean mainShown = false;

    //
    public static int LED_pos_factory;
    public static int Temp_pos_factory;
    public static boolean isMainShown() {
        return mainShown;
    }

    private static final String TAG = "AppCache";
    public static void setMainShown(boolean mainShown) {
        AppCache.mainShown = mainShown;
        Log.d(TAG, "setMainShown: "+AppCache.mainShown);
    }

    public synchronized static boolean isSrceenOff() {
        return isSrceenOff;
    }

    public synchronized static void setSrceenOff(boolean isSrceenOff) {
        AppCache.isSrceenOff = isSrceenOff;
    }

    public synchronized static boolean isScanEnable() {
        synchronized (object) {
            return scanEnable;
        }
    }

    public synchronized static void setScanEnable(boolean enable) {
        synchronized (object) {
            scanEnable = enable;
            Log.d(TAG, "setScanEnable: "+AppCache.scanEnable);
        }
    }

    public synchronized static int isSetting() {
        synchronized (object) {
            return isSetting;
        }
    }

    public synchronized static void setSetting(int enable) {
        synchronized (object) {
            isSetting = enable;
        }
    }

    public synchronized static Boolean isOpened() {
        return isOpened;
    }

    public synchronized static void setOpened(Boolean isOpend) {
        isOpened = isOpend;
    }

    public static int getCurFragmentId() {
        return fragmentId;
    }

    public static void setCurFragmentId(int fid) {
        AppCache.fragmentId = fid;
    }

}
