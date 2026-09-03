package com.seuic.uhftool.util;

import android.util.Log;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Created by fire_up on 2016/11/26.
 */

public class SystemProperties {
    private final static String TAG = "SystemProperties";

    public static String get(String key) {
        try {
            Class<?> SystemProperties = Class.forName("android.os.SystemProperties");
            Method get = SystemProperties.getDeclaredMethod("get", String.class);
            Object obj = get.invoke(SystemProperties, key);
            return (String) obj;
        } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException |
                 IllegalArgumentException | InvocationTargetException e) {
            Log.w(TAG, "method 'get' failed");
        }
        return null;
    }

    public static String get(String key, String def) {
        try {
            Class<?> SystemProperties = Class.forName("android.os.SystemProperties");
            Method get = SystemProperties.getDeclaredMethod("get", String.class, String.class);
            Object obj = get.invoke(SystemProperties, key, def);
            return (String) obj;
        } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException |
                 IllegalArgumentException | InvocationTargetException e) {
            Log.w(TAG, "method 'get' failed");
        }
        return def;
    }


    public static boolean getBoolean(String key, boolean def) {
        try {
            Class<?> SystemProperties = Class.forName("android.os.SystemProperties");
            Method get = SystemProperties.getDeclaredMethod("getBoolean", String.class, boolean.class);
            Object obj = get.invoke(SystemProperties, key, def);
            return (boolean) obj;
        } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException |
                 IllegalArgumentException | InvocationTargetException e) {
            Log.w(TAG, "method 'get' failed");

        }
        return false;
    }
}
