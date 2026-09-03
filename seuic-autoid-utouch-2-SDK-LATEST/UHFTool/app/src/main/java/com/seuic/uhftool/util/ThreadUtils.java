package com.seuic.uhftool.util;

import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Created by www on 2018/6/11.
 * UHF
 */
public class ThreadUtils {
    private static Handler sHandler = new Handler(Looper.getMainLooper());
    private static Executor sExecutor = Executors.newSingleThreadExecutor();

    public static void runOnSubThread(Runnable runnable) {
        sExecutor.execute(runnable);
    }

    public static void runOnUIThread(Runnable runnable) {
        sHandler.post(runnable);
    }
}