package com.seuic.uhftool.util;

import android.util.Log;

import com.seuic.uhftool.Appconfig;

public class LogUtil {

	private static final String TAG = "UHFTool";
	public static void i(String tag, String msg) {
		if(Appconfig.DEBUG) {
			Log.i(TAG, tag + " : " + msg);
		}
	}
	public static void d(String tag, String msg) {
		if(Appconfig.DEBUG) {
			Log.d(TAG, tag + " : " + msg);
		}
	}

	public static void i(String tag, String msg, Throwable t) {
		if(Appconfig.DEBUG) {
			Log.i(TAG, tag + " : " + msg, t);
		}
	}

	public static void e(String tag, String msg) {
		if(Appconfig.DEBUG) {
			Log.e(TAG, tag + " : " + msg);
		}
	}

	public static void e(String tag, String msg, Throwable t) {
		if(Appconfig.DEBUG) {
			Log.e(TAG, tag + " : " + msg, t);
		}
	}
}
